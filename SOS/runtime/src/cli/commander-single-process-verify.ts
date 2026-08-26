#!/usr/bin/env node
/**
 * Verifies exactly one instance of each runtime worker via OS process table.
 * Runs Commander lifecycle tests when Commander is available.
 */
import { spawn } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { loadConfig } from "../config.js";
import { getCommanderPaths } from "../commander/paths.js";
import {
  isCommanderRunning,
  readCommanderHealth,
  stopCommanderByPid,
  killWorkerForTest,
} from "../commander/supervisor.js";
import { countWorkerProcesses, scanWorkerProcesses } from "../commander/process-table.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const RUNTIME_ROOT = join(__dirname, "../..");

const EXPECTED_MAX = {
  pm: 1,
  developer: 1,
  qa: 1,
  telegram: 1,
  dispatcher: 1,
} as const;

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function assertCounts(label: string, counts: ReturnType<typeof countWorkerProcesses>): string[] {
  const failures: string[] = [];
  if (counts.pm_processes_found > EXPECTED_MAX.pm) {
    failures.push(`${label}: PM=${counts.pm_processes_found} (expected ≤${EXPECTED_MAX.pm})`);
  }
  if (counts.developer_processes_found > EXPECTED_MAX.developer) {
    failures.push(
      `${label}: Developer=${counts.developer_processes_found} (expected ≤${EXPECTED_MAX.developer})`,
    );
  }
  if (counts.qa_processes_found > EXPECTED_MAX.qa) {
    failures.push(`${label}: QA=${counts.qa_processes_found} (expected ≤${EXPECTED_MAX.qa})`);
  }
  if (counts.telegram_processes_found > EXPECTED_MAX.telegram) {
    failures.push(
      `${label}: Telegram=${counts.telegram_processes_found} (expected ≤${EXPECTED_MAX.telegram})`,
    );
  }
  if (counts.dispatcher_processes_found > EXPECTED_MAX.dispatcher) {
    failures.push(
      `${label}: Dispatcher=${counts.dispatcher_processes_found} (expected ≤${EXPECTED_MAX.dispatcher})`,
    );
  }
  return failures;
}

async function runNpmScript(
  script: string,
  args: string[] = [],
  env: NodeJS.ProcessEnv = process.env,
): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const child = spawn("npm", ["run", script, "--", ...args], {
      cwd: RUNTIME_ROOT,
      env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout?.on("data", (c: Buffer) => {
      stdout += c.toString();
    });
    child.stderr?.on("data", (c: Buffer) => {
      stderr += c.toString();
    });
    child.on("close", (code) => resolve({ code: code ?? 1, stdout, stderr }));
  });
}

async function ensureCommander(paths: ReturnType<typeof getCommanderPaths>): Promise<void> {
  const { running } = await isCommanderRunning(paths);
  if (running) return;
  const child = spawn("npm", ["run", "commander:start"], {
    cwd: RUNTIME_ROOT,
    detached: true,
    stdio: "ignore",
    env: process.env,
  });
  child.unref();
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    const { running: now } = await isCommanderRunning(paths);
    if (now) {
      await sleep(8000);
      return;
    }
    await sleep(500);
  }
  throw new Error("Commander failed to start");
}

async function main(): Promise<void> {
  const config = loadConfig();
  const paths = getCommanderPaths(config);
  const results: Array<{ step: string; ok: boolean; counts: ReturnType<typeof countWorkerProcesses>; failures: string[] }> = [];

  const record = (step: string) => {
    const counts = countWorkerProcesses();
    const failures = assertCounts(step, counts);
    results.push({ step, ok: failures.length === 0, counts, failures });
    console.log(`[verify] ${step}: PM=${counts.pm_processes_found} Dev=${counts.developer_processes_found} QA=${counts.qa_processes_found} TG=${counts.telegram_processes_found} Disp=${counts.dispatcher_processes_found}`);
    if (failures.length > 0) {
      for (const f of failures) console.error(`  FAIL: ${f}`);
    }
  };

  await ensureCommander(paths);
  record("after_commander_start");

  const dupWhileRunning = await runNpmScript("pm:run", ["--once", "--dry-run"]);
  const lockBlockedWhileCommander =
    dupWhileRunning.code !== 0
    && (dupWhileRunning.stderr.includes("already running") || dupWhileRunning.stdout.includes("already running"));
  console.log(`[verify] duplicate pm:run blocked while Commander up: ${lockBlockedWhileCommander}`);

  // Crash test PM
  const health = (await readCommanderHealth(paths)) as Record<string, unknown> | null;
  const kill = killWorkerForTest(health ?? {}, "pm");
  if (kill.killed) {
    await sleep(5000);
    record("after_pm_crash_restart");
  }

  // plan-next (one-shot, not a loop)
  await runNpmScript("pm:plan-next");
  record("after_plan_next");

  // Graceful stop + restart
  await stopCommanderByPid(paths);
  const stopDeadline = Date.now() + 120_000;
  while (Date.now() < stopDeadline) {
    const { running } = await isCommanderRunning(paths);
    if (!running) break;
    await sleep(500);
  }
  await sleep(2000);
  record("after_graceful_stop");

  await ensureCommander(paths);
  record("after_commander_restart");

  // Reboot simulate via npm script (stop + start)
  await runNpmScript("commander:reboot-simulate");
  await sleep(3000);
  record("after_reboot_simulate");

  const processes = scanWorkerProcesses();
  const allOk = results.every((r) => r.ok) && lockBlockedWhileCommander;

  const report = {
    verified_at: new Date().toISOString(),
    lock_duplicate_blocked_while_commander: lockBlockedWhileCommander,
    steps: results,
    processes,
    all_ok: allOk,
    single_process_guarantee_complete: allOk,
  };

  console.log(JSON.stringify(report, null, 2));
  if (!allOk) process.exit(1);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
