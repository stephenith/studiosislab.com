/**
 * Runtime Loop — shared types.
 * AGENT #109 — continuous orchestration only
 */

export type LoopMode = "dry_run" | "live";

export type DiscoveredDepartment = {
  id: string;
  label: string;
  module_path: string;
  verify_command: string | null;
  available: boolean;
  source: "runtime-manager" | "runtime-health" | "deployment-plan";
};

export type DepartmentHealth = {
  id: string;
  health: "ok" | "degraded" | "failed" | "unknown";
  available: boolean;
  detail: string;
};

export type RecoveryAttempt = {
  at: string;
  department_id: string;
  action: "restart" | "escalate";
  success: boolean;
  dry_run: boolean;
  reason: string;
  event_published?: string;
};

export type CycleStepResult = {
  step: number;
  name: string;
  ok: boolean;
  detail: string;
  duration_ms: number;
};

export type RuntimeCycleResult = {
  cycle: number;
  started_at: string;
  finished_at: string;
  mode: LoopMode;
  steps: CycleStepResult[];
  health: DepartmentHealth[];
  recoveries: RecoveryAttempt[];
  events_published: number;
  heartbeat_at: string;
  scheduler_tick_at: string | null;
  dashboard_refresh_at: string | null;
};

export type RuntimeLoopResult = {
  generated_at: string;
  status: "READY" | "DEGRADED" | "BLOCKED";
  mode: LoopMode;
  uptime_ms: number;
  cycle_count: number;
  departments: DiscoveredDepartment[];
  last_cycle: RuntimeCycleResult | null;
  recoveries: RecoveryAttempt[];
  checks: Record<string, boolean>;
  output_dir: string;
};

export type LoopConfiguration = {
  version: string;
  runtime_interval_ms: number;
  heartbeat_interval_ms: number;
  dashboard_interval_ms: number;
  health_interval_ms: number;
  scheduler_interval_ms: number;
  notification_interval_ms: number;
  dry_run: boolean;
  max_cycles: number | null;
  max_runtime_ms: number | null;
  startup_timeout_ms: number;
  shutdown_timeout_ms: number;
  sleep_ms_override: number | null;
};
