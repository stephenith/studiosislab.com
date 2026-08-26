/**
 * Worker Runtime types — Agent #182.
 * Contracts only. Never spawns. Never executes.
 */

export const WORKER_RUNTIME_SCHEMA_VERSION = "worker-runtime-1.0.0" as const;
export const WORKER_SESSION_SCHEMA_VERSION = "worker-session-1.0.0" as const;
export const WORKER_ASSIGNMENT_SCHEMA_VERSION =
  "worker-assignment-1.0.0" as const;
export const WORKER_RUNTIME_SNAPSHOT_VERSION =
  "worker-runtime-snapshot-1.0.0" as const;
export const WORKER_RUNTIME_HEALTH_VERSION =
  "worker-runtime-health-1.0.0" as const;

export const WORKER_RUNTIME_SAFETY_FLAGS = {
  execution_allowed: false,
  dispatch_allowed: false,
  worker_spawn_allowed: false,
  child_process_allowed: false,
  queue_insert_allowed: false,
  scheduler_allowed: false,
  provider_allowed: false,
  publishing_allowed: false,
  live_enabled: false,
} as const;

export type WorkerRuntimeSafetyFlags = typeof WORKER_RUNTIME_SAFETY_FLAGS;

export type WorkerRuntimeLifecycleStatus =
  | "REGISTERED"
  | "ASSIGNED"
  | "READY"
  | "WAITING_CONTROLLER"
  | "CONTROLLER_AUTHORIZED"
  | "STOPPED";

export type WorkerCapabilityKind =
  | "render"
  | "research"
  | "critique"
  | "evaluation"
  | "packaging"
  | "learning"
  | "planning"
  | "generic";

export type WorkerDependencyEdge = {
  kind:
    | "parent"
    | "child"
    | "blocking"
    | "parallel"
    | "optional";
  worker_id: string;
  note: string;
};

export type WorkerRuntimeChecksums = {
  runtime_checksum: string;
  assignment_checksum: string | null;
  session_checksum: string | null;
  cost_session_ref: string | null;
  controller_ref: string | null;
};

export type WorkerRuntimeContract = {
  schema_version: typeof WORKER_RUNTIME_SCHEMA_VERSION;
  worker_runtime_id: string;
  worker_id: string;
  department_id: string;
  mission_id: string;
  execution_controller_id: string | null;
  worker_type: string;
  capabilities: string[];
  dependencies: WorkerDependencyEdge[];
  estimated_cost: number | null;
  estimated_duration_ms: number | null;
  telemetry_reference: string | null;
  cost_session_reference: string | null;
  status: WorkerRuntimeLifecycleStatus;
  checksums: WorkerRuntimeChecksums;
  version: string;
  safety_flags: WorkerRuntimeSafetyFlags;
  created_at: string;
  updated_at: string;
  next_safe_action: string;
  notes: string[];
  fixture?: boolean;
};

export type WorkerSessionContract = {
  schema_version: typeof WORKER_SESSION_SCHEMA_VERSION;
  session_id: string;
  assignment_id: string | null;
  department_id: string;
  worker_id: string;
  mission_id: string;
  runtime_plan_id: string | null;
  runtime_release_id: string | null;
  system_readiness_id: string | null;
  execution_controller_id: string | null;
  worker_runtime_id: string | null;
  activated: false;
  safety_flags: WorkerRuntimeSafetyFlags;
  created_at: string;
  updated_at: string;
  notes: string[];
  fixture?: boolean;
};

export type WorkerAssignmentContract = {
  schema_version: typeof WORKER_ASSIGNMENT_SCHEMA_VERSION;
  assignment_id: string;
  director_id: string | null;
  manager_id: string | null;
  worker_id: string;
  department_id: string;
  mission_id: string;
  priority: "low" | "normal" | "high" | "critical";
  dependency_order: number;
  estimated_start: string | null;
  estimated_finish: string | null;
  retry_policy_reference: string | null;
  rollback_reference: string | null;
  assignment_checksum: string;
  safety_flags: WorkerRuntimeSafetyFlags;
  created_at: string;
  updated_at: string;
  notes: string[];
  fixture?: boolean;
};

export type WorkerExecutionPlanPlaceholder = {
  plan_id: string;
  worker_runtime_ids: string[];
  topological_order: string[];
  scheduled: false;
  note: string;
};

export type WorkerRuntimeSnapshot = {
  schema_version: typeof WORKER_RUNTIME_SNAPSHOT_VERSION;
  updated_at: string;
  runtime_count: number;
  assignment_count: number;
  session_count: number;
  authorized_count: number;
  latest_runtime_id: string | null;
  next_safe_action: string;
  safety_flags: WorkerRuntimeSafetyFlags;
};

export type WorkerRuntimeHealth = {
  schema_version: typeof WORKER_RUNTIME_HEALTH_VERSION;
  updated_at: string;
  runtime_count: number;
  assignment_count: number;
  session_count: number;
  status: "idle" | "healthy" | "degraded";
  mode: "worker_runtime_contracts_only";
  worker_spawn: false;
  safety_flags: WorkerRuntimeSafetyFlags;
  live: false;
};

export type WorkerRuntimeValidationIssue = {
  code: string;
  message: string;
  field?: string;
};

export type WorkerRuntimeValidationResult = {
  ok: boolean;
  errors: WorkerRuntimeValidationIssue[];
};

export type WorkerRuntimeSummary = {
  worker_runtime_id: string;
  worker_id: string;
  department_id: string;
  mission_id: string;
  status: WorkerRuntimeLifecycleStatus;
  capability_count: number;
  dependency_count: number;
  cost_session_reference: string | null;
  telemetry_reference: string | null;
  validation_ok: boolean;
};
