/**
 * Runtime Release Gate V1 — types (Agent #170).
 * Governance only. Never dispatches, executes, or publishes.
 */
import type { MissionLifecycleStatus } from "../../core/company-brain/mission-types.js";

export const RUNTIME_RELEASE_SCHEMA_VERSION =
  "runtime-release-1.0.0" as const;

export const RUNTIME_RELEASE_FOUNDER_ACTOR = "stephen" as const;

export type RuntimeReleaseDecisionKind =
  | "APPROVED"
  | "REJECTED"
  | "CHANGES_REQUESTED";

export type RuntimeReleaseRecordStatus =
  | "RECORDED"
  | "CONSUMED"
  | "SUPERSEDED"
  | "REJECTED_INVALID";

export type RuntimeReleaseLifecycleStatus =
  | "WAITING_RUNTIME_RELEASE"
  | "RUNTIME_RELEASE_APPROVED"
  | "RUNTIME_RELEASE_REJECTED"
  | "RUNTIME_RELEASE_CHANGES_REQUESTED";

export type RuntimeReleaseDecision = {
  schema_version: typeof RUNTIME_RELEASE_SCHEMA_VERSION;
  release_id: string;
  mission_id: string;
  mission_version: number;
  runtime_plan_id: string;
  plan_checksum: string;
  shadow_queue_id: string;
  submission_id: string;
  submission_checksum: string;
  execution_package_checksum: string;
  acknowledgement_id: string;
  acknowledgement_checksum: string;
  founder_actor: typeof RUNTIME_RELEASE_FOUNDER_ACTOR | string;
  decision: RuntimeReleaseDecisionKind;
  reason: string;
  notes: string;
  created_at: string;
  decided_at: string | null;
  consumed_at: string | null;
  status: RuntimeReleaseRecordStatus;
  resulting_status: RuntimeReleaseLifecycleStatus | null;
  execution_allowed: false;
  dispatch_allowed: false;
  scheduler_allowed: false;
  queue_insert_allowed: false;
  worker_execution_allowed: false;
  provider_allowed: false;
  publishing_allowed: false;
  live_enabled: false;
  next_safe_action: string | null;
  revision_proposal: RuntimeReleaseRevisionProposal | null;
  fixture?: boolean;
};

export type RuntimeReleaseRevisionProposal = {
  proposal_id: string;
  mission_id: string;
  runtime_plan_id: string;
  feedback: string;
  created_at: string;
  auto_revise: false;
  status: "PROPOSED";
};

export type RuntimeReleaseEvent = {
  event_id: string;
  event_type:
    | "RELEASE_REVIEW_OPENED"
    | "RELEASE_RECORDED"
    | "RELEASE_CONSUMED"
    | "MISSION_STATUS_UPDATED"
    | "RELEASE_REVISION_PROPOSED"
    | "RELEASE_REJECTED_INVALID";
  at: string;
  mission_id: string;
  release_id: string | null;
  runtime_plan_id: string | null;
  summary: string;
  fixture?: boolean;
};

export type RuntimeReleaseHistoryEntry = {
  at: string;
  mission_id: string;
  mission_version: number;
  release_id: string | null;
  runtime_plan_id: string | null;
  from_status: MissionLifecycleStatus | string;
  to_status: MissionLifecycleStatus | string;
  actor: string | null;
  note: string;
  fixture?: boolean;
};

export type RuntimeReleaseSnapshot = {
  schema_version: "runtime-release-snapshot-1.0.0";
  updated_at: string;
  mission_id: string | null;
  runtime_plan_id: string | null;
  plan_checksum: string | null;
  release_status: RuntimeReleaseLifecycleStatus | "NOT_STARTED" | null;
  latest_release_id: string | null;
  latest_decision: RuntimeReleaseDecisionKind | null;
  execution_allowed: false;
  dispatch_allowed: false;
  scheduler_allowed: false;
  queue_insert_allowed: false;
  worker_execution_allowed: false;
  provider_allowed: false;
  publishing_allowed: false;
  live_enabled: false;
  pending: boolean;
  next_safe_action: string | null;
};

export type RuntimeReleaseHealth = {
  schema_version: "runtime-release-health-1.0.0";
  updated_at: string;
  pending_count: number;
  approved_count: number;
  rejected_count: number;
  changes_requested_count: number;
  decision_count: number;
  execution_allowed: false;
  dispatch_allowed: false;
  scheduler_allowed: false;
  queue_insert_allowed: false;
  worker_execution_allowed: false;
  provider_allowed: false;
  publishing_allowed: false;
  live_enabled: false;
  live: false;
  mode: "release_gate_only";
  status: "healthy" | "degraded" | "idle";
};

export type RuntimeReleaseDecisionInput = {
  mission_id: string;
  mission_version: number;
  runtime_plan_id: string;
  plan_checksum: string;
  decision: RuntimeReleaseDecisionKind;
  actor: string;
  reason?: string;
  notes?: string;
  fixture?: boolean;
  execute?: unknown;
  dispatch?: unknown;
  scheduler?: unknown;
  enqueue?: unknown;
  queue_insert?: unknown;
  provider?: unknown;
  publish?: unknown;
  enable_live?: unknown;
};

export type RuntimeReleaseDecisionResult = {
  ok: boolean;
  release: RuntimeReleaseDecision | null;
  mission_status: string | null;
  next_safe_action: string | null;
  error?: string;
  error_code?: string;
  duplicate?: boolean;
};

export const RUNTIME_RELEASE_FORBIDDEN_KEYS = [
  "execute",
  "dispatch",
  "scheduler",
  "enqueue",
  "queue_insert",
  "provider",
  "publish",
  "enable_live",
] as const;
