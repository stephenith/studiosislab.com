import { readFile, writeFile, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import type { RuntimeConfig } from "../../config.js";
import { isShutdownRequested } from "../../runtime/shutdown.js";
import { startWorkerHeartbeat } from "../../runtime/worker-heartbeat.js";
import { sendLifecycleNotification } from "../../services/notification-pipeline.js";
import {
  discoverCursorAgentCli,
  isCursorAgentReady,
  runCursorAgentPrompt,
  type CursorAgentDiscovery,
} from "./cursor-cli.js";
import { getWorkOrderPaths, promptMdPath } from "./paths.js";
import { updateWorkOrderStatus } from "./store.js";
import type { WorkOrder } from "./types.js";

export type WorkOrderRunnerReport = {
  work_order_id: string;
  started_at: string;
  finished_at: string;
  status: "done" | "failed";
  exit_code: number | null;
  duration_ms: number;
  cursor_agent_version: string | null;
  prompt_path: string;
  output_preview: string;
  error: string | null;
  dry_run: boolean;
};

export type WorkOrderRunnerState = {
  runner_id: string;
  phase: "idle" | "running" | "waiting_auth" | "stopped";
  current_work_order_id: string | null;
  last_discovery: CursorAgentDiscovery | null;
  last_error: string | null;
  processed_count: number;
  updated_at: string;
};

export type WorkOrderRunnerOptions = {
  once?: boolean;
  dryRun?: boolean;
  pollMs?: number;
  force?: boolean;
  timeoutMs?: number;
};

const DEFAULT_POLL_MS = 5_000;
const DEFAULT_TIMEOUT_MS = 3_600_000;

function runnerStatePath(config: RuntimeConfig): string {
  return join(getWorkOrderPaths(config).root, "runner-state.json");
}

function reportPath(config: RuntimeConfig, workOrderId: string): string {
  return join(getWorkOrderPaths(config).reports, `${workOrderId}.json`);
}

export async function writeRunnerState(
  config: RuntimeConfig,
  state: WorkOrderRunnerState,
): Promise<void> {
  await writeFile(runnerStatePath(config), JSON.stringify(state, null, 2), "utf8");
}

export async function loadRunnerState(config: RuntimeConfig): Promise<WorkOrderRunnerState | null> {
  const path = runnerStatePath(config);
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(await readFile(path, "utf8")) as WorkOrderRunnerState;
  } catch {
    return null;
  }
}

async function listInboxQueuedOrders(config: RuntimeConfig): Promise<WorkOrder[]> {
  const paths = getWorkOrderPaths(config);
  if (!existsSync(paths.inbox)) return [];
  const files = (await readdir(paths.inbox)).filter((f) => f.endsWith(".json"));
  const orders: WorkOrder[] = [];
  for (const file of files) {
    try {
      const order = JSON.parse(await readFile(join(paths.inbox, file), "utf8")) as WorkOrder;
      if (order.status === "queued") orders.push(order);
    } catch {
      // skip corrupt
    }
  }
  return orders.sort((a, b) => Date.parse(a.received_at) - Date.parse(b.received_at));
}

async function writeExecutionReport(
  config: RuntimeConfig,
  report: WorkOrderRunnerReport,
): Promise<void> {
  await writeFile(reportPath(config, report.work_order_id), JSON.stringify(report, null, 2), "utf8");
}

async function notifyWorkOrderComplete(
  config: RuntimeConfig,
  order: WorkOrder,
  report: WorkOrderRunnerReport,
): Promise<void> {
  const title =
    report.status === "done"
      ? `Work order done: ${order.work_order_id}`
      : `Work order failed: ${order.work_order_id}`;

  const body =
    report.status === "done"
      ? `Cursor agent finished ${order.work_order_id} (${order.classification}).`
      : `Cursor agent failed ${order.work_order_id}: ${report.error ?? "unknown error"}`;

  await sendLifecycleNotification(config, null, {
    event_id: `work-order:${order.work_order_id}:${report.status}`,
    correlation_id: order.work_order_id,
    source: "work-order-runner",
    caller: "notifyWorkOrderComplete",
    task_id: order.work_order_id,
    title,
    body,
    type: report.status === "done" ? "task_complete" : "failure",
    priority: order.priority,
    metadata: {
      classification: order.classification,
      prompt_path: order.cursor_prompt_path,
      exit_code: report.exit_code,
      duration_ms: report.duration_ms,
      dry_run: report.dry_run,
    },
  });
}

export async function executeWorkOrder(
  config: RuntimeConfig,
  order: WorkOrder,
  options: Pick<WorkOrderRunnerOptions, "dryRun" | "force" | "timeoutMs">,
  discovery: CursorAgentDiscovery,
): Promise<WorkOrderRunnerReport> {
  const paths = getWorkOrderPaths(config);
  const promptAbs = promptMdPath(paths, order.work_order_id);
  const startedAt = new Date().toISOString();
  const startedMs = Date.now();

  if (!existsSync(promptAbs)) {
    const finishedAt = new Date().toISOString();
    return {
      work_order_id: order.work_order_id,
      started_at: startedAt,
      finished_at: finishedAt,
      status: "failed",
      exit_code: null,
      duration_ms: Date.now() - startedMs,
      cursor_agent_version: discovery.cursor_agent_version,
      prompt_path: order.cursor_prompt_path,
      output_preview: "",
      error: `Prompt file missing: ${promptAbs}`,
      dry_run: Boolean(options.dryRun),
    };
  }

  const prompt = await readFile(promptAbs, "utf8");

  if (options.dryRun) {
    const finishedAt = new Date().toISOString();
    return {
      work_order_id: order.work_order_id,
      started_at: startedAt,
      finished_at: finishedAt,
      status: "done",
      exit_code: 0,
      duration_ms: Date.now() - startedMs,
      cursor_agent_version: discovery.cursor_agent_version,
      prompt_path: order.cursor_prompt_path,
      output_preview: `DRY_RUN: would invoke cursor agent (${prompt.length} chars)`,
      error: null,
      dry_run: true,
    };
  }

  const run = await runCursorAgentPrompt({
    workspace: config.repoRoot,
    prompt,
    force: options.force,
    timeoutMs: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
  });

  const output = `${run.stdout}\n${run.stderr}`.trim();
  const finishedAt = new Date().toISOString();

  return {
    work_order_id: order.work_order_id,
    started_at: startedAt,
    finished_at: finishedAt,
    status: run.ok ? "done" : "failed",
    exit_code: run.exit_code,
    duration_ms: run.duration_ms,
    cursor_agent_version: discovery.cursor_agent_version,
    prompt_path: order.cursor_prompt_path,
    output_preview: output.slice(0, 4000),
    error: run.error,
    dry_run: false,
  };
}

export async function processNextWorkOrder(
  config: RuntimeConfig,
  options: WorkOrderRunnerOptions = {},
): Promise<WorkOrderRunnerReport | null> {
  const discovery = await discoverCursorAgentCli();
  if (!options.dryRun && !isCursorAgentReady(discovery)) {
    throw new Error(
      `Cursor agent not ready: ${discovery.auth_detail}. Run \`cursor agent login\` or set CURSOR_API_KEY.`,
    );
  }

  const queued = await listInboxQueuedOrders(config);
  if (queued.length === 0) return null;

  const order = queued[0];
  await updateWorkOrderStatus(config, order.work_order_id, "in_progress", "cursor runner started");

  const report = await executeWorkOrder(config, order, options, discovery);
  await writeExecutionReport(config, report);

  if (report.status === "done") {
    await updateWorkOrderStatus(
      config,
      order.work_order_id,
      "done",
      options.dryRun ? "dry-run complete" : "cursor agent complete",
    );
  } else {
    await updateWorkOrderStatus(
      config,
      order.work_order_id,
      "queued",
      `cursor agent failed: ${report.error ?? "unknown"}`,
    );
  }

  await notifyWorkOrderComplete(config, order, report);
  return report;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export async function runWorkOrderRunnerLoop(options: WorkOrderRunnerOptions = {}): Promise<void> {
  const { loadConfig } = await import("../../config.js");
  const config = loadConfig();
  const pollMs = options.pollMs ?? DEFAULT_POLL_MS;
  const heartbeat = startWorkerHeartbeat(config, "work-order-runner", { initialPhase: "idle" });

  let processed = 0;
  let lastDiscovery: CursorAgentDiscovery | null = null;
  let lastError: string | null = null;

  try {
    while (!isShutdownRequested(config.logsRoot)) {
      lastDiscovery = await discoverCursorAgentCli();
      const ready = options.dryRun || isCursorAgentReady(lastDiscovery);

      await writeRunnerState(config, {
        runner_id: "work-order-runner",
        phase: ready ? "idle" : "waiting_auth",
        current_work_order_id: null,
        last_discovery: lastDiscovery,
        last_error: ready ? null : lastDiscovery.auth_detail,
        processed_count: processed,
        updated_at: new Date().toISOString(),
      });

      if (!ready) {
        lastError = lastDiscovery.auth_detail;
        heartbeat.setPhase("waiting_auth");
        if (options.once) break;
        await sleep(pollMs);
        continue;
      }

      const queued = await listInboxQueuedOrders(config);
      if (queued.length === 0) {
        heartbeat.setPhase("idle");
        if (options.once) break;
        await sleep(pollMs);
        continue;
      }

      const order = queued[0];
      heartbeat.setBusy(order.work_order_id, { classification: order.classification });
      heartbeat.setPhase("running");

      await writeRunnerState(config, {
        runner_id: "work-order-runner",
        phase: "running",
        current_work_order_id: order.work_order_id,
        last_discovery: lastDiscovery,
        last_error: null,
        processed_count: processed,
        updated_at: new Date().toISOString(),
      });

      try {
        await updateWorkOrderStatus(config, order.work_order_id, "in_progress", "cursor runner started");
        const report = await executeWorkOrder(config, order, options, lastDiscovery);
        await writeExecutionReport(config, report);

        if (report.status === "done") {
          await updateWorkOrderStatus(
            config,
            order.work_order_id,
            "done",
            options.dryRun ? "dry-run complete" : "cursor agent complete",
          );
        } else {
          await updateWorkOrderStatus(
            config,
            order.work_order_id,
            "queued",
            `cursor agent failed: ${report.error ?? "unknown"}`,
          );
        }

        await notifyWorkOrderComplete(config, order, report);
        processed += 1;
      } catch (e) {
        lastError = e instanceof Error ? e.message : String(e);
        await updateWorkOrderStatus(config, order.work_order_id, "queued", `runner error: ${lastError}`);
      } finally {
        heartbeat.clearBusy();
        heartbeat.setPhase("idle");
      }

      if (options.once) break;
      await sleep(pollMs);
    }
  } finally {
    await writeRunnerState(config, {
      runner_id: "work-order-runner",
      phase: "stopped",
      current_work_order_id: null,
      last_discovery: lastDiscovery,
      last_error: lastError,
      processed_count: processed,
      updated_at: new Date().toISOString(),
    });
    await heartbeat.stop();
  }
}
