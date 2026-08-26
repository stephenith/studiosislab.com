/**
 * Live Runtime — shared types.
 * AGENT #111 — Safe Live Mode & Continuity
 */

export type RuntimeMode = "VERIFY" | "DRY_RUN" | "LIVE";

export type GateCheck = {
  id: string;
  label: string;
  pass: boolean;
  detail: string;
};

export type FounderGateResult = {
  approved: boolean;
  live_flag: boolean;
  checks: GateCheck[];
  reason: string;
};

export type RuntimeCaps = {
  maximum_runtime_ms: number | null;
  maximum_cycle_count: number | null;
  maximum_restart_attempts: number;
  maximum_recovery_attempts: number;
  heartbeat_timeout_ms: number;
  shutdown_timeout_ms: number;
  startup_timeout_ms: number;
};

export type ContinuityStep = {
  step: number;
  name: string;
  ok: boolean;
  detail: string;
};

export type LiveRuntimeSession = {
  session_id: string;
  started_at: string;
  finished_at: string | null;
  requested_mode: RuntimeMode;
  effective_mode: RuntimeMode;
  cycles_completed: number;
  shutdown_reason: string | null;
};

export type LiveRuntimeResult = {
  generated_at: string;
  status: "READY" | "DEGRADED" | "BLOCKED";
  requested_mode: RuntimeMode;
  effective_mode: RuntimeMode;
  gate: FounderGateResult;
  caps: RuntimeCaps;
  session: LiveRuntimeSession;
  continuity: ContinuityStep[];
  checks: Record<string, boolean>;
  output_dir: string;
};
