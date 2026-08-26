/**
 * Founder AI Design Critic — shared types.
 */

export type CriticDimension =
  | "visual_hierarchy"
  | "spacing"
  | "typography"
  | "alignment"
  | "professional_appearance"
  | "premium_appearance"
  | "executive_polish"
  | "ats_friendliness"
  | "accessibility"
  | "balance"
  | "whitespace"
  | "color_harmony"
  | "originality"
  | "modern_design"
  | "industry_suitability"
  | "recruiter_friendliness"
  | "user_attractiveness"
  | "overall_quality";

export type DimensionScore = {
  dimension: CriticDimension;
  score: number;
  pass: boolean;
  notes: string;
};

export type FounderPredictions = {
  founder_approval_probability: number;
  founder_revision_probability: number;
  founder_rejection_probability: number;
  user_click_probability: number;
  user_download_probability: number;
  premium_perception: number;
  recruiter_appeal: number;
  overall_success_prediction: number;
  computed_at: string;
};

export type CritiqueItem = {
  id: string;
  category: CriticDimension;
  feedback: string;
  actionable: boolean;
  severity: "low" | "medium" | "high";
};

export type ImprovementRecommendation = {
  id: string;
  recommendation: string;
  priority: "critical" | "high" | "medium" | "low";
  reason: string;
  expected_impact: string;
  difficulty: "easy" | "moderate" | "hard";
  confidence: number;
  estimated_visual_gain: number;
};

export type ImprovementPlan = {
  plan_id: string;
  generated_at: string;
  prototype_id: string;
  recommendations: ImprovementRecommendation[];
  total_estimated_gain: number;
};

export type ApprovalRecommendation = {
  overall_score: number;
  policy_band: "reject" | "revision_recommended" | "recommend_founder_approval";
  ready_for_founder_review: boolean;
  founder_approval_mandatory: true;
  summary: string;
  rationale: string[];
};

export type ComparisonReport = {
  compared_at: string;
  prototype_id: string;
  corpus_comparisons: Array<{ template_id: string; similarity: number; family: string }>;
  benchmark_alignment_score: number;
  learning_alignment_score: number;
  approved_template_distance: number;
  batch_uniqueness_score: number;
  never_self_only: true;
};

export type FounderReview = {
  review_id: string;
  reviewed_at: string;
  prototype_id: string;
  question: "Would Stephen approve this template?";
  verdict: "not_ready" | "revision_first" | "ready_for_founder_review";
  dimension_scores: DimensionScore[];
  critiques: CritiqueItem[];
  strengths: string[];
  weaknesses: string[];
};

export type CriticRunResult = {
  pass: boolean;
  review_id: string;
  prototype_id: string;
  output_dir: string;
  overall_score: number;
  approval: ApprovalRecommendation;
  predictions: FounderPredictions;
  ready_for_founder_review: boolean;
  artifacts: string[];
};

export type CriticRunOptions = {
  prototype_dir?: string;
  objective?: string;
  persist?: boolean;
};

export type LoadedTemplateContext = {
  prototype_id: string;
  prototype_dir: string;
  qa_pass: boolean;
  qa_overall_pass: boolean;
  qa_stages_passed: number;
  qa_stages_total: number;
  premium_scores: Record<string, number> | null;
  design_plan: Record<string, unknown> | null;
  validation: Record<string, unknown> | null;
  objective: string;
  family_id: string;
};
