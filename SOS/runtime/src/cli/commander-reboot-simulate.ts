#!/usr/bin/env node
/**
 * Reboot simulation — graceful stop → start → verify startup recovery and state integrity.
 * Does NOT reset PM/Developer/QA state or delete logs.
 */
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
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

const __dirname = dirname(fileURLToPath(import.meta.url));
const RUNTIME_ROOT = join(__dirname, "../..");
const STOP_WAIT_MS = parseInt(process.env.SOS_REBOOT_STOP_WAIT_MS ?? "180000", 10);
const START_WAIT_MS = parseInt(process.env.SOS_REBOOT_START_WAIT_MS ?? "30000", 10);
const TEST_ENV = {
  ...process.env,
  SOS_COMMANDER_DRAIN_MS: process.env.SOS_COMMANDER_DRAIN_MS ?? "5000",
  SOS_COMMANDER_WORKER_STOP_MS: process.env.SOS_COMMANDER_WORKER_STOP_MS ?? "10000",
};

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitForCommanderStopped(
  paths: ReturnType<typeof getCommanderPaths>,
  timeoutMs: number,
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const { running } = await isCommanderRunning(paths);
    if (!running) return true;
    await sleep(500);
  }
  return false;
}

async function waitForCommanderRunning(
  paths: ReturnType<typeof getCommanderPaths>,
  timeoutMs: number,
): Promise<Record<string, unknown> | null> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const { running } = await isCommanderRunning(paths);
    if (running) {
      await sleep(5000);
      return readCommanderHealth(paths);
    }
    await sleep(500);
  }
  return null;
}

async function main(): Promise<void> {
  const config = loadConfig();
  const paths = getCommanderPaths(config);

  const { running } = await isCommanderRunning(paths);
  if (!running) {
    console.log("[reboot-simulate] Commander not running — starting first...");
    const child = spawn("npm", ["run", "commander:start"], {
      cwd: RUNTIME_ROOT,
      detached: true,
      stdio: "ignore",
      env: TEST_ENV,
    });
    child.unref();
    const health = await waitForCommanderRunning(paths, START_WAIT_MS);
    if (!health) throw new Error("Commander failed to start");
  }

  const pmBefore = await readPmTaskSnapshot();
  const devBefore = await readDeveloperState(config);
  const qaBefore = await readQaState(config);
  const completedBefore = [...(await readCompletedIds(config))];

  console.log("[reboot-simulate] stopping Commander (simulated reboot)...");
  const sent = await stopCommanderByPid(paths);
  if (!sent) throw new Error("Failed to stop Commander");

  const stopped = await waitForCommanderStopped(paths, STOP_WAIT_MS);
  if (!stopped) throw new Error("Commander did not stop within timeout");

  console.log("[reboot-simulate] starting Commander (simulated boot)...");
  const child = spawn("npm", ["run", "commander:start"], {
    cwd: RUNTIME_ROOT,
    detached: true,
    stdio: "ignore",
    env: TEST_ENV,
  });
  child.unref();

  const healthAfter = await waitForCommanderRunning(paths, START_WAIT_MS);
  if (!healthAfter) throw new Error("Commander failed to restart");

  const recoveryPath = join(paths.root, "last-recovery.json");
  let lastRecovery: Record<string, unknown> | null = null;
  if (existsSync(recoveryPath)) {
    lastRecovery = JSON.parse(await readFile(recoveryPath, "utf8")) as Record<string, unknown>;
  }

  const startupRecovery = healthAfter.startup_recovery as Record<string, unknown> | undefined;
  const pmAfter = await readPmTaskSnapshot();
  const devAfter = await readDeveloperState(config);
  const qaAfter = await readQaState(config);
  const completedAfter = await readCompletedIds(config);

  const taskPreserved =
    pmBefore.current_task_id === pmAfter.current_task_id
    && pmBefore.completed_count === pmAfter.completed_count
    && pmBefore.task_count === pmAfter.task_count;

  const noDuplicateCompletions =
    completedBefore.length === completedAfter.length
    && completedBefore.every((id) => completedAfter.includes(id));

  const devPreserved = devBefore.current_task_id === devAfter.current_task_id;
  const qaPreserved = qaBefore.current_task_id === qaAfter.current_task_id;

  const workersRunning = Array.isArray(healthAfter.workers)
    ? (healthAfter.workers as Array<{ status: string }>).filter((w) => w.status === "running").length
    : 0;

  const report = {
    simulated_at: new Date().toISOString(),
    commander_restarted: healthAfter.status === "running",
    workers_running: workersRunning,
    startup_recovery_recorded: Boolean(startupRecovery || lastRecovery),
    last_recovery: lastRecovery,
    startup_recovery: startupRecovery ?? null,
    task_preservation: { ok: taskPreserved, before: pmBefore, after: pmAfter },
    developer_preservation: { ok: devPreserved, before: devBefore, after: devAfter },
    qa_preservation: { ok: qaPreserved, before: qaBefore, after: qaAfter },
    no_duplicate_completions: noDuplicateCompletions,
    all_ok:
      taskPreserved
      && devPreserved
      && qaPreserved
      && noDuplicateCompletions
      && Boolean(startupRecovery || lastRecovery)
      && workersRunning >= 5,
  };

  console.log(JSON.stringify(report, null, 2));
  if (!report.all_ok) process.exit(1);
}

async function readCompletedIds(config: ReturnType<typeof loadConfig>): Promise<string[]> {
  const statePath = join(config.sosRoot, "07_LOGS", "pm", "state.json");
  if (!existsSync(statePath)) return [];
  const state = JSON.parse(await readFile(statePath, "utf8")) as { completed_task_ids: string[] };
  return state.completed_task_ids ?? [];
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
