/**
 * Activation Gate types — Agent #185.
 * Eligibility contracts only. Never enables execution.
 */

export const ACTIVATION_GATE_SCHEMA_VERSION = "activation-gate-1.0.0" as const;
export const ACTIVATION_ELIGIBILITY_SCHEMA_VERSION =
  "activation-eligibility-1.0.0" as const;
export const ACTIVATION_CERTIFICATE_SCHEMA_VERSION =
  "activation-certificate-1.0.0" as const;
export const ACTIVATION_CHECKLIST_VERSION =
  "activation-checklist-1.0.0" as const;
export const ACTIVATION_SNAPSHOT_VERSION =
  "activation-gate-snapshot-1.0.0" as const;
export const ACTIVATION_HEALTH_VERSION = "activation-gate-health-1.0.0" as const;
export const ARCHITECTURE_VERSION = "1.0.0-canonical-runtime-freeze" as const;

export const ACTIVATION_GATE_SAFETY_FLAGS = {
  execution_allowed: false,
  dispatch_allowed: false,
  worker_spawn_allowed: false,
  queue_insert_allowed: false,
  provider_allowed: false,
  publishing_allowed: false,
  live_enabled: false,
  scheduler_allowed: false,
  activation_enables_execution: false,
} as const;

export type ActivationGateSafetyFlags = typeof ACTIVATION_GATE_SAFETY_FLAGS;

/** Lifecycle: CREATED → CHECKING → ACTIVATION_BLOCKED | ACTIVATION_ELIGIBLE → STOP */
export type ActivationLifecycleStatus =
  | "CREATED"
  | "CHECKING"
  | "ACTIVATION_BLOCKED"
  | "ACTIVATION_ELIGIBLE"
  | "STOP";

export type ActivationCheckId =
  | "system_readiness_valid"
  | "runtime_release_approved"
  | "runtime_plan_valid"
  | "execution_controller_ready"
  | "department_registered"
  | "department_validated"
  | "worker_runtime_valid"
  | "cost_session_valid"
  | "telemetry_attached"
  | "rollback_defined"
  | "retry_policy_defined"
  | "provider_registry_validated"
  | "execution_authorization_present"
  | "founder_approval_present"
  | "architecture_versions_match"
  | "checksum_chain_valid"
  | "live_disabled";

export type ActivationCheckResultStatus =
  | "pass"
  | "fail"
  | "warn"
  | "placeholder";

export type ActivationChecklistItem = {
  check_id: ActivationCheckId;
  label: string;
  required: boolean;
  status: ActivationCheckResultStatus;
  detail: string;
  blocking: boolean;
};

export type ActivationScoreDimension =
  | "governance"
  | "execution"
  | "department"
  | "workers"
  | "budget"
  | "telemetry"
  | "providers"
  | "security"
  | "rollback"
  | "retry"
  | "overall";

export type ActivationScorecard = Record<ActivationScoreDimension, number>;

export type ActivationChecksums = {
  eligibility_checksum: string;
  checklist_checksum: string;
  certificate_checksum: string | null;
};

export type ActivationEligibilityContract = {
  schema_version: typeof ACTIVATION_ELIGIBILITY_SCHEMA_VERSION;
  activation_id: string;
  mission_id: string;
  controller_id: string | null;
  checklist: ActivationChecklistItem[];
  score: ActivationScorecard;
  blocking_items: string[];
  warnings: string[];
  recommendations: string[];
  status: ActivationLifecycleStatus;
  /** Final eligibility outcome — preserved after STOP. */
  outcome: "ACTIVATION_BLOCKED" | "ACTIVATION_ELIGIBLE" | null;
  checksums: ActivationChecksums;
  version: string;
  safety_flags: ActivationGateSafetyFlags;
  execution_enabled: false;
  live_enabled: false;
  created_at: string;
  updated_at: string;
  next_safe_action: string;
  notes: string[];
  fixture?: boolean;
};

export type ActivationCertificateContract = {
  schema_version: typeof ACTIVATION_CERTIFICATE_SCHEMA_VERSION;
  certificate_id: string;
  activation_id: string;
  mission_id: string;
  overall_score: number;
  all_checks: ActivationChecklistItem[];
  architecture_version: typeof ARCHITECTURE_VERSION;
  generated_at: string;
  status: "ACTIVATION_BLOCKED" | "ACTIVATION_ELIGIBLE";
  certificate_checksum: string;
  execution_permissions: false;
  safety_flags: ActivationGateSafetyFlags;
  notes: string[];
  fixture?: boolean;
};

export type ActivationGateHealth = {
  schema_version: typeof ACTIVATION_HEALTH_VERSION;
  activation_count: number;
  eligible_count: number;
  blocked_count: number;
  certificate_count: number;
  status: string;
  mode: "activation_eligibility_only";
  execution_allowed: false;
  live_enabled: false;
  safety_flags: ActivationGateSafetyFlags;
};

export type ActivationGateSnapshot = {
  schema_version: typeof ACTIVATION_SNAPSHOT_VERSION;
  activation_count: number;
  eligible_count: number;
  blocked_count: number;
  certificate_count: number;
  latest_activation_id: string | null;
  latest_mission_id: string | null;
  latest_status: ActivationLifecycleStatus | null;
  overall_score: number | null;
  next_safe_action: string | null;
};

export type ActivationSummary = {
  activation_id: string;
  mission_id: string;
  status: ActivationLifecycleStatus;
  outcome: "ACTIVATION_BLOCKED" | "ACTIVATION_ELIGIBLE" | null;
  overall_score: number;
  blocking_count: number;
  certificate_id: string | null;
  fixture?: boolean;
};

export type ActivationValidationIssue = {
  code: string;
  message: string;
  field?: string;
};

export type ActivationValidationResult = {
  ok: boolean;
  errors: ActivationValidationIssue[];
};
