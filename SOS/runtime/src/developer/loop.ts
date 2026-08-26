import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import type { RuntimeConfig } from "../config.js";
import { loadConfig } from "../config.js";
import { getDeveloperPaths } from "./paths.js";
import type { DeveloperRuntimeState } from "./types.js";
import { loadDeveloperState, saveDeveloperState } from "./state.js";
import { watchForNewBrief } from "./watcher.js";
import { prepareTaskFromBrief } from "./prepare.js";
import { executePreparedTask } from "./autonomous-execute.js";
import type { DeveloperState, DeveloperStatus } from "./types.js";
import { isShutdownRequested } from "../runtime/shutdown.js";
import { startWorkerHeartbeat } from "../runtime/worker-heartbeat.js";
import { reconcileDeveloperWithPm } from "./handoff.js";

export type DeveloperLoopOptions = {
  once?: boolean;
  pollMs?: number;
  dryRun?: boolean;
};

const loopStartedAt = Date.now();

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function writeHeartbeat(
  paths: ReturnType<typeof getDeveloperPaths>,
  state: DeveloperRuntimeState,
): Promise<void> {
  const status: DeveloperStatus = {
    state: state.state,
    current_task_id: state.current_task_id,
    current_correlation_id: state.current_correlation_id,
    uptime_seconds: Math.floor((Date.now() - loopStartedAt) / 1000),
    last_heartbeat: new Date().toISOString(),
    started_at: state.started_at,
  };
  await writeFile(paths.status, JSON.stringify(status, null, 2), "utf8");
}

async function runAutonomousPipeline(
  config: RuntimeConfig,
  paths: ReturnType<typeof getDeveloperPaths>,
  state: DeveloperRuntimeState,
): Promise<void> {
  if (isShutdownRequested(config.logsRoot)) return;

  await reconcileDeveloperWithPm(config, paths, state);

  if (state.state === "paused") {
    return;
  }

  if (state.state === "idle" && !state.current_task_id) {
    const brief = await watchForNewBrief(paths, state);
    if (brief) {
      await prepareTaskFromBrief(config, paths, state, brief);
      await mkdir(paths.progress, { recursive: true });
      await writeFile(
        join(paths.progress, `${brief.task_id}-prepare.json`),
        JSON.stringify({ task_id: brief.task_id, prepared_at: new Date().toISOString() }, null, 2),
        "utf8",
      );
    }
  }

  if (
    (state.state === "working" || state.state === "prepared")
    && state.work_plan_path
    && state.current_task_id
    && !state.execution_submitted
  ) {
    await executePreparedTask(config, paths, state);
  }

  if (state.state === "awaiting_qa") {
    state.current_task_id = null;
    state.current_correlation_id = null;
    state.claimed_brief_path = null;
    state.work_plan_path = null;
    state.implementation_plan_path = null;
    state.state = "idle";
  }
}

export async function runDeveloperLoop(
  options: DeveloperLoopOptions = {},
): Promise<void> {
  const config = loadConfig();
  const paths = getDeveloperPaths(config);
  const state = await loadDeveloperState(paths);
  const pollMs = options.pollMs ?? parseInt(process.env.SOS_DEV_POLL_MS ?? "5000", 10);
  const heartbeat = startWorkerHeartbeat(config, "developer", { initialPhase: state.state });

  try {
    for (;;) {
      if (isShutdownRequested(config.logsRoot)) {
        await saveDeveloperState(paths, state);
        await writeHeartbeat(paths, state);
        break;
      }

      heartbeat.setPhase(state.state);

      try {
        const willExecute =
          (state.state === "working" || state.state === "prepared")
          && state.work_plan_path
          && state.current_task_id
          && !state.execution_submitted;

        if (willExecute) {
          heartbeat.setBusy("execute", { task_id: state.current_task_id });
        }

        await runAutonomousPipeline(config, paths, state);
        heartbeat.clearBusy();
      } catch (e) {
        heartbeat.clearBusy();
        const msg = e instanceof Error ? e.message : String(e);
        console.error(`[developer] pipeline error: ${msg}`);
        if (options.once) throw e;
        await sleep(Math.min(pollMs * 2, 30_000));
      }

      await saveDeveloperState(paths, state);
      await writeHeartbeat(paths, state);

      if (options.once) break;
      await sleep(pollMs);
    }

    if (state.state !== "blocked" && state.state !== "awaiting_qa" && state.state !== "executing") {
      if (state.state !== "working" || state.execution_submitted) {
        state.state = "idle";
      }
    }

    await saveDeveloperState(paths, state);
    await writeHeartbeat(paths, state);
  } finally {
    await heartbeat.stop();
  }
}

export async function getDeveloperStatus(): Promise<
  DeveloperStatus & {
    runtime_state: DeveloperState;
    processed_brief_ids: string[];
    handed_off_task_ids: string[];
    work_plan_path: string | null;
    implementation_plan_path: string | null;
    execution_report_path: string | null;
    execution_submitted: boolean;
    watcher: Awaited<ReturnType<typeof import("./watcher.js").getWatcherSnapshot>>;
  }
> {
  const config = loadConfig();
  const paths = getDeveloperPaths(config);
  const state = await loadDeveloperState(paths);
  const { getWatcherSnapshot } = await import("./watcher.js");

  return {
    state: state.state,
    current_task_id: state.current_task_id,
    current_correlation_id: state.current_correlation_id,
    uptime_seconds: Math.floor((Date.now() - Date.parse(state.started_at)) / 1000),
    last_heartbeat: state.updated_at,
    started_at: state.started_at,
    runtime_state: state.state,
    processed_brief_ids: state.processed_brief_ids,
    handed_off_task_ids: state.handed_off_task_ids,
    work_plan_path: state.work_plan_path,
    implementation_plan_path: state.implementation_plan_path,
    execution_report_path: state.execution_report_path,
    execution_submitted: state.execution_submitted,
    watcher: await getWatcherSnapshot(paths, state),
  };
}

export async function resetDeveloperRuntime(): Promise<void> {
  const config = loadConfig();
  const paths = getDeveloperPaths(config);
  const { resetDeveloperState, ensureDeveloperDirs } = await import("./state.js");
  await ensureDeveloperDirs(paths);
  await resetDeveloperState(paths);
  const { writeFile } = await import("node:fs/promises");
  await writeFile(
    paths.status,
    JSON.stringify({ state: "idle", reset_at: new Date().toISOString() }, null, 2),
    "utf8",
  );
}
