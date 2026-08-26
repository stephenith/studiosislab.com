/**
 * Department SDK types — Agent #180.
 * Canonical contracts only. Never executes.
 */

export const DEPARTMENT_SDK_SCHEMA_VERSION = "department-sdk-1.0.0" as const;
export const DEPARTMENT_CONTRACT_VERSION = "department-contract-1.0.0" as const;
export const DEPARTMENT_REGISTRY_SNAPSHOT_VERSION =
  "department-registry-snapshot-1.0.0" as const;
export const DEPARTMENT_REGISTRY_HEALTH_VERSION =
  "department-registry-health-1.0.0" as const;

export const DEPARTMENT_SDK_SAFETY_FLAGS = {
  execution_allowed: false,
  dispatch_allowed: false,
  worker_spawn_allowed: false,
  queue_insert_allowed: false,
  provider_allowed: false,
  publishing_allowed: false,
  live_enabled: false,
  brain_router_allowed: false,
  skill_invocation_allowed: false,
} as const;

export type DepartmentSdkSafetyFlags = typeof DEPARTMENT_SDK_SAFETY_FLAGS;

export type DepartmentLifecycleStatus =
  | "REGISTERED"
  | "VALIDATED"
  | "READY"
  | "ACTIVE"
  | "PAUSED"
  | "DISABLED";

export type DepartmentType =
  | "production"
  | "growth"
  | "operations"
  | "governance"
  | "support"
  | "placeholder";

export type CapabilityKind =
  | "render"
  | "critique"
  | "research"
  | "planning"
  | "evaluation"
  | "packaging"
  | "thumbnail"
  | "learning"
  | "seo"
  | "publishing"
  | "finance"
  | "support"
  | "hr"
  | "legal"
  | "generic";

export type PolicyLocked = {
  enabled: false;
  note: string;
};

export type ExecutionPolicy = PolicyLocked & {
  may_execute: false;
  may_dispatch: false;
};

export type LearningPolicy = PolicyLocked;
export type EvaluationPolicy = PolicyLocked;
export type PublishingPolicy = PolicyLocked & { may_publish: false };
export type CostPolicy = PolicyLocked;
export type TelemetryPolicy = PolicyLocked;
export type RetryPolicy = PolicyLocked & {
  max_attempts: number;
  implemented: false;
};
export type RollbackPolicy = PolicyLocked & { implemented: false };

export type DepartmentCapabilityContract = {
  capability_id: string;
  capability_name: string;
  kind: CapabilityKind;
  version: string;
  provider_independent: true;
  description: string;
  inputs: string[];
  outputs: string[];
  /** Future only — never invoked in V1 */
  may_invoke_skills: false;
  may_call_brain_router: false;
  may_call_providers: false;
};

export type DepartmentWorkerContract = {
  worker_id: string;
  worker_type: string;
  version: string;
  health: "declared" | "unknown";
  capabilities: string[];
  inputs: string[];
  outputs: string[];
  dependencies: string[];
  description: string;
  /** Absolute: workers never reason/call providers/publish in V1 */
  may_reason_directly: false;
  may_call_providers: false;
  may_publish: false;
  may_execute: false;
};

export type DepartmentManagerContract = {
  manager_id: string;
  manager_name: string;
  version: string;
  owns: Array<
    | "worker_allocation"
    | "worker_grouping"
    | "batch_ownership"
    | "progress_reporting"
    | "retry_ownership"
  >;
  worker_ids: string[];
  description: string;
  may_execute: false;
  may_spawn_workers: false;
};

export type DepartmentDirectorContract = {
  director_id: string;
  director_name: string;
  version: string;
  owns: Array<
    | "planning"
    | "coordination"
    | "assignment"
    | "monitoring"
    | "reporting"
  >;
  manager_ids: string[];
  description: string;
  may_execute: false;
  may_spawn_workers: false;
  may_call_providers: false;
  may_publish: false;
};

export type DepartmentContract = {
  schema_version: typeof DEPARTMENT_CONTRACT_VERSION;
  department_id: string;
  department_name: string;
  department_type: DepartmentType;
  version: string;
  status: DepartmentLifecycleStatus;
  director: DepartmentDirectorContract;
  managers: DepartmentManagerContract[];
  workers: DepartmentWorkerContract[];
  capabilities: DepartmentCapabilityContract[];
  supported_missions: string[];
  supported_artifacts: string[];
  supported_tools: string[];
  supported_skills: string[];
  dependencies: string[];
  execution_policy: ExecutionPolicy;
  learning_policy: LearningPolicy;
  evaluation_policy: EvaluationPolicy;
  publishing_policy: PublishingPolicy;
  cost_policy: CostPolicy;
  telemetry_policy: TelemetryPolicy;
  retry_policy: RetryPolicy;
  rollback_policy: RollbackPolicy;
  reference: boolean;
  placeholder: boolean;
  safety_flags: DepartmentSdkSafetyFlags;
  registered_at: string;
  updated_at: string;
  next_safe_action: string;
  notes: string[];
};

export type DepartmentRegistrySnapshot = {
  schema_version: typeof DEPARTMENT_REGISTRY_SNAPSHOT_VERSION;
  updated_at: string;
  department_count: number;
  validated_count: number;
  ready_count: number;
  placeholder_count: number;
  reference_department_id: string | null;
  department_ids: string[];
  next_safe_action: string;
  safety_flags: DepartmentSdkSafetyFlags;
};

export type DepartmentRegistryHealth = {
  schema_version: typeof DEPARTMENT_REGISTRY_HEALTH_VERSION;
  updated_at: string;
  registered_count: number;
  validated_count: number;
  ready_count: number;
  active_count: number;
  paused_count: number;
  disabled_count: number;
  status: "idle" | "healthy" | "degraded";
  mode: "department_sdk_contracts_only";
  safety_flags: DepartmentSdkSafetyFlags;
  live: false;
};

export type DepartmentValidationIssue = {
  code: string;
  message: string;
  field?: string;
};

export type DepartmentValidationResult = {
  ok: boolean;
  errors: DepartmentValidationIssue[];
};

export type DepartmentSummary = {
  department_id: string;
  department_name: string;
  department_type: DepartmentType;
  version: string;
  status: DepartmentLifecycleStatus;
  director_id: string;
  manager_count: number;
  worker_count: number;
  capability_count: number;
  reference: boolean;
  placeholder: boolean;
  validation_ok: boolean;
};
