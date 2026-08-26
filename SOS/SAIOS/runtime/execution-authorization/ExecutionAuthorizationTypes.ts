/**
 * Execution Authorization types — Agent #186.
 * Founder intent governance only. Never enables execution.
 */

export const EXECUTION_AUTHORIZATION_SCHEMA_VERSION =
  "execution-authorization-1.0.0" as const;
export const EXECUTION_AUTHORIZATION_CERTIFICATE_SCHEMA_VERSION =
  "execution-authorization-certificate-1.0.0" as const;
export const EXECUTION_AUTHORIZATION_SNAPSHOT_VERSION =
  "execution-authorization-snapshot-1.0.0" as const;
export const EXECUTION_AUTHORIZATION_HEALTH_VERSION =
  "execution-authorization-health-1.0.0" as const;
export const EXECUTION_AUTHORIZATION_FOUNDER = "stephen" as const;
export const ARCHITECTURE_VERSION = "1.0.0-canonical-runtime-freeze" as const;

export const EXECUTION_AUTHORIZATION_SAFETY_FLAGS = {
  execution_allowed: false,
  dispatch_allowed: false,
  worker_spawn_allowed: false,
  queue_insert_allowed: false,
  provider_allowed: false,
  publishing_allowed: false,
  live_enabled: false,
  scheduler_allowed: false,
  authorization_enables_execution: false,
  overrides_activation_gate: false,
} as const;

export type ExecutionAuthorizationSafetyFlags =
  typeof EXECUTION_AUTHORIZATION_SAFETY_FLAGS;

/** CREATED → WAITING_FOUNDER → AUTHORIZED | REJECTED → STOP */
export type ExecutionAuthorizationLifecycleStatus =
  | "CREATED"
  | "WAITING_FOUNDER"
  | "AUTHORIZED"
  | "REJECTED"
  | "STOP";

export type ExecutionAuthorizationScope =
  | "mission"
  | "department"
  | "runtime_plan"
  | "full_spine_intent";

export type ExecutionAuthorizationChecksums = {
  authorization_checksum: string;
  request_checksum: string | null;
  decision_checksum: string | null;
  certificate_checksum: string | null;
};

export type ExecutionAuthorizationRequestContract = {
  request_id: string;
  mission_id: string;
  activation_id: string | null;
  controller_id: string | null;
  founder: typeof EXECUTION_AUTHORIZATION_FOUNDER;
  requested_at: string;
  reason: string;
  scope: ExecutionAuthorizationScope;
  request_checksum: string;
  fixture?: boolean;
};

export type ExecutionAuthorizationDecisionContract = {
  decision_id: string;
  authorization_id: string;
  mission_id: string;
  founder: typeof EXECUTION_AUTHORIZATION_FOUNDER;
  decided_at: string;
  decision: "AUTHORIZED" | "REJECTED";
  reason: string;
  decision_checksum: string;
  fixture?: boolean;
};

export type ExecutionAuthorizationContract = {
  schema_version: typeof EXECUTION_AUTHORIZATION_SCHEMA_VERSION;
  authorization_id: string;
  mission_id: string;
  activation_id: string | null;
  founder: typeof EXECUTION_AUTHORIZATION_FOUNDER;
  requested_at: string;
  authorized_at: string | null;
  reason: string;
  scope: ExecutionAuthorizationScope;
  status: ExecutionAuthorizationLifecycleStatus;
  outcome: "AUTHORIZED" | "REJECTED" | null;
  checksums: ExecutionAuthorizationChecksums;
  version: string;
  safety_flags: ExecutionAuthorizationSafetyFlags;
  execution_enabled: false;
  live_enabled: false;
  overrides_activation_gate: false;
  created_at: string;
  updated_at: string;
  next_safe_action: string;
  notes: string[];
  fixture?: boolean;
};

export type ExecutionAuthorizationCertificateContract = {
  schema_version: typeof EXECUTION_AUTHORIZATION_CERTIFICATE_SCHEMA_VERSION;
  certificate_id: string;
  authorization_id: string;
  mission_id: string;
  activation_reference: string | null;
  status: "AUTHORIZED" | "REJECTED" | "WAITING_FOUNDER";
  checksums: {
    certificate_checksum: string;
    authorization_checksum: string;
  };
  generated_at: string;
  execution_permissions: false;
  safety_flags: ExecutionAuthorizationSafetyFlags;
  notes: string[];
  fixture?: boolean;
};

export type ExecutionAuthorizationHealth = {
  schema_version: typeof EXECUTION_AUTHORIZATION_HEALTH_VERSION;
  authorization_count: number;
  waiting_count: number;
  authorized_count: number;
  rejected_count: number;
  certificate_count: number;
  status: string;
  mode: "founder_intent_only";
  execution_allowed: false;
  live_enabled: false;
  safety_flags: ExecutionAuthorizationSafetyFlags;
};

export type ExecutionAuthorizationSnapshot = {
  schema_version: typeof EXECUTION_AUTHORIZATION_SNAPSHOT_VERSION;
  authorization_count: number;
  waiting_count: number;
  authorized_count: number;
  rejected_count: number;
  certificate_count: number;
  latest_authorization_id: string | null;
  latest_mission_id: string | null;
  latest_status: ExecutionAuthorizationLifecycleStatus | null;
  next_safe_action: string | null;
};

export type ExecutionAuthorizationSummary = {
  authorization_id: string;
  mission_id: string;
  status: ExecutionAuthorizationLifecycleStatus;
  outcome: "AUTHORIZED" | "REJECTED" | null;
  founder: string;
  activation_id: string | null;
  certificate_id: string | null;
  fixture?: boolean;
};

export type ExecutionAuthorizationValidationIssue = {
  code: string;
  message: string;
  field?: string;
};

export type ExecutionAuthorizationValidationResult = {
  ok: boolean;
  errors: ExecutionAuthorizationValidationIssue[];
};
