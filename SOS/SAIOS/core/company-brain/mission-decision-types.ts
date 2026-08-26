/**
 * Mission Decision Contract V1 — Agent #163.
 * Governance only. Never executes, enqueues, or publishes.
 */
import type { MissionLifecycleStatus } from "./mission-types.js";

export const MISSION_DECISION_SCHEMA_VERSION =
  "mission-decision-1.0.0" as const;

export const MISSION_FOUNDER_ACTOR = "stephen" as const;

export type MissionDecisionKind =
  | "APPROVED"
  | "REJECTED"
  | "CHANGES_REQUESTED";

export type MissionDecisionStatus =
  | "RECORDED"
  | "CONSUMED"
  | "SUPERSEDED"
  | "REJECTED_INVALID";

export type MissionDecision = {
  schema_version: typeof MISSION_DECISION_SCHEMA_VERSION;
  decision_id: string;
  mission_id: string;
  mission_version: number;
  decision: MissionDecisionKind;
  actor: typeof MISSION_FOUNDER_ACTOR | string;
  reason: string;
  feedback: string;
  created_at: string;
  consumed_at: string | null;
  status: MissionDecisionStatus;
  /** Always false — safety invariants */
  execution_allowed: false;
  queue_admission_allowed: false;
  publishing_allowed: false;
  next_safe_action: string | null;
  revision_proposal: MissionRevisionProposal | null;
  supersedes_decision_id: string | null;
  fixture?: boolean;
};

export type MissionRevisionProposal = {
  proposal_id: string;
  mission_id: string;
  mission_version: number;
  feedback: string;
  created_at: string;
  auto_revise: false;
  status: "PROPOSED";
};

export type MissionDecisionEvent = {
  event_id: string;
  event_type:
    | "MISSION_DECISION_RECORDED"
    | "MISSION_DECISION_CONSUMED"
    | "MISSION_DECISION_REJECTED"
    | "MISSION_STATUS_UPDATED"
    | "MISSION_REVISION_PROPOSED"
    | "MISSION_SUBMITTED_FOR_FOUNDER";
  at: string;
  mission_id: string;
  decision_id: string | null;
  summary: string;
  fixture?: boolean;
};

export type MissionApprovalHistoryEntry = {
  at: string;
  mission_id: string;
  mission_version: number;
  from_status: MissionLifecycleStatus;
  to_status: MissionLifecycleStatus;
  decision_id: string | null;
  actor: string | null;
  note: string;
  fixture?: boolean;
};

export type MissionApprovalSnapshot = {
  schema_version: "mission-approval-snapshot-1.0.0";
  updated_at: string;
  mission_id: string | null;
  mission_version: number | null;
  mission_status: MissionLifecycleStatus | null;
  latest_decision_id: string | null;
  latest_decision: MissionDecisionKind | null;
  founder_approval_required: true;
  execution_allowed: false;
  queue_admission_allowed: false;
  publishing_allowed: false;
  next_safe_action: string | null;
  pending: boolean;
};

export type PendingMissionApproval = {
  mission_id: string;
  mission_version: number;
  mission_name: string;
  status: "WAITING_FOUNDER" | "PLANNED";
  priority: string;
  risk_level: string;
  updated_at: string;
  founder_approval_required: true;
};

export type MissionApprovalHealth = {
  schema_version: "mission-approval-health-1.0.0";
  updated_at: string;
  pending_count: number;
  approved_count: number;
  rejected_count: number;
  changes_requested_count: number;
  decision_count: number;
  execution_allowed: false;
  queue_admission_allowed: false;
  publishing_allowed: false;
  live: false;
  mode: "approval_only";
  status: "healthy" | "degraded" | "idle";
};

export type MissionDecisionInput = {
  mission_id: string;
  mission_version: number;
  decision: MissionDecisionKind;
  actor: string;
  reason?: string;
  feedback?: string;
  fixture?: boolean;
  /** Forbidden side-effect probes — always rejected if present/true */
  execute?: unknown;
  enqueue?: unknown;
  publish?: unknown;
  enable_live?: unknown;
  queue_admission_allowed?: unknown;
  execution_allowed?: unknown;
  publishing_allowed?: unknown;
};

export type MissionDecisionResult = {
  ok: boolean;
  decision: MissionDecision | null;
  mission_status: MissionLifecycleStatus | null;
  next_safe_action: string | null;
  error?: string;
  error_code?: string;
  duplicate?: boolean;
};
