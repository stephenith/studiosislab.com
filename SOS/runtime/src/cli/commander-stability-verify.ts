#!/usr/bin/env node
/**
 * Long-run stability verification — monitors Commander for stale-heartbeat kills,
 * duplicate workers, and restart count drift.
 */
import { spawn } from "node:child_process";
import { readFile, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { loadConfig } from "../config.js";
import { getCommanderPaths } from "../commander/paths.js";
import {
  isCommanderRunning,
  readCommanderHealth,
  stopCommanderByPid,
} from "../commander/supervisor.js";
import { countWorkerProcesses } from "../commander/process-table.js";
import { monitorWorkerHeartbeats } from "../commander/heartbeat-monitor.js";
import { readPmTaskSnapshot } from "../commander/production-audit.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const RUNTIME_ROOT = join(__dirname, "../..");

const DURATION_MS = parseInt(process.env.SOS_STABILITY_MINUTES ?? "30", 10) * 60_000;
const POLL_MS = parseInt(process.env.SOS_STABILITY_POLL_MS ?? "60000", 10);

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function runNpm(script: string, args: string[] = []): Promise<number> {
  return new Promise((resolve) => {
    const child = spawn("npm", ["run", script, "--", ...args], {
      cwd: RUNTIME_ROOT,
      stdio: "ignore",
      env: { ...process.env, SOS_NOTIFICATION_MODE: "mock" },
    });
    child.on("close", (code) => resolve(code ?? 1));
  });
}

type WorkerCounts = Record<string, number>;

function extractRestartCounts(health: Record<string, unknown> | null): WorkerCounts {
  const workers = (health?.workers as Array<{ id: string; restart_count: number; crash_count: number }>) ?? [];
  const out: WorkerCounts = {};
  for (const w of workers) {
    out[`${w.id}_restart`] = w.restart_count;
    out[`${w.id}_crash`] = w.crash_count;
  }
  return out;
}

function countStaleKills(health: Record<string, unknown> | null): number {
  const workers = (health?.workers as Array<{ last_exit_reason: string | null }>) ?? [];
  return workers.filter((w) => w.last_exit_reason === "heartbeat_timeout").length;
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
  const deadline = Date.now() + 45_000;
  while (Date.now() < deadline) {
    if ((await isCommanderRunning(paths)).running) {
      await sleep(10_000);
      return;
    }
    await sleep(500);
  }
  throw new Error("Commander failed to start");
}

async function main(): Promise<void> {
  process.env.SOS_NOTIFICATION_MODE = "mock";
  const config = loadConfig();
  const paths = getCommanderPaths(config);

  await ensureCommander(paths);

  const health0 = (await readCommanderHealth(paths)) as Record<string, unknown> | null;
  const restartCounts0 = extractRestartCounts(health0);
  const pmBefore = await readPmTaskSnapshot();
  const startedAt = Date.now();
  const samples: Array<Record<string, unknown>> = [];
  let staleKillEvents = 0;
  let maxHeartbeatAge: Record<string, number> = {};
  let activityIndex = 0;
  const activities = [
    () => runNpm("pm:plan-next"),
    () => runNpm("pm:status"),
    () => runNpm("pm:reprioritize-notify-verify"),
    () => runNpm("developer:status"),
    () => runNpm("qa:status"),
  ];

  console.log(`[stability] monitoring for ${DURATION_MS / 60_000} minutes...`);

  while (Date.now() - startedAt < DURATION_MS) {
    const health = (await readCommanderHealth(paths)) as Record<string, unknown> | null;
    const processCounts = countWorkerProcesses();
    const hb = await monitorWorkerHeartbeats(config);

    staleKillEvents = countStaleKills(health);

    for (const w of hb.workers) {
      const age = w.age_ms ?? 0;
      maxHeartbeatAge[w.worker_id] = Math.max(maxHeartbeatAge[w.worker_id] ?? 0, age);
    }

    const frozen = hb.frozen_workers.length > 0;
    const dup =
      processCounts.pm_processes_found > 1
      || processCounts.developer_processes_found > 1
      || processCounts.qa_processes_found > 1
      || processCounts.telegram_processes_found > 1
      || processCounts.dispatcher_processes_found > 1;

    samples.push({
      at: new Date().toISOString(),
      elapsed_min: Math.floor((Date.now() - startedAt) / 60_000),
      process_counts: processCounts,
      frozen_workers: hb.frozen_workers,
      unhealthy_workers: hb.unhealthy_workers,
      heartbeat_levels: Object.fromEntries(hb.workers.map((w) => [w.worker_id, w.level])),
      restart_counts: extractRestartCounts(health),
      stale_kill_events: staleKillEvents,
    });

    if (frozen || dup) {
      console.error(`[stability] FAIL frozen=${frozen} dup=${dup}`, samples[samples.length - 1]);
      break;
    }

    if (activityIndex < activities.length && samples.length % 3 === 0) {
      const act = activities[activityIndex++];
      console.log(`[stability] activity ${activityIndex}/${activities.length}`);
      await act();
    }

    await sleep(POLL_MS);
  }

  const healthFinal = (await readCommanderHealth(paths)) as Record<string, unknown> | null;
  const restartCountsFinal = extractRestartCounts(healthFinal);
  const pmAfter = await readPmTaskSnapshot();
  const processFinal = countWorkerProcesses();

  const restartDrift = Object.keys(restartCounts0).some(
    (k) => (restartCountsFinal[k] ?? 0) > (restartCounts0[k] ?? 0),
  );

  const taskPreserved =
    pmBefore.current_task_id === pmAfter.current_task_id
    && pmBefore.task_count === pmAfter.task_count
    && pmBefore.completed_count === pmAfter.completed_count;

  const report = {
    verified_at: new Date().toISOString(),
    duration_minutes: DURATION_MS / 60_000,
    samples_collected: samples.length,
    restart_counts_before: restartCounts0,
    restart_counts_after: restartCountsFinal,
    restart_count_unchanged: !restartDrift,
    stale_heartbeat_kills: staleKillEvents,
    max_heartbeat_age_ms: maxHeartbeatAge,
    task_preservation: { ok: taskPreserved, before: pmBefore, after: pmAfter },
    final_process_counts: processFinal,
    single_instance_ok:
      processFinal.pm_processes_found <= 1
      && processFinal.developer_processes_found <= 1
      && processFinal.qa_processes_found <= 1
      && processFinal.telegram_processes_found <= 1
      && processFinal.dispatcher_processes_found <= 1,
    samples,
    all_ok:
      !restartDrift
      && staleKillEvents === 0
      && taskPreserved
      && processFinal.pm_processes_found <= 1
      && processFinal.developer_processes_found <= 1
      && processFinal.qa_processes_found <= 1
      && processFinal.telegram_processes_found <= 1
      && processFinal.dispatcher_processes_found <= 1,
    runtime_stability_complete: false,
  };

  report.runtime_stability_complete = report.all_ok;

  console.log(JSON.stringify(report, null, 2));
  if (!report.all_ok) process.exit(1);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
