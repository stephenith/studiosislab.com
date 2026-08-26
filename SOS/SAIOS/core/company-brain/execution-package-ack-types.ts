/**
 * Execution Package Acknowledgement V1 — types (Agent #166).
 * Governance only. Never enqueues, executes, or publishes.
 */
import type { MissionLifecycleStatus } from "./mission-types.js";

export const EXECUTION_PACKAGE_ACK_SCHEMA_VERSION =
  "execution-package-ack-1.0.0" as const;

export const PACKAGE_ACK_FOUNDER_ACTOR = "stephen" as const;

export type PackageAckDecisionKind =
  | "ACKNOWLEDGED"
  | "CHANGES_REQUESTED"
  | "REJECTED";

export type PackageAckRecordStatus =
  | "RECORDED"
  | "CONSUMED"
  | "SUPERSEDED"
  | "REJECTED_INVALID";

export type PackageAckLifecycleStatus =
  | "WAITING_PACKAGE_ACKNOWLEDGEMENT"
  | "PACKAGE_ACKNOWLEDGED"
  | "PACKAGE_CHANGES_REQUESTED"
  | "PACKAGE_REJECTED";

export type ExecutionPackageAcknowledgement = {
  schema_version: typeof EXECUTION_PACKAGE_ACK_SCHEMA_VERSION;
  acknowledgement_id: string;
  mission_id: string;
  mission_version: number;
  execution_id: string;
  package_id: string;
  execution_package_version: number;
  execution_package_checksum: string;
  founder_actor: typeof PACKAGE_ACK_FOUNDER_ACTOR | string;
  decision: PackageAckDecisionKind;
  reason: string;
  notes: string;
  created_at: string;
  acknowledged_at: string | null;
  consumed_at: string | null;
  status: PackageAckRecordStatus;
  resulting_status: PackageAckLifecycleStatus | null;
  execution_allowed: false;
  queue_enqueue_allowed: false;
  publishing_allowed: false;
  next_safe_action: string | null;
  revision_proposal: PackageRevisionProposal | null;
  supersedes_acknowledgement_id: string | null;
  fixture?: boolean;
};

export type PackageRevisionProposal = {
  proposal_id: string;
  mission_id: string;
  package_id: string;
  package_version: number;
  feedback: string;
  created_at: string;
  auto_revise: false;
  status: "PROPOSED";
};

export type PackageAckEvent = {
  event_id: string;
  event_type:
    | "ACK_REVIEW_OPENED"
    | "ACK_RECORDED"
    | "ACK_CONSUMED"
    | "MISSION_STATUS_UPDATED"
    | "PACKAGE_REVISION_PROPOSED"
    | "ACK_REJECTED_INVALID";
  at: string;
  mission_id: string;
  acknowledgement_id: string | null;
  package_id: string | null;
  summary: string;
  fixture?: boolean;
};

export type PackageAckHistoryEntry = {
  at: string;
  mission_id: string;
  mission_version: number;
  package_id: string | null;
  from_status: MissionLifecycleStatus;
  to_status: MissionLifecycleStatus;
  acknowledgement_id: string | null;
  actor: string | null;
  note: string;
  fixture?: boolean;
};

export type PackageAckSnapshot = {
  schema_version: "execution-package-ack-snapshot-1.0.0";
  updated_at: string;
  mission_id: string | null;
  package_id: string | null;
  package_version: number | null;
  checksum: string | null;
  ack_status: PackageAckLifecycleStatus | "NOT_STARTED" | null;
  latest_acknowledgement_id: string | null;
  latest_decision: PackageAckDecisionKind | null;
  execution_allowed: false;
  queue_enqueue_allowed: false;
  publishing_allowed: false;
  pending: boolean;
  next_safe_action: string | null;
};

export type PackageAckHealth = {
  schema_version: "execution-package-ack-health-1.0.0";
  updated_at: string;
  pending_count: number;
  acknowledged_count: number;
  changes_requested_count: number;
  rejected_count: number;
  acknowledgement_count: number;
  execution_allowed: false;
  queue_enqueue_allowed: false;
  publishing_allowed: false;
  live: false;
  mode: "acknowledgement_only";
  status: "healthy" | "degraded" | "idle";
};

export type PackageAckDecisionInput = {
  mission_id: string;
  mission_version: number;
  package_id: string;
  execution_package_version: number;
  execution_package_checksum: string;
  decision: PackageAckDecisionKind;
  actor: string;
  reason?: string;
  notes?: string;
  fixture?: boolean;
  execute?: unknown;
  run?: unknown;
  dispatch?: unknown;
  enqueue?: unknown;
  queue?: unknown;
  publish?: unknown;
  enable_live?: unknown;
  provider_call?: unknown;
};

export type PackageAckDecisionResult = {
  ok: boolean;
  acknowledgement: ExecutionPackageAcknowledgement | null;
  mission_status: MissionLifecycleStatus | null;
  next_safe_action: string | null;
  error?: string;
  error_code?: string;
  duplicate?: boolean;
};
