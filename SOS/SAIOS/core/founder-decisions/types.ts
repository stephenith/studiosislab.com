/**
 * Founder decision contracts — Agent #125.
 * Immutable once created. No publication.
 */

export type FounderDecisionKind = "APPROVED" | "REJECTED" | "CHANGES_REQUESTED";

export type FounderDecision = {
  decision_id: string;
  review_id: string;
  task_id: string;
  cycle_id: string;
  department: string;
  decision: FounderDecisionKind;
  founder_actor: string;
  reason: string;
  structured_feedback: Record<string, unknown>;
  quality_scores: Record<string, number>;
  requested_changes: string[];
  reviewed_artifacts: string[];
  provider: string;
  dry_run: true;
  created_at: string;
  source_interface: "aios_dashboard";
  publication_allowed: false;
  next_action: string;
  supersedes: string | null;
  fixture?: boolean;
};

export type DecisionInput = {
  review_id: string;
  task_id: string;
  cycle_id: string;
  department?: string;
  decision: FounderDecisionKind;
  founder_actor?: string;
  reason: string;
  structured_feedback?: Record<string, unknown>;
  quality_scores?: Record<string, number>;
  requested_changes?: string[];
  reviewed_artifacts?: string[];
  provider?: string;
  supersedes?: string | null;
  fixture?: boolean;
};

export type DecisionEventType =
  | "FOUNDER_REVIEW_OPENED"
  | "FOUNDER_DECISION_APPROVED"
  | "FOUNDER_DECISION_REJECTED"
  | "FOUNDER_CHANGES_REQUESTED"
  | "LEARNING_ENTRY_CREATED"
  | "FOUNDER_ACTION_RESOLVED"
  | "REVISION_TASK_PROPOSED";

export type DecisionEvent = {
  event_id: string;
  type: DecisionEventType;
  at: string;
  decision_id?: string;
  review_id?: string;
  learning_id?: string;
  summary: string;
  dry_run: true;
};
