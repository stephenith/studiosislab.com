#!/usr/bin/env node
/**
 * Graceful shutdown simulation — SIGTERM Commander and verify clean stop + state preservation.
 * Does NOT reset PM/Developer/QA state or delete logs.
 */
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { loadConfig } from "../config.js";
import { getCommanderPaths } from "../commander/paths.js";
import {
  isCommanderRunning,
  readCommanderHealth,
  stopCommanderByPid,
} from "../commander/supervisor.js";
import { readPmTaskSnapshot } from "../commander/production-audit.js";
import { readDeveloperState, readQaState } from "./recovery-state.js";
import { shutdownFlagPath } from "../runtime/shutdown.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const RUNTIME_ROOT = join(__dirname, "../..");
const STOP_WAIT_MS = parseInt(process.env.SOS_GRACEFUL_TEST_WAIT_MS ?? "180000", 10);
const TEST_ENV = {
  ...process.env,
  SOS_COMMANDER_DRAIN_MS: process.env.SOS_COMMANDER_DRAIN_MS ?? "5000",
  SOS_COMMANDER_WORKER_STOP_MS: process.env.SOS_COMMANDER_WORKER_STOP_MS ?? "10000",
};

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function ensureCommanderRunning(
  paths: ReturnType<typeof getCommanderPaths>,
): Promise<void> {
  const { running } = await isCommanderRunning(paths);
  if (running) return;

  console.log("[graceful-test] Commander not running — starting in background...");
  const child = spawn("npm", ["run", "commander:start"], {
    cwd: RUNTIME_ROOT,
    detached: true,
    stdio: "ignore",
    env: TEST_ENV,
  });
  child.unref();

  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    const { running: nowRunning } = await isCommanderRunning(paths);
    if (nowRunning) {
      await sleep(5000);
      return;
    }
    await sleep(500);
  }
  throw new Error("Commander failed to start within 30s");
}

async function waitForCommanderStopped(
  paths: ReturnType<typeof getCommanderPaths>,
  timeoutMs: number,
): Promise<{ stopped: boolean; health: Record<string, unknown> | null }> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const { running } = await isCommanderRunning(paths);
    const health = await readCommanderHealth(paths);
    const gracefulStop = health?.graceful_stop as Record<string, unknown> | undefined;
    const flagCleared = !existsSync(shutdownFlagPath(loadConfig().logsRoot));

    if (!running && gracefulStop && flagCleared) {
      return { stopped: true, health };
    }
    if (!running && health?.status === "stopped" && gracefulStop) {
      return { stopped: true, health };
    }
    await sleep(500);
  }
  return { stopped: false, health: await readCommanderHealth(paths) };
}

async function main(): Promise<void> {
  const config = loadConfig();
  const paths = getCommanderPaths(config);

  await ensureCommanderRunning(paths);

  const pmBefore = await readPmTaskSnapshot();
  const devBefore = await readDeveloperState(config);
  const qaBefore = await readQaState(config);

  const healthBefore = (await readCommanderHealth(paths)) as Record<string, unknown> | null;
  const workersBefore = (healthBefore?.workers as Array<{ id: string; crash_count: number }>) ?? [];
  const crashCountsBefore = Object.fromEntries(workersBefore.map((w) => [w.id, w.crash_count]));

  const sent = await stopCommanderByPid(paths);
  if (!sent) {
    throw new Error("Failed to send SIGTERM to Commander");
  }

  console.log("[graceful-test] SIGTERM sent — waiting for graceful stop...");
  const { stopped, health } = await waitForCommanderStopped(paths, STOP_WAIT_MS);

  const gracefulStop = health?.graceful_stop as Record<string, unknown> | undefined;
  const flagCleared = !existsSync(shutdownFlagPath(config.logsRoot));

  const pmAfter = await readPmTaskSnapshot();
  const devAfter = await readDeveloperState(config);
  const qaAfter = await readQaState(config);

  const taskPreserved =
    pmBefore.current_task_id === pmAfter.current_task_id
    && pmBefore.completed_count === pmAfter.completed_count
    && pmBefore.task_count === pmAfter.task_count;

  const devPreserved =
    devBefore.current_task_id === devAfter.current_task_id
    && devBefore.execution_submitted === devAfter.execution_submitted;

  const qaPreserved = qaBefore.current_task_id === qaAfter.current_task_id;

  const workersStopped = Array.isArray(gracefulStop?.workers)
    ? (gracefulStop.workers as Array<{ stopped: boolean }>).every((w) => w.stopped)
    : false;

  const healthWorkers = (health?.workers as Array<{
    id: string;
    status: string;
    expected_exit: boolean | null;
    shutdown_reason: string | null;
    last_exit_reason: string | null;
    crash_count: number;
  }>) ?? [];

  const gracefulWorkerStatuses = healthWorkers.every(
    (w) => w.status === "graceful_shutdown" && w.expected_exit === true,
  );
  const noCrashIncrement = healthWorkers.every(
    (w) => w.crash_count <= (crashCountsBefore[w.id] ?? 0),
  );

  const report = {
    tested_at: new Date().toISOString(),
    commander_stopped: stopped,
    graceful_stop_recorded: Boolean(gracefulStop),
    shutdown_flag_cleared: flagCleared,
    workers_stopped: workersStopped,
    states_flushed: gracefulStop?.states_flushed === true,
    task_preservation: {
      ok: taskPreserved,
      before: pmBefore,
      after: pmAfter,
    },
    developer_preservation: {
      ok: devPreserved,
      before: devBefore,
      after: devAfter,
    },
    qa_preservation: {
      ok: qaPreserved,
      before: qaBefore,
      after: qaAfter,
    },
    graceful_stop: gracefulStop ?? null,
    health_status: health?.status ?? null,
    shutdown_reason: health?.shutdown_reason ?? null,
    workers_graceful_shutdown: gracefulWorkerStatuses,
    no_crash_count_increment: noCrashIncrement,
    worker_exit_summary: healthWorkers.map((w) => ({
      id: w.id,
      status: w.status,
      expected_exit: w.expected_exit,
      shutdown_reason: w.shutdown_reason,
      last_exit_reason: w.last_exit_reason,
      crash_count: w.crash_count,
    })),
    all_ok:
      stopped
      && Boolean(gracefulStop)
      && flagCleared
      && taskPreserved
      && devPreserved
      && qaPreserved
      && gracefulWorkerStatuses
      && noCrashIncrement,
  };

  console.log(JSON.stringify(report, null, 2));
  if (!report.all_ok) process.exit(1);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
