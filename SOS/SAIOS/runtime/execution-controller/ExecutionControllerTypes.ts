/**
 * Execution Controller types — Agent #179.
 * Scaffold only. Controller-local lifecycle. Never executes.
 */
export const EXECUTION_CONTROLLER_SCHEMA_VERSION =
  "execution-controller-1.0.0" as const;
export const EXECUTION_CONTROLLER_SNAPSHOT_VERSION =
  "execution-controller-snapshot-1.0.0" as const;
export const EXECUTION_CONTROLLER_HEALTH_VERSION =
  "execution-controller-health-1.0.0" as const;
export const EXECUTION_CONTROLLER_FOUNDER_ACTOR = "stephen" as const;
export const ARCHITECTURE_VERSION = "1.0.0-canonical-runtime-freeze" as const;
export const GOVERNANCE_VERSION = "phase2-certified-phase3-scaffold" as const;

/** Controller-local lifecycle — does NOT mutate MissionLifecycleStatus. */
export type ExecutionControllerLifecycleStatus =
  | "WAITING_EXECUTION_AUTHORIZATION"
  | "EXECUTION_AUTHORIZED"
  | "WAITING_EXECUTION_CONTROLLER"
  | "EXECUTION_CONTROLLER_READY"
  | "EXECUTION_CONTROLLER_BLOCKED";

export type ExecutionControllerSafetyFlags = {
  execution_allowed: false;
  dispatch_allowed: false;
  worker_spawn_allowed: false;
  queue_insert_allowed: false;
  provider_allowed: false;
  publishing_allowed: false;
  live_enabled: false;
  scheduler_allowed: false;
};

export const EXECUTION_CONTROLLER_SAFETY_FLAGS_LOCKED: ExecutionControllerSafetyFlags =
  {
    execution_allowed: false,
    dispatch_allowed: false,
    worker_spawn_allowed: false,
    queue_insert_allowed: false,
    provider_allowed: false,
    publishing_allowed: false,
    live_enabled: false,
    scheduler_allowed: false,
  };

export const EXECUTION_CONTROLLER_FORBIDDEN_KEYS = [
  "execute",
  "dispatch",
  "scheduler",
  "enqueue",
  "queue_insert",
  "spawn_worker",
  "worker_spawn",
  "provider",
  "publish",
  "enable_live",
  "activate_bridge",
] as const;

export type ExecutionChecksumChain = {
  submission_checksum: string;
  execution_package_checksum: string;
  acknowledgement_checksum: string;
  shadow_queue_checksum: string;
  plan_checksum: string;
  release_checksum: string;
  readiness_checksum: string;
  controller_checksum: string;
};

export type WorkerInventoryPlaceholder = {
  declared: string[];
  resolved: string[];
  missing: string[];
  informational: true;
  invoked: false;
};

export type TelemetryPlaceholder = {
  run_id: string | null;
  work_unit_ids: string[];
  metrics: Record<string, number>;
  enabled: false;
};

export type RollbackPlaceholder = {
  points: string[];
  implemented: false;
};

export type RetryPlaceholder = {
  policy: "exponential_backoff_capped";
  max_attempts: number;
  implemented: false;
};

export type ExecutionControllerRecord = {
  schema_version: typeof EXECUTION_CONTROLLER_SCHEMA_VERSION;
  controller_id: string;
  mission_id: string;
  mission_version: number;
  runtime_plan_id: string;
  runtime_release_id: string;
  system_readiness_id: string;
  department: string;
  architecture_version: string;
  governance_version: string;
  controller_status: ExecutionControllerLifecycleStatus;
  checksum_chain: ExecutionChecksumChain;
  worker_inventory: WorkerInventoryPlaceholder;
  estimated_cost_usd: number | null;
  estimated_duration_ms: number | null;
  telemetry: TelemetryPlaceholder;
  rollback: RollbackPlaceholder;
  retry: RetryPlaceholder;
  safety_flags: ExecutionControllerSafetyFlags;
  founder: string;
  created_at: string;
  updated_at: string;
  next_safe_action: string;
  fixture?: boolean;
};

export type ExecutionControllerSnapshot = {
  schema_version: typeof EXECUTION_CONTROLLER_SNAPSHOT_VERSION;
  updated_at: string;
  mission_id: string | null;
  controller_id: string | null;
  controller_status: ExecutionControllerLifecycleStatus | null;
  runtime_plan_id: string | null;
  runtime_release_id: string | null;
  system_readiness_id: string | null;
  plan_checksum: string | null;
  readiness_checksum: string | null;
  next_safe_action: string | null;
  pending: boolean;
  safety_flags: ExecutionControllerSafetyFlags;
};

export type ExecutionControllerHealth = {
  schema_version: typeof EXECUTION_CONTROLLER_HEALTH_VERSION;
  updated_at: string;
  pending_count: number;
  ready_count: number;
  blocked_count: number;
  record_count: number;
  status: "idle" | "healthy" | "degraded";
  mode: "controller_scaffold_only";
  safety_flags: ExecutionControllerSafetyFlags;
  live: false;
};

export type ExecutionControllerEvent = {
  event_id: string;
  event_type:
    | "CONTROLLER_OPENED"
    | "CONTROLLER_AUTHORIZED"
    | "CONTROLLER_READY"
    | "CONTROLLER_BLOCKED"
    | "CONTROLLER_REJECTED_INVALID";
  at: string;
  mission_id: string;
  controller_id: string | null;
  summary: string;
  fixture?: boolean;
};

export type ExecutionControllerHistoryEntry = {
  history_id: string;
  at: string;
  mission_id: string;
  from_status: ExecutionControllerLifecycleStatus | "SYSTEM_READY";
  to_status: ExecutionControllerLifecycleStatus;
  actor: string;
  reason: string;
  fixture?: boolean;
};

export type ExecutionControllerDecisionKind =
  | "APPROVE_CONTROLLER_SCAFFOLD"
  | "BLOCK_CONTROLLER_SCAFFOLD"
  | "REQUEST_CONTROLLER_CHANGES";

export type ExecutionControllerReviewInput = {
  mission_id: string;
  mission_version: number;
  controller_id?: string;
  decision: ExecutionControllerDecisionKind;
  actor: string;
  reason?: string;
  notes?: string;
  fixture?: boolean;
};

export type ExecutionControllerResult = {
  ok: boolean;
  record: ExecutionControllerRecord | null;
  mission_status: string | null;
  next_safe_action: string;
  error?: string;
  error_code?: string;
  duplicate?: boolean;
};
