/**
 * Workload manager — rate limits and resource protection.
 */
import { statfsSync } from "node:fs";
import type { SchedulerRunState, WorkloadLimits } from "./types.js";

export function canCreateJob(state: SchedulerRunState, limits: WorkloadLimits): { allowed: boolean; reason?: string } {
  resetWindows(state);

  if (state.active_run_ids.length >= limits.max_concurrent_runs) {
    return { allowed: false, reason: "Max concurrent runs reached" };
  }
  if (state.resumes_this_hour >= limits.max_resumes_per_hour) {
    return { allowed: false, reason: "Hourly limit reached" };
  }
  if (state.jobs_created_today >= limits.max_resumes_per_day) {
    return { allowed: false, reason: "Daily limit reached" };
  }

  const disk = checkDiskSpaceMb();
  if (disk < limits.min_disk_space_mb) {
    return { allowed: false, reason: `Low disk space: ${disk}MB free` };
  }

  return { allowed: true };
}

export function recordJobCreated(state: SchedulerRunState): SchedulerRunState {
  resetWindows(state);
  return {
    ...state,
    jobs_created_today: state.jobs_created_today + 1,
    resumes_this_hour: state.resumes_this_hour + 1,
    updated_at: new Date().toISOString(),
  };
}

export function recordJobCompleted(state: SchedulerRunState, success: boolean): SchedulerRunState {
  return {
    ...state,
    jobs_completed_today: success ? state.jobs_completed_today + 1 : state.jobs_completed_today,
    jobs_failed_today: success ? state.jobs_failed_today : state.jobs_failed_today + 1,
    updated_at: new Date().toISOString(),
  };
}

export function resetWindows(state: SchedulerRunState): void {
  const now = new Date();
  const hourStart = new Date(state.hour_window_start);
  if (now.getTime() - hourStart.getTime() > 3_600_000) {
    state.resumes_this_hour = 0;
    state.hour_window_start = now.toISOString();
  }
  const dayStart = new Date(state.day_window_start);
  if (now.getTime() - dayStart.getTime() > 86_400_000) {
    state.jobs_created_today = 0;
    state.jobs_completed_today = 0;
    state.jobs_failed_today = 0;
    state.day_window_start = now.toISOString();
  }
}

function checkDiskSpaceMb(): number {
  try {
    const stats = statfsSync("/");
    return Math.round((stats.bfree * stats.bsize) / (1024 * 1024));
  } catch {
    return 10_000;
  }
}
