/**
 * Founder Gate Runtime — Agent #133.
 * Interactive pause/resume. No auto-decision on real cycles.
 */

export type CycleState =
  | "QUEUED"
  | "RUNNING"
  | "CRITIC_EVALUATION"
  | "CRITIC_BLOCKED"
  | "WAITING_FOUNDER"
  | "APPROVED"
  | "REJECTED"
  | "CHANGES_REQUESTED"
  | "LEARNING_WRITEBACK"
  | "COMPLETED"
  | "COMPLETED_WITH_REVISION_PROPOSED"
  | "FAILED"
  | "CANCELLED";

export type FounderDecisionKind = "APPROVED" | "REJECTED" | "CHANGES_REQUESTED";

export type CycleCheckpoint = {
  cycle_id: string;
  task_id: string;
  candidate_id: string;
  candidate_title: string;
  review_id: string;
  state: CycleState;
  completed_stages: string[];
  artifact_references: Record<string, string>;
  critic_result: {
    overall: number;
    ats: number;
    technical: number;
    ready: boolean;
  } | null;
  queue_action_id: string | null;
  checkpoint_checksum: string;
  created_at: string;
  last_updated_at: string;
  dry_run: true;
  publication_allowed: false;
  fixture?: boolean;
};

export type DecisionConsumption = {
  consumption_id: string;
  decision_id: string;
  cycle_id: string;
  review_id: string;
  decision: FounderDecisionKind;
  consumed_at: string;
  fixture?: boolean;
};

export type CycleTransition = {
  cycle_id: string;
  from: CycleState;
  to: CycleState;
  at: string;
  reason: string;
  fixture?: boolean;
};

export type ResumeResult = {
  ok: boolean;
  cycle_id: string;
  state: CycleState;
  learning_count: number;
  next_action: string | null;
  error?: string;
  duplicate?: boolean;
};

export const FOUNDER_ACTOR = "stephen";

export const ALLOWED_TRANSITIONS: Record<CycleState, CycleState[]> = {
  QUEUED: ["RUNNING", "CANCELLED"],
  RUNNING: ["CRITIC_EVALUATION", "FAILED", "CANCELLED"],
  CRITIC_EVALUATION: ["CRITIC_BLOCKED", "WAITING_FOUNDER", "FAILED"],
  CRITIC_BLOCKED: ["COMPLETED", "FAILED"],
  WAITING_FOUNDER: ["APPROVED", "REJECTED", "CHANGES_REQUESTED", "CANCELLED"],
  APPROVED: ["LEARNING_WRITEBACK"],
  REJECTED: ["LEARNING_WRITEBACK"],
  CHANGES_REQUESTED: ["LEARNING_WRITEBACK"],
  LEARNING_WRITEBACK: ["COMPLETED", "COMPLETED_WITH_REVISION_PROPOSED", "FAILED"],
  COMPLETED: [],
  COMPLETED_WITH_REVISION_PROPOSED: [],
  FAILED: [],
  CANCELLED: [],
};
