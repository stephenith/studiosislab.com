/**
 * SAIOS Runtime Loop — types
 */

import type { IsoTimestamp } from "./shared/types.js";

export type RuntimeStatus = "starting" | "running" | "idle" | "degraded" | "stopped";

export type RuntimeHeartbeatSnapshot = {
  status: RuntimeStatus;
  started_at: IsoTimestamp;
  uptime_ms: number;
  jobs_completed: number;
  jobs_running: number;
  jobs_queued: number;
  workers_online: number;
  workers_busy: number;
  last_cycle_at: IsoTimestamp | null;
  cycle_count: number;
};

export type RuntimePersistedState = {
  status: RuntimeStatus;
  started_at: IsoTimestamp;
  updated_at: IsoTimestamp;
  uptime_ms: number;
  cycle_count: number;
  jobs_completed: number;
  jobs_running: number;
  jobs_queued: number;
  workers_online: number;
  workers_busy: number;
  last_cycle_at: IsoTimestamp | null;
  last_errors: string[];
  heartbeat: RuntimeHeartbeatSnapshot;
};

export type RuntimeCycleResult = {
  cycle: number;
  assignments: number;
  executed: number;
  completed: number;
  errors: string[];
  at: IsoTimestamp;
};

export type RuntimeRunSummary = {
  cycles: number;
  jobs_completed: number;
  jobs_failed: number;
  errors: string[];
  finished_at: IsoTimestamp;
};

export type CursorExecutorLike = {
  execute(job: import("./queue/types.js").SaiosJob): Promise<{
    job: import("./queue/types.js").SaiosJob;
    outcome: { ok: boolean; report_path: string; error: string | null };
    report_written: boolean;
  }>;
};
