/**
 * System Readiness Freeze V1 — types (Agent #171).
 * Certification only. Never executes.
 */

export const SYSTEM_READINESS_SCHEMA_VERSION =
  "system-readiness-1.0.0" as const;

export const SYSTEM_READINESS_FOUNDER = "stephen" as const;

export const GOVERNANCE_VERSION = "governance-spine-1.0.0" as const;
export const ARCHITECTURE_VERSION = "1.0.0-canonical-runtime-freeze" as const;

export type SystemReadinessStatus = "SYSTEM_READY" | "SYSTEM_BLOCKED";

export type ChecksumChain = {
  execution_package_checksum: string;
  acknowledgement_checksum: string;
  submission_checksum: string;
  shadow_submission_checksum: string;
  plan_checksum: string;
  release_plan_checksum: string;
  certificate_checksum: string;
};

export type SafetyFlags = {
  execution_allowed: false;
  dispatch_allowed: false;
  scheduler_allowed: false;
  worker_execution_allowed: false;
  queue_insert_allowed: false;
  provider_allowed: false;
  publishing_allowed: false;
  live_enabled: false;
};

export type VerificationSummary = {
  company_brain: boolean;
  mission_approval: boolean;
  queue_admission: boolean;
  execution_package: boolean;
  execution_package_ack: boolean;
  queue_submission: boolean;
  shadow_queue: boolean;
  runtime_plan: boolean;
  runtime_release: boolean;
  overall: "PASS" | "FAIL";
};

export type LifecycleTimelineEntry = {
  stage: string;
  status: string;
  required: boolean;
  satisfied: boolean;
};

export type SystemReadinessCertificate = {
  schema_version: typeof SYSTEM_READINESS_SCHEMA_VERSION;
  certificate_id: string;
  mission_id: string;
  mission_version: number;
  runtime_plan_id: string;
  runtime_release_id: string;
  shadow_queue_id: string;
  submission_id: string;
  checksum_chain: ChecksumChain;
  architecture_version: typeof ARCHITECTURE_VERSION;
  governance_version: typeof GOVERNANCE_VERSION;
  validated_at: string;
  founder: typeof SYSTEM_READINESS_FOUNDER;
  current_lifecycle: string;
  certificate_status: SystemReadinessStatus;
  lifecycle_timeline: LifecycleTimelineEntry[];
  safety_flags: SafetyFlags;
  verification_summary: VerificationSummary;
  reports_present: string[];
  blockers: string[];
  readiness_score: number;
  next_safe_action: string;
  planning_notes: string[];
  fixture?: boolean;
};

export type SystemReadinessEvent = {
  event_id: string;
  event_type: "CERTIFICATE_ISSUED" | "CERTIFICATE_BLOCKED" | "MISSION_STATUS_UPDATED";
  at: string;
  mission_id: string;
  certificate_id: string | null;
  summary: string;
  fixture?: boolean;
};

export type SystemReadinessSnapshot = {
  schema_version: "system-readiness-snapshot-1.0.0";
  updated_at: string;
  mission_id: string | null;
  certificate_id: string | null;
  certificate_status: SystemReadinessStatus | "EMPTY" | null;
  readiness_score: number | null;
  architecture_version: typeof ARCHITECTURE_VERSION;
  governance_version: typeof GOVERNANCE_VERSION;
  safety_flags: SafetyFlags;
  next_safe_action: string | null;
};

export type SystemReadinessHealth = {
  schema_version: "system-readiness-health-1.0.0";
  updated_at: string;
  certificate_count: number;
  ready_count: number;
  blocked_count: number;
  safety_flags: SafetyFlags;
  live: false;
  mode: "readiness_freeze_only";
  status: "healthy" | "degraded" | "idle";
};

export type SystemReadinessResult = {
  ok: boolean;
  certificate: SystemReadinessCertificate | null;
  mission_status: string | null;
  next_safe_action: string | null;
  artifact_paths: string[];
  error?: string;
  error_code?: string;
  duplicate?: boolean;
};
