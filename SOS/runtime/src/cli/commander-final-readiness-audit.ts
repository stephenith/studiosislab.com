#!/usr/bin/env node
/**
 * Final production readiness audit — read-only checks across all runtime subsystems.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { loadConfig } from "../config.js";
import { getCommanderPaths } from "../commander/paths.js";
import { isCommanderRunning, readCommanderHealth } from "../commander/supervisor.js";
import { countWorkerProcesses } from "../commander/process-table.js";
import { monitorWorkerHeartbeats } from "../commander/heartbeat-monitor.js";
import { getRuntimeFreezeInfo, RUNTIME_FROZEN } from "../runtime/version.js";
import { readPmTaskSnapshot } from "../commander/production-audit.js";
import { getPmPaths } from "../pm/paths.js";
import { loadState } from "../pm/state.js";
import { classifyTaskScope } from "../pm/runtime-guard.js";

async function runVerifyScript(script: string): Promise<{ ok: boolean; script: string }> {
  const { spawn } = await import("node:child_process");
  const runtimeRoot = join(import.meta.dirname, "../..");
  return new Promise((resolve) => {
    const child = spawn("npm", ["run", script], {
      cwd: runtimeRoot,
      stdio: "ignore",
      env: { ...process.env, SOS_NOTIFICATION_MODE: "mock" },
    });
    child.on("close", (code) => resolve({ ok: code === 0, script }));
  });
}

async function main(): Promise<void> {
  process.env.SOS_NOTIFICATION_MODE = "mock";
  const config = loadConfig();
  const paths = getCommanderPaths(config);
  const pmPaths = getPmPaths(config);
  const { running } = await isCommanderRunning(paths);
  const health = (await readCommanderHealth(paths)) as Record<string, unknown> | null;
  const processCounts = countWorkerProcesses();
  const heartbeat = await monitorWorkerHeartbeats(config);
  const freeze = getRuntimeFreezeInfo();
  const pmSnapshot = await readPmTaskSnapshot();
  const pmState = await loadState(pmPaths);

  const ledgerPath = join(config.logsRoot, "notifications", "ledger.jsonl");
  const ledgerExists = existsSync(ledgerPath);
  const ledgerLines = ledgerExists
    ? readFileSync(ledgerPath, "utf8").split("\n").filter(Boolean).length
    : 0;

  const verifyScripts = [
    "pm:reprioritize-notify-verify",
    "pm:score-verify",
    "pm:roadmap-verify",
  ];

  const verifyResults: Array<{ script: string; ok: boolean }> = [];
  for (const script of verifyScripts) {
    verifyResults.push(await runVerifyScript(script));
  }

  const singleInstance =
    processCounts.pm_processes_found <= 1
    && processCounts.developer_processes_found <= 1
    && processCounts.qa_processes_found <= 1
    && processCounts.telegram_processes_found <= 1
    && processCounts.dispatcher_processes_found <= 1;

  const heartbeatStable = heartbeat.frozen_workers.length === 0
    && heartbeat.workers.every((w) => w.level === "healthy" || w.level === "late");

  const checks = {
    commander_running: running,
    single_instance: singleInstance,
    heartbeat_stable: heartbeatStable,
    runtime_frozen: RUNTIME_FROZEN,
    notification_ledger: ledgerExists,
    task_preservation: pmSnapshot.current_task_id !== null,
    queue_intact: pmState.task_queue.length > 0,
    no_duplicate_pause_records: (pmState.paused_tasks?.length ?? 0) <= 5,
    verify_scripts_pass: verifyResults.every((v) => v.ok),
  };

  const score = Object.values(checks).filter(Boolean).length / Object.keys(checks).length;

  const report = {
    audited_at: new Date().toISOString(),
    runtime_freeze: freeze,
    process_counts: processCounts,
    heartbeat_monitor: heartbeat,
    pm_snapshot: pmSnapshot,
    notification_ledger_lines: ledgerLines,
    verify_results: verifyResults,
    checks,
    readiness_score_pct: Math.round(score * 100),
    runtime_frozen_recommended: score >= 0.85 && RUNTIME_FROZEN,
    health_summary: health?.status ?? null,
    instance_health: health?.instance_health ?? null,
  };

  console.log(JSON.stringify(report, null, 2));
  if (!checks.verify_scripts_pass || !singleInstance) process.exit(1);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
