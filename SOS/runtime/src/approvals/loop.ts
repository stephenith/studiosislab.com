import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import type { RuntimeConfig } from "../config.js";
import { loadConfig } from "../config.js";
import { getApprovalsPaths } from "./paths.js";
import {
  loadApprovalsState,
  saveApprovalsState,
  listApprovalRecords,
  ensureApprovalsDirs,
} from "./state.js";
import {
  listInboxFiles,
  parseInboxFile,
  validateInboxMessage,
  moveInboxFile,
} from "./inbox.js";
import { syncPendingFromPm, processCommanderDecision } from "./processor.js";
import { pollTelegramReplies } from "./telegram/loop.js";
import { isShutdownRequested } from "../runtime/shutdown.js";
import { startWorkerHeartbeat } from "../runtime/worker-heartbeat.js";
import type { ApprovalsStatus } from "./types.js";

export type ApprovalsListenOptions = {
  once?: boolean;
  pollMs?: number;
};

const loopStartedAt = Date.now();

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function writeStatus(
  paths: ReturnType<typeof getApprovalsPaths>,
  listenerState: ApprovalsStatus["listener_state"],
  currentApprovalId: string | null,
  runtimeState: Awaited<ReturnType<typeof loadApprovalsState>>,
): Promise<void> {
  const records = await listApprovalRecords(paths);
  const pending = records.filter((r) => r.state === "pending").length;

  const status: ApprovalsStatus = {
    listener_state: listenerState,
    uptime_seconds: Math.floor((Date.now() - loopStartedAt) / 1000),
    last_heartbeat: new Date().toISOString(),
    started_at: runtimeState.started_at,
    pending_records: pending,
    estop_active: runtimeState.estop_active,
    current_approval_id: currentApprovalId,
    last_processed_at: runtimeState.last_processed_at,
  };

  await writeFile(paths.status, JSON.stringify(status, null, 2), "utf8");
}

async function processInboxBatch(
  config: RuntimeConfig,
  paths: ReturnType<typeof getApprovalsPaths>,
): Promise<number> {
  await syncPendingFromPm(paths);

  const runtimeState = await loadApprovalsState(paths);
  const files = await listInboxFiles(paths);
  let processed = 0;

  for (const filename of files) {
    if (runtimeState.processed_inbox_files.includes(filename)) continue;

    await writeStatus(paths, "processing", null, runtimeState);

    const msg = await parseInboxFile(paths, filename);
    if (!msg) {
      await moveInboxFile(paths, filename, "invalid");
      runtimeState.processed_inbox_files.push(filename);
      continue;
    }

    const schemaError = validateInboxMessage(msg);
    if (schemaError) {
      await moveInboxFile(paths, filename, "invalid");
      runtimeState.processed_inbox_files.push(filename);
      continue;
    }

    const result = await processCommanderDecision(paths, msg);
    if (result.ok) {
      await moveInboxFile(paths, filename, "processed");
      processed += 1;
    } else {
      await moveInboxFile(paths, filename, "invalid");
    }

    runtimeState.processed_inbox_files.push(filename);
    runtimeState.last_processed_at = new Date().toISOString();
    await saveApprovalsState(paths, runtimeState);
  }

  return processed;
}

export async function runApprovalsListenLoop(
  options: ApprovalsListenOptions = {},
): Promise<void> {
  const config = loadConfig();
  const paths = getApprovalsPaths(config);
  await ensureApprovalsDirs(paths);

  const pollMs = options.pollMs ?? parseInt(process.env.SOS_APPROVALS_POLL_MS ?? "3000", 10);
  const heartbeat = startWorkerHeartbeat(config, "approvals", { initialPhase: "listening" });

  const runtimeState = await loadApprovalsState(paths);

  try {
    do {
      if (isShutdownRequested(config.logsRoot)) break;

      heartbeat.setPhase("listening");
      await writeStatus(paths, "listening", null, runtimeState);
      heartbeat.setBusy("inbox_batch");
      await processInboxBatch(config, paths);
      heartbeat.clearBusy();

      if (process.env.SOS_APPROVALS_SKIP_TELEGRAM !== "true") {
        heartbeat.setBusy("telegram_poll");
        await pollTelegramReplies({ once: true });
        heartbeat.clearBusy();
      }

      await writeStatus(paths, "listening", null, await loadApprovalsState(paths));

      if (!options.once) await sleep(pollMs);
    } while (!options.once);

    await writeStatus(paths, "idle", null, await loadApprovalsState(paths));
  } finally {
    await heartbeat.stop();
  }
}

export async function getApprovalsStatus(): Promise<ApprovalsStatus & { records: unknown[] }> {
  const config = loadConfig();
  const paths = getApprovalsPaths(config);
  await ensureApprovalsDirs(paths);

  const runtimeState = await loadApprovalsState(paths);
  const records = await listApprovalRecords(paths);

  let status: ApprovalsStatus = {
    listener_state: "idle",
    uptime_seconds: 0,
    last_heartbeat: new Date().toISOString(),
    started_at: runtimeState.started_at,
    pending_records: records.filter((r) => r.state === "pending").length,
    estop_active: runtimeState.estop_active,
    current_approval_id: null,
    last_processed_at: runtimeState.last_processed_at,
  };

  if (existsSync(paths.status)) {
    status = JSON.parse(await readFile(paths.status, "utf8")) as ApprovalsStatus;
  }

  return {
    ...status,
    records: records.map((r) => ({
      approval_id: r.approval_id,
      task_id: r.task_id,
      state: r.state,
      command: r.command,
      updated_at: r.updated_at,
    })),
  };
}
