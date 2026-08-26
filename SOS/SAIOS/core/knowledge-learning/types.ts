/**
 * Learning knowledge contracts — Agent #125.
 */

export type LearningCategory =
  | "approved_pattern"
  | "rejected_pattern"
  | "revision_instruction"
  | "quality_observation"
  | "recurring_issue"
  | "founder_preference_signal";

export type LearningEntry = {
  learning_id: string;
  source_decision_id: string;
  source_review_id: string;
  source_task_id: string;
  department: string;
  category: LearningCategory;
  subject: string;
  observation: string;
  evidence_references: string[];
  confidence: "confirmed" | "probable" | "observed" | "draft";
  applicability: string[];
  approved_by_founder: boolean;
  supersedes: string | null;
  created_at: string;
  version: string;
  fixture?: boolean;
};
