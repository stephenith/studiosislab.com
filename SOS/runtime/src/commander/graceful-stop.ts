import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import type { RuntimeConfig } from "../config.js";
import { getPmPaths } from "../pm/paths.js";
import { loadState, saveState } from "../pm/state.js";
import { updateAgentStatus } from "../pm/agents.js";
import { getDeveloperPaths } from "../developer/paths.js";
import { loadDeveloperState, saveDeveloperState } from "../developer/state.js";
import { getQaPaths } from "../qa/paths.js";
import { loadQaState, saveQaState } from "../qa/state.js";
import { recoverStaleLocks } from "./lock-recovery.js";
import { writeShutdownFlag, clearShutdownFlag } from "../runtime/shutdown.js";
import { WORKER_SHUTDOWN_ORDER } from "./workers.js";
import { readAgentHeartbeats } from "./agent-heartbeat.js";
import { verifyWorkersStopped, killProcessTree } from "./process-table.js";

const GRACEFUL_DRAIN_MS = parseInt(process.env.SOS_COMMANDER_DRAIN_MS ?? "120000", 10);
const WORKER_STOP_TIMEOUT_MS = parseInt(process.env.SOS_COMMANDER_WORKER_STOP_MS ?? "60000", 10);

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function isProcessAlive(pid: number | null): boolean {
  if (!pid) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function stopPidGracefully(pid: number, timeoutMs: number): Promise<boolean> {
  if (!isProcessAlive(pid)) return true;
  try {
    process.kill(pid, "SIGTERM");
  } catch {
    return !isProcessAlive(pid);
  }
  const deadline = Date.now() + timeoutMs;
  while (isProcessAlive(pid) && Date.now() < deadline) {
    await sleep(250);
  }
  if (isProcessAlive(pid)) {
    try {
      process.kill(pid, "SIGKILL");
    } catch {
      /* already gone */
    }
    await sleep(500);
  }
  return !isProcessAlive(pid);
}

type WorkerRef = {
  id: string;
  pid: number | null;
  process: { kill: (sig: NodeJS.Signals) => void; killed?: boolean } | null;
};

async function flushRuntimeStates(config: RuntimeConfig): Promise<void> {
  const pmPaths = getPmPaths(config);
  const pmState = await loadState(pmPaths);
  pmState.loop_status = "stopped";
  await saveState(pmPaths, pmState);
  await updateAgentStatus(pmPaths, pmState);

  const devPaths = getDeveloperPaths(config);
  const devState = await loadDeveloperState(devPaths);
  await saveDeveloperState(devPaths, devState);

  const qaPaths = getQaPaths(config);
  const qaState = await loadQaState(qaPaths);
  await saveQaState(qaPaths, qaState);
}

async function waitForWorkerDrain(
  config: RuntimeConfig,
  workerId: string,
  deadline: number,
): Promise<boolean> {
  while (Date.now() < deadline) {
    const heartbeats = await readAgentHeartbeats(config, 999_999_999);
    const hb = heartbeats.find((h) => h.worker_id === workerId);

    if (workerId === "pm" && hb?.last_heartbeat) return true;
    if (workerId === "developer") {
      const devPaths = getDeveloperPaths(config);
      const dev = await loadDeveloperState(devPaths);
      if (dev.state === "idle" || dev.execution_submitted || dev.state === "awaiting_qa") {
        return true;
      }
    }
    if (workerId === "qa") {
      const qaPaths = getQaPaths(config);
      const qa = await loadQaState(qaPaths);
      if (qa.state === "idle" || qa.state === "pass" || qa.state === "fail") return true;
    }
    if (workerId === "telegram" || workerId === "dispatcher" || workerId === "approvals") {
      return true;
    }

    await sleep(1000);
  }
  return false;
}

async function stopWorkerGracefully(
  worker: WorkerRef,
  config: RuntimeConfig,
): Promise<{ id: string; drained: boolean; stopped: boolean }> {
  if (!worker.pid) {
    return { id: worker.id, drained: true, stopped: true };
  }

  const drainDeadline = Date.now() + GRACEFUL_DRAIN_MS;
  await waitForWorkerDrain(config, worker.id, drainDeadline);

  if (worker.process) {
    worker.process.kill("SIGTERM");
  } else {
    await stopPidGracefully(worker.pid, WORKER_STOP_TIMEOUT_MS);
    return {
      id: worker.id,
      drained: true,
      stopped: !isProcessAlive(worker.pid),
    };
  }

  const stopDeadline = Date.now() + WORKER_STOP_TIMEOUT_MS;
  while (isProcessAlive(worker.pid) && Date.now() < stopDeadline) {
    await sleep(250);
  }

  if (isProcessAlive(worker.pid)) {
    if (worker.process) {
      worker.process.kill("SIGKILL");
    } else if (worker.pid) {
      killProcessTree(worker.pid);
    }
    await sleep(500);
  }

  return {
    id: worker.id,
    drained: true,
    stopped: !isProcessAlive(worker.pid),
  };
}

export type GracefulStopReport = {
  reason: string;
  stopped_at: string;
  workers: Array<{ id: string; drained: boolean; stopped: boolean }>;
  locks_released: number;
  states_flushed: boolean;
  process_verification?: Awaited<ReturnType<typeof verifyWorkersStopped>>;
};

export async function gracefulStopWorkers(
  config: RuntimeConfig,
  workers: WorkerRef[],
  reason: string,
): Promise<GracefulStopReport> {
  await writeShutdownFlag(config.logsRoot, reason, "commander");

  const byId = new Map(workers.map((w) => [w.id, w]));
  const results: GracefulStopReport["workers"] = [];

  for (const id of WORKER_SHUTDOWN_ORDER) {
    const worker = byId.get(id);
    if (!worker) continue;
    const result = await stopWorkerGracefully(worker, config);
    results.push(result);
  }

  await flushRuntimeStates(config);

  const lockRecovery = await recoverStaleLocks(config);
  await clearShutdownFlag(config.logsRoot);

  const processVerification = await verifyWorkersStopped(undefined, { forceTerminate: true });

  return {
    reason,
    stopped_at: new Date().toISOString(),
    workers: results,
    locks_released: lockRecovery.total_removed,
    states_flushed: true,
    process_verification: processVerification,
  };
}

export async function readPmTaskSnapshot(config: RuntimeConfig): Promise<{
  current_task_id: string | null;
  task_count: number;
  completed_count: number;
}> {
  const statePath = join(config.sosRoot, "07_LOGS", "pm", "state.json");
  if (!existsSync(statePath)) {
    return { current_task_id: null, task_count: 0, completed_count: 0 };
  }
  const state = JSON.parse(await readFile(statePath, "utf8")) as {
    current_task_id: string | null;
    task_queue: unknown[];
    completed_task_ids: string[];
  };
  return {
    current_task_id: state.current_task_id,
    task_count: state.task_queue.length,
    completed_count: state.completed_task_ids.length,
  };
}
