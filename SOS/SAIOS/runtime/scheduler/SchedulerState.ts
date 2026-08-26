/**
 * Scheduler state — persisted for resume after interruption.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { SCHEDULER_ROOT } from "./SchedulerConfig.js";
import type { SchedulerRunState } from "./types.js";

const STATE_PATH = join(SCHEDULER_ROOT, "scheduler-state.json");

export function createSchedulerState(): SchedulerRunState {
  const now = new Date().toISOString();
  return {
    scheduler_id: `scheduler-${randomUUID().slice(0, 8)}`,
    started_at: now,
    updated_at: now,
    status: "running",
    last_tick_at: null,
    jobs_created_today: 0,
    jobs_completed_today: 0,
    jobs_failed_today: 0,
    resumes_this_hour: 0,
    hour_window_start: now,
    day_window_start: now,
    active_run_ids: [],
    interrupted_at: null,
    last_goal_runs: {},
  };
}

export function loadSchedulerState(): SchedulerRunState | null {
  if (!existsSync(STATE_PATH)) return null;
  try {
    return JSON.parse(readFileSync(STATE_PATH, "utf8")) as SchedulerRunState;
  } catch {
    return null;
  }
}

export function saveSchedulerState(state: SchedulerRunState, persist = true): void {
  state.updated_at = new Date().toISOString();
  if (persist) {
    mkdirSync(SCHEDULER_ROOT, { recursive: true });
    writeFileSync(STATE_PATH, JSON.stringify(state, null, 2));
  }
}

export function markInterrupted(state: SchedulerRunState): SchedulerRunState {
  return {
    ...state,
    status: "interrupted",
    interrupted_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

export function markResumed(state: SchedulerRunState): SchedulerRunState {
  return {
    ...state,
    status: "running",
    interrupted_at: null,
    updated_at: new Date().toISOString(),
  };
}
