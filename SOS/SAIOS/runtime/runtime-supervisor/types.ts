/**
 * Runtime Supervisor — shared types.
 * AGENT #110 — parent watchdog for Runtime Loop
 */

export type SupervisorMode = "dry_run" | "live";

export type HeartbeatStatus = {
  at: string;
  heartbeat_at: string | null;
  age_ms: number | null;
  stale: boolean;
  source: string;
};

export type FailureFinding = {
  id: string;
  area: string;
  severity: "warning" | "critical";
  title: string;
  detail: string;
};

export type RestartRecord = {
  at: string;
  target: "runtime-loop" | "department" | "scheduler";
  target_id: string;
  success: boolean;
  dry_run: boolean;
  reason: string;
  event_published?: string;
};

export type RecoveryRecord = {
  at: string;
  action:
    | "restart_runtime_loop"
    | "restart_department"
    | "restart_scheduler"
    | "clear_stale_heartbeat"
    | "reset_health_cache";
  success: boolean;
  dry_run: boolean;
  detail: string;
};

export type FounderAction = {
  id: string;
  priority: "P0" | "P1" | "P2";
  title: string;
  detail: string;
  source: string;
  send: false;
};

export type SupervisorConfiguration = {
  version: string;
  dry_run: boolean;
  max_cycles: number | null;
  max_runtime_ms: number | null;
  heartbeat_timeout_ms: number;
  cycle_age_timeout_ms: number;
  restart_cooldown_ms: number;
  max_restart_attempts: number;
  max_recovery_attempts: number;
  startup_timeout_ms: number;
  shutdown_timeout_ms: number;
  morning_digest_max_age_ms: number;
  evening_digest_max_age_ms: number;
  fcc_freshness_ms: number;
  notification_freshness_ms: number;
  website_freshness_ms: number;
};

export type SupervisorResult = {
  generated_at: string;
  status: "READY" | "DEGRADED" | "BLOCKED";
  mode: SupervisorMode;
  heartbeat: HeartbeatStatus;
  failures: FailureFinding[];
  restarts: RestartRecord[];
  recoveries: RecoveryRecord[];
  founder_actions: FounderAction[];
  events_published: string[];
  loop_supervised: boolean;
  checks: Record<string, boolean>;
  output_dir: string;
};
