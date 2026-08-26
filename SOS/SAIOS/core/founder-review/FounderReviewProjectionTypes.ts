/**
 * Canonical Founder Review projection types — resume-template read model.
 * Legacy persisted fields (candidate_id, candidates/) are retained for compatibility.
 */

export type FounderReviewProjectionStatus =
  | "waiting_founder"
  | "approved"
  | "rejected"
  | "changes_requested";

export type FounderReviewCriticScores = {
  overall: number;
  ats: number;
  visual: number;
  typography: number;
  layout: number;
  technical: number;
  consistency: number;
  sections: number;
  ready: boolean;
  founder_review_allowed: boolean;
  publication_allowed: false;
  blocking_reasons: string[];
  critic_report_reference: string;
  gate_id: string | null;
  source: string;
};

export type FounderReviewProjectionItem = {
  review_id: string;
  /** Legacy internal identifier — display as Resume Template ID. */
  candidate_id: string;
  task_id: string;
  cycle_id: string;
  title: string;
  template: string;
  department: string;
  provider: string;
  status: FounderReviewProjectionStatus;
  ready: boolean;
  badge: "ready" | "blocked" | "waiting";
  created_at: string;
  preview_url: string | null;
  preview_path: string | null;
  thumbnail_path: string | null;
  critic: FounderReviewCriticScores | null;
  decision_id?: string;
  learning_impact: string;
  source: string;
  artifact_refs?: {
    production_target: string | null;
    research_context: string | null;
    canvas: string | null;
    critic: string | null;
    gate: string | null;
    dashboard: string | null;
    review: string | null;
    preview: string | null;
  };
  production_target?: {
    category: string;
    title: string;
    industry: string;
    seniority: string;
    objective?: string;
  } | null;
  candidate_directory?: string | null;
  revision?: {
    revised?: boolean;
    revision_number?: number;
    prior_status?: string;
    requested_changes?: string[];
    changes_applied?: string[];
    role?: string;
    prior_candidate_id?: string;
    prior_decision_id?: string;
  } | null;
};

export type FounderReviewProjectionSummary = {
  /** Actionable Ready for Review count (canonical). */
  waiting: number;
  approved: number;
  rejected: number;
  changes_requested: number;
  /** All projected resume-template records visible in the review model. */
  total_visible: number;
  /** Waiting count keyed by production_target.category. */
  waiting_by_category: Record<string, number>;
  items: FounderReviewProjectionItem[];
};
