#!/usr/bin/env node
/**
 * Crash-recovery simulation — kills worker processes under a running Commander.
 * Commander restarts workers. Does NOT reset PM/Developer/QA state or delete logs.
 */
import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { loadConfig } from "../config.js";
import { getCommanderPaths } from "../commander/paths.js";
import {
  isCommanderRunning,
  readCommanderHealth,
  killWorkerForTest,
} from "../commander/supervisor.js";
import { readPmTaskSnapshot } from "../commander/production-audit.js";
import { CRASH_ALERT_THRESHOLD } from "../commander/workers.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const RUNTIME_ROOT = join(__dirname, "../..");

const WORKERS_TO_TEST = ["pm", "developer", "qa", "telegram", "dispatcher"] as const;
const RESTART_WAIT_MS = parseInt(process.env.SOS_CRASH_TEST_WAIT_MS ?? "15000", 10);

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitForWorkerRunning(
  paths: ReturnType<typeof getCommanderPaths>,
  workerId: string,
  minRestartCount: number,
  timeoutMs: number,
): Promise<{ ok: boolean; health: Record<string, unknown> | null }> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const health = (await readCommanderHealth(paths)) as Record<string, unknown> | null;
    const workers = health?.workers as Array<{
      id: string;
      status: string;
      pid: number | null;
      restart_count: number;
      crash_count: number;
      expected_exit: boolean | null;
      alerted: boolean;
    }> | undefined;
    const w = workers?.find((x) => x.id === workerId);
    if (w?.status === "running" && w.pid && w.restart_count >= minRestartCount) {
      return { ok: true, health };
    }
    await sleep(500);
  }
  return { ok: false, health: await readCommanderHealth(paths) };
}

async function ensureCommanderRunning(
  paths: ReturnType<typeof getCommanderPaths>,
): Promise<void> {
  const { running } = await isCommanderRunning(paths);
  if (running) return;

  console.log("[crash-test] Commander not running — starting in background...");
  const child = spawn("npm", ["run", "commander:start"], {
    cwd: RUNTIME_ROOT,
    detached: true,
    stdio: "ignore",
    env: process.env,
  });
  child.unref();

  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    const { running: nowRunning } = await isCommanderRunning(paths);
    if (nowRunning) {
      await sleep(3000);
      return;
    }
    await sleep(500);
  }
  throw new Error("Commander failed to start within 30s");
}

async function main(): Promise<void> {
  const config = loadConfig();
  const paths = getCommanderPaths(config);

  await ensureCommanderRunning(paths);

  const pmBefore = await readPmTaskSnapshot();
  const results: Array<{
    worker_id: string;
    killed: boolean;
    pid: number | null;
    restart_verified: boolean;
    restart_count_before: number;
    restart_count_after: number;
    crash_count_after: number;
    expected_exit: boolean | null;
    error?: string;
  }> = [];

  for (const workerId of WORKERS_TO_TEST) {
    const healthBefore = (await readCommanderHealth(paths)) as Record<string, unknown> | null;
    const workersBefore = healthBefore?.workers as Array<{
      id: string;
      restart_count: number;
    }> | undefined;
    const restartBefore = workersBefore?.find((w) => w.id === workerId)?.restart_count ?? 0;

    const kill = killWorkerForTest(healthBefore ?? {}, workerId);
    if (!kill.killed) {
      results.push({
        worker_id: workerId,
        killed: false,
        pid: kill.pid,
        restart_verified: false,
        restart_count_before: restartBefore,
        restart_count_after: restartBefore,
        crash_count_after: 0,
        expected_exit: null,
        error: kill.reason,
      });
      continue;
    }

    console.log(`[crash-test] SIGKILL ${workerId} pid=${kill.pid}`);
    await sleep(1000);

    const { ok, health: healthAfter } = await waitForWorkerRunning(
      paths,
      workerId,
      restartBefore + 1,
      RESTART_WAIT_MS,
    );

    const workersAfter = healthAfter?.workers as Array<{
      id: string;
      restart_count: number;
      crash_count: number;
      status: string;
      pid: number | null;
      expected_exit: boolean | null;
    }> | undefined;
    const workerAfter = workersAfter?.find((w) => w.id === workerId);
    const restartAfter = workerAfter?.restart_count ?? restartBefore;

    results.push({
      worker_id: workerId,
      killed: true,
      pid: kill.pid,
      restart_verified: ok,
      restart_count_before: restartBefore,
      restart_count_after: restartAfter,
      crash_count_after: workerAfter?.crash_count ?? 0,
      expected_exit: workerAfter?.expected_exit ?? null,
      error: ok ? undefined : "Worker did not return to running within timeout",
    });

    await sleep(2000);
  }

  // Alert path — SIGKILL until crash_count reaches threshold
  const alertWorkerId = "dispatcher";
  type AlertWorker = {
    id: string;
    crash_count: number;
    restart_count: number;
    alerted: boolean;
    expected_exit: boolean | null;
    last_exit_reason: string | null;
  };

  let alertHealthFinal = (await readCommanderHealth(paths)) as Record<string, unknown> | null;
  let alertWorker = ((alertHealthFinal?.workers as AlertWorker[]) ?? []).find(
    (w) => w.id === alertWorkerId,
  );
  const crashCountStart = alertWorker?.crash_count ?? 0;

  for (let attempt = 0; attempt < 5; attempt++) {
    alertHealthFinal = (await readCommanderHealth(paths)) as Record<string, unknown> | null;
    alertWorker = ((alertHealthFinal?.workers as AlertWorker[]) ?? []).find(
      (w) => w.id === alertWorkerId,
    );
    if ((alertWorker?.crash_count ?? 0) >= CRASH_ALERT_THRESHOLD) break;

    const kill = killWorkerForTest(alertHealthFinal ?? {}, alertWorkerId);
    if (!kill.killed) {
      await sleep(2000);
      continue;
    }
    console.log(
      `[crash-test] alert path SIGKILL ${alertWorkerId} (crash_count=${alertWorker?.crash_count ?? 0})`,
    );
    const restartBefore = alertWorker?.restart_count ?? 0;
    await sleep(1000);
    await waitForWorkerRunning(paths, alertWorkerId, restartBefore + 1, RESTART_WAIT_MS);
    await sleep(2000);
  }

  alertHealthFinal = (await readCommanderHealth(paths)) as Record<string, unknown> | null;
  alertWorker = ((alertHealthFinal?.workers as AlertWorker[]) ?? []).find(
    (w) => w.id === alertWorkerId,
  );

  const alertPath = {
    worker_id: alertWorkerId,
    crash_count_start: crashCountStart,
    crash_count_final: alertWorker?.crash_count ?? 0,
    threshold: CRASH_ALERT_THRESHOLD,
    threshold_reached: (alertWorker?.crash_count ?? 0) >= CRASH_ALERT_THRESHOLD,
    alerted: alertWorker?.alerted ?? false,
    expected_exit: alertWorker?.expected_exit ?? null,
    last_exit_reason: alertWorker?.last_exit_reason ?? null,
    alert_would_fire: (alertWorker?.crash_count ?? 0) >= CRASH_ALERT_THRESHOLD,
  };

  const pmAfter = await readPmTaskSnapshot();
  const taskPreserved =
    pmBefore.current_task_id === pmAfter.current_task_id
    && pmBefore.completed_count === pmAfter.completed_count
    && pmBefore.task_count === pmAfter.task_count;

  const historyPath = join(paths.root, "restart-history.jsonl");
  let restartHistoryLines = 0;
  if (existsSync(historyPath)) {
    restartHistoryLines = (await readFile(historyPath, "utf8")).split("\n").filter(Boolean).length;
  }

  const report = {
    tested_at: new Date().toISOString(),
    workers_tested: WORKERS_TO_TEST.length,
    results,
    all_restarted: results.every((r) => r.restart_verified),
    task_preservation: {
      ok: taskPreserved,
      before: pmBefore,
      after: pmAfter,
    },
    restart_history_lines: restartHistoryLines,
    alert_path: alertPath,
    all_crashes_unexpected: results.every((r) => r.expected_exit === false || r.expected_exit === null),
    remaining_failures: results.filter((r) => !r.restart_verified).map((r) => r.worker_id),
  };

  console.log(JSON.stringify(report, null, 2));
  if (
    !report.all_restarted
    || !taskPreserved
    || !report.all_crashes_unexpected
    || !alertPath.threshold_reached
  ) {
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
