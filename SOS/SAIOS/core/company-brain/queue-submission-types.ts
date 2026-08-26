/**
 * Queue Submission Contract V1 — types (Agent #167).
 * Shadow mode only. Never inserts into the runtime queue.
 */
import type { PlanPriority, PlanRiskLevel } from "./types.js";
import type { MissionLifecycleStatus } from "./mission-types.js";
import type {
  DependencyGraphPreview,
  ExecutionGraph,
  QualityGate,
  RollbackPoint,
  WorkerGraph,
} from "./execution-package-types.js";

export const QUEUE_SUBMISSION_SCHEMA_VERSION =
  "queue-submission-1.0.0" as const;

export const QUEUE_SUBMISSION_FOUNDER_ACTOR = "stephen" as const;

export type QueueSubmissionLifecycleStatus =
  | "WAITING_QUEUE_SUBMISSION"
  | "QUEUE_SUBMISSION_READY"
  | "QUEUE_SUBMISSION_BLOCKED";

export type QueueSubmissionReviewDecision =
  | "CONFIRM_SHADOW_PACKAGE"
  | "BLOCK_SUBMISSION";

export type QueueSubmissionSecurityState = {
  live: false;
  execution_allowed: false;
  queue_insert_allowed: false;
  publishing_allowed: false;
  provider_calls: false;
  scheduler_active: false;
  runtime_queue_untouched: true;
  note: string;
};

export type QueueSubmissionPackage = {
  schema_version: typeof QUEUE_SUBMISSION_SCHEMA_VERSION;
  submission_id: string;
  mission_id: string;
  mission_version: number;
  execution_id: string;
  execution_package_id: string;
  execution_package_version: number;
  execution_package_checksum: string;
  acknowledgement_id: string;
  acknowledgement_checksum: string;
  department: string;
  priority: PlanPriority;
  objective: string;
  worker_inventory: string[];
  skill_inventory: string[];
  provider_inventory: string[];
  tool_inventory: string[];
  dependency_graph: DependencyGraphPreview;
  execution_graph: ExecutionGraph;
  worker_graph: WorkerGraph;
  estimated_cost_usd: number | null;
  estimated_cost_note: string;
  estimated_duration: string;
  rollback_plan: RollbackPoint[];
  quality_gates: QualityGate[];
  security_state: QueueSubmissionSecurityState;
  risk_level: PlanRiskLevel;
  warnings: string[];
  submission_checksum: string;
  dry_run: true;
  submission_allowed: false;
  queue_insert_allowed: false;
  execution_allowed: false;
  publishing_allowed: false;
  created_at: string;
  created_by: "company_brain";
  next_safe_action: string;
  submission_still_blocked_reason: string;
  fixture?: boolean;
};

export type QueueSubmissionEvent = {
  event_id: string;
  event_type:
    | "SUBMISSION_BUILT"
    | "SUBMISSION_VALIDATED"
    | "SUBMISSION_REJECTED"
    | "REVIEW_RECORDED"
    | "MISSION_STATUS_UPDATED";
  at: string;
  mission_id: string;
  submission_id: string | null;
  summary: string;
  fixture?: boolean;
};

export type QueueSubmissionHistoryEntry = {
  at: string;
  mission_id: string;
  mission_version: number;
  submission_id: string | null;
  from_status: MissionLifecycleStatus;
  to_status: MissionLifecycleStatus;
  actor: string | null;
  note: string;
  fixture?: boolean;
};

export type QueueSubmissionSnapshot = {
  schema_version: "queue-submission-snapshot-1.0.0";
  updated_at: string;
  mission_id: string | null;
  submission_id: string | null;
  submission_checksum: string | null;
  submission_status: QueueSubmissionLifecycleStatus | "NOT_STARTED" | null;
  execution_package_id: string | null;
  acknowledgement_id: string | null;
  dry_run: true;
  submission_allowed: false;
  queue_insert_allowed: false;
  execution_allowed: false;
  publishing_allowed: false;
  pending: boolean;
  next_safe_action: string | null;
};

export type QueueSubmissionHealth = {
  schema_version: "queue-submission-health-1.0.0";
  updated_at: string;
  pending_count: number;
  ready_count: number;
  blocked_count: number;
  package_count: number;
  dry_run: true;
  submission_allowed: false;
  queue_insert_allowed: false;
  execution_allowed: false;
  publishing_allowed: false;
  live: false;
  mode: "shadow_submission_only";
  status: "healthy" | "degraded" | "idle";
};

export type QueueSubmissionBuildResult = {
  ok: boolean;
  package: QueueSubmissionPackage | null;
  mission_status: MissionLifecycleStatus | null;
  next_safe_action: string | null;
  artifact_paths: string[];
  error?: string;
  error_code?: string;
  duplicate?: boolean;
};

export type QueueSubmissionReviewInput = {
  mission_id: string;
  mission_version: number;
  submission_id: string;
  submission_checksum: string;
  decision: QueueSubmissionReviewDecision;
  actor: string;
  reason?: string;
  notes?: string;
  fixture?: boolean;
  enqueue?: unknown;
  queue?: unknown;
  dispatch?: unknown;
  execute?: unknown;
  publish?: unknown;
  enable_live?: unknown;
  provider_call?: unknown;
};

export type QueueSubmissionReviewResult = {
  ok: boolean;
  package: QueueSubmissionPackage | null;
  mission_status: MissionLifecycleStatus | null;
  next_safe_action: string | null;
  error?: string;
  error_code?: string;
};
