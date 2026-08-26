/**
 * Queue Admission Readiness Review V1 — types (Agent #164).
 * Review only. Never enqueues, executes, dispatches, or publishes.
 */

import type { MissionLifecycleStatus } from "./mission-types.js";
import type { PlanRiskLevel } from "./types.js";

export const QUEUE_ADMISSION_SCHEMA_VERSION =
  "queue-admission-1.0.0" as const;

export const QUEUE_FOUNDER_ACTOR = "stephen" as const;

/** Queue-admission governance states only (Agent #164). */
export type QueueAdmissionStatus =
  | "WAITING_QUEUE_REVIEW"
  | "READY_FOR_QUEUE"
  | "QUEUE_BLOCKED";

export type QueueReadinessVerdict = "NOT_READY" | "READY_FOR_QUEUE";

export type QueueDecisionKind =
  | "APPROVE_QUEUE_ADMISSION"
  | "REQUEST_CHANGES"
  | "REJECT_QUEUE_ADMISSION";

export type QueueDecisionRecordStatus =
  | "RECORDED"
  | "CONSUMED"
  | "SUPERSEDED"
  | "REJECTED_INVALID";

export type ReadinessCategoryId =
  | "mission"
  | "departments"
  | "knowledge"
  | "skills"
  | "workers"
  | "dependencies"
  | "infrastructure"
  | "security"
  | "providers"
  | "publishing";

export type ReadinessCategoryScore = {
  id: ReadinessCategoryId;
  label: string;
  weight: number;
  score: number;
  weighted: number;
  status: "ok" | "warn" | "fail";
  notes: string[];
};

export type QueueReadinessIssue = {
  id: string;
  severity: "blocker" | "warning" | "info";
  code: string;
  message: string;
  category: ReadinessCategoryId | "general";
};

export type QueueReadinessReport = {
  schema_version: typeof QUEUE_ADMISSION_SCHEMA_VERSION;
  review_id: string;
  mission_id: string;
  mission_version: number;
  mission_status: MissionLifecycleStatus;
  generated_at: string;
  categories: ReadinessCategoryScore[];
  overall_score: number;
  verdict: QueueReadinessVerdict;
  queue_status: QueueAdmissionStatus | "NOT_STARTED";
  issues: QueueReadinessIssue[];
  warnings: string[];
  risks: string[];
  departments: string[];
  workers: string[];
  skills: string[];
  models: string[];
  tools: string[];
  dependency_graph: {
    nodes: string[];
    edges: Array<{ from: string; to: string; kind: string }>;
    critical_path: string[];
  };
  estimated_cost_usd: number | null;
  estimated_cost_note: string;
  estimated_duration: string;
  estimated_stages: string[];
  expected_outputs: string[];
  risk_level: PlanRiskLevel;
  publishing_ready: false;
  execution_allowed: false;
  queue_enqueue_allowed: false;
  execution_still_blocked_reason: string;
  fixture?: boolean;
};

export type QueueAdmissionDecision = {
  schema_version: typeof QUEUE_ADMISSION_SCHEMA_VERSION;
  decision_id: string;
  mission_id: string;
  mission_version: number;
  review_id: string | null;
  decision: QueueDecisionKind;
  actor: typeof QUEUE_FOUNDER_ACTOR | string;
  reason: string;
  feedback: string;
  created_at: string;
  consumed_at: string | null;
  status: QueueDecisionRecordStatus;
  resulting_status: QueueAdmissionStatus | null;
  execution_allowed: false;
  queue_enqueue_allowed: false;
  publishing_allowed: false;
  next_safe_action: string | null;
  supersedes_decision_id: string | null;
  fixture?: boolean;
};

export type QueueAdmissionEvent = {
  event_id: string;
  event_type:
    | "QUEUE_REVIEW_STARTED"
    | "READINESS_COMPUTED"
    | "QUEUE_DECISION_RECORDED"
    | "QUEUE_DECISION_CONSUMED"
    | "MISSION_STATUS_UPDATED"
    | "QUEUE_ADMISSION_REJECTED_INVALID";
  at: string;
  mission_id: string;
  decision_id: string | null;
  review_id: string | null;
  summary: string;
  fixture?: boolean;
};

export type QueueAdmissionHistoryEntry = {
  at: string;
  mission_id: string;
  mission_version: number;
  from_status: MissionLifecycleStatus;
  to_status: MissionLifecycleStatus;
  decision_id: string | null;
  review_id: string | null;
  actor: string | null;
  note: string;
  fixture?: boolean;
};

export type QueueAdmissionSnapshot = {
  schema_version: "queue-admission-snapshot-1.0.0";
  updated_at: string;
  mission_id: string | null;
  mission_version: number | null;
  queue_status: QueueAdmissionStatus | "NOT_STARTED" | null;
  overall_score: number | null;
  verdict: QueueReadinessVerdict | null;
  latest_decision_id: string | null;
  latest_decision: QueueDecisionKind | null;
  latest_review_id: string | null;
  execution_allowed: false;
  queue_enqueue_allowed: false;
  publishing_allowed: false;
  execution_still_blocked_reason: string;
  pending: boolean;
};

export type QueueAdmissionHealth = {
  schema_version: "queue-admission-health-1.0.0";
  updated_at: string;
  pending_review_count: number;
  ready_for_queue_count: number;
  blocked_count: number;
  decision_count: number;
  execution_allowed: false;
  queue_enqueue_allowed: false;
  publishing_allowed: false;
  live: false;
  mode: "readiness_review_only";
  status: "healthy" | "degraded" | "idle";
};

export type QueueDecisionInput = {
  mission_id: string;
  mission_version: number;
  decision: QueueDecisionKind;
  actor: string;
  reason?: string;
  feedback?: string;
  review_id?: string;
  fixture?: boolean;
  execute?: unknown;
  run?: unknown;
  dispatch?: unknown;
  enqueue?: unknown;
  publish?: unknown;
  enable_live?: unknown;
  queue_enqueue_allowed?: unknown;
  execution_allowed?: unknown;
  publishing_allowed?: unknown;
};

export type QueueDecisionResult = {
  ok: boolean;
  decision: QueueAdmissionDecision | null;
  review: QueueReadinessReport | null;
  mission_status: MissionLifecycleStatus | null;
  next_safe_action: string | null;
  error?: string;
  error_code?: string;
  duplicate?: boolean;
};

/** Weights sum to 100. */
export const READINESS_WEIGHTS: Record<ReadinessCategoryId, number> = {
  mission: 15,
  departments: 12,
  knowledge: 10,
  skills: 8,
  workers: 10,
  dependencies: 10,
  infrastructure: 10,
  security: 8,
  providers: 7,
  publishing: 10,
};

export const READY_SCORE_THRESHOLD = 70;
