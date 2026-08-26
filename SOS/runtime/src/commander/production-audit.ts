/**
 * Read-only production audit of SOS runtime workers.
 * Does not modify state, logs, or active work.
 */
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { loadConfig } from "../config.js";
import { getCommanderPaths } from "./paths.js";
import { isCommanderRunning, readCommanderHealth } from "./supervisor.js";
import { COMMANDER_WORKERS } from "./workers.js";
import { loadPipelineStatus } from "./pipeline-status.js";
import { recoverStaleLocks } from "./lock-recovery.js";
import { readAgentHeartbeats } from "./agent-heartbeat.js";

export type WorkerAudit = {
  id: string;
  name: string;
  script: string;
  depends_on: string[];
  commander_status: string | null;
  pid: number | null;
  crash_count: number;
  restart_count: number;
  last_heartbeat: string | null;
  agent_heartbeat: string | null;
  agent_stale: boolean;
  checks: string[];
};

export type ProductionAudit = {
  audited_at: string;
  commander_running: boolean;
  commander_pid: number | null;
  uptime_seconds: number | null;
  pipeline: Awaited<ReturnType<typeof loadPipelineStatus>>;
  lock_recovery_dry_run: Awaited<ReturnType<typeof recoverStaleLocks>>;
  workers: WorkerAudit[];
  strengths: string[];
  gaps: string[];
};

export async function runProductionAudit(): Promise<ProductionAudit> {
  const config = loadConfig();
  const paths = getCommanderPaths(config);
  const { running, pid } = await isCommanderRunning(paths);
  const health = (await readCommanderHealth(paths)) as Record<string, unknown> | null;
  const pipeline = await loadPipelineStatus(config);
  const lockRecovery = await recoverStaleLocks(config, { dryRun: true });
  const agentHeartbeats = await readAgentHeartbeats(config, 120_000);

  const healthWorkers =
    (health?.workers as Array<Record<string, unknown>> | undefined) ?? [];

  const workers: WorkerAudit[] = COMMANDER_WORKERS.map((def) => {
    const hw = healthWorkers.find((w) => w.id === def.id);
    const agent = agentHeartbeats.find((h) => h.worker_id === def.id);
    const checks: string[] = [];

    if (hw?.status === "running" && hw.pid) checks.push("process running under commander");
    if ((hw?.restart_count as number) > 0) checks.push("restart history present");
    if (agent?.last_heartbeat) checks.push("agent status heartbeat file present");
    if (existsSync(join(RUNTIME_ROOT(config), def.script))) checks.push("entry script exists");

    return {
      id: def.id,
      name: def.name,
      script: def.script,
      depends_on: def.depends_on ?? [],
      commander_status: (hw?.status as string) ?? null,
      pid: (hw?.pid as number) ?? null,
      crash_count: (hw?.crash_count as number) ?? 0,
      restart_count: (hw?.restart_count as number) ?? 0,
      last_heartbeat: (hw?.last_heartbeat as string) ?? null,
      agent_heartbeat: agent?.last_heartbeat ?? null,
      agent_stale: agent?.stale ?? false,
      checks,
    };
  });

  const strengths: string[] = [
    "Commander supervises PM, Developer, QA, Approvals, Telegram, Dispatcher",
    "Automatic crash restart with persisted restart-history.jsonl",
    "Stale lock recovery on commander start (developer + QA locks)",
    "PM/Developer/QA loops recover from transient errors without exiting",
    "Duplicate prevention via processed_verification_keys, notified_backlog_ids, claim locks",
    "Pipeline status exposed in commander health + commander:status",
  ];

  const gaps: string[] = [];
  if (!running) gaps.push("Commander not currently running — workers are not supervised");
  if (lockRecovery.total_removed > 0) {
    gaps.push(
      `${lockRecovery.total_removed} stale lock(s) would be removed on next commander start`,
    );
  }
  for (const w of workers) {
    if (w.agent_stale) gaps.push(`Agent heartbeat stale for ${w.id}`);
    if (running && w.commander_status !== "running") {
      gaps.push(`Worker ${w.id} not in running state`);
    }
  }
  if (!existsSync(join(config.sosRoot, "07_LOGS", "commander", "restart-history.jsonl"))) {
    gaps.push("No restart history yet — crash recovery not exercised in this environment");
  }

  return {
    audited_at: new Date().toISOString(),
    commander_running: running,
    commander_pid: pid,
    uptime_seconds: (health?.uptime_seconds as number) ?? null,
    pipeline,
    lock_recovery_dry_run: lockRecovery,
    workers,
    strengths,
    gaps,
  };
}

function RUNTIME_ROOT(config: ReturnType<typeof loadConfig>): string {
  return join(config.sosRoot, "runtime");
}

export async function readPmTaskSnapshot(): Promise<{
  current_task_id: string | null;
  task_count: number;
  completed_count: number;
}> {
  const config = loadConfig();
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
