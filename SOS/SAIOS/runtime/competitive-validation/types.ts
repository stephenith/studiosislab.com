/**
 * Competitive validation — shared types.
 */

export const COMPETITIVE_SCORE_GATE = 90;

export type CompetitiveAxis =
  | "first_impression"
  | "premium_feel"
  | "executive_appearance"
  | "trust"
  | "readability"
  | "recruiter_scan_speed"
  | "information_density"
  | "visual_rhythm"
  | "typography"
  | "spacing"
  | "section_distinction"
  | "visual_weight"
  | "editorial_composition"
  | "professional_confidence"
  | "brand_recognition"
  | "ats_safety"
  | "print_quality"
  | "memorability"
  | "perceived_download_value";

export type CompetitiveAxisScore = {
  axis: CompetitiveAxis;
  score: number;
  pass: boolean;
  reasoning: string[];
};

export type CompetitiveBenchmark = {
  source: string;
  design_thinking: string[];
  premium_signals: string[];
  anti_patterns: string[];
};

export type CompetitiveAnalysis = {
  evaluated_at: string;
  template_name: string;
  candidate_name: string | null;
  job_title: string | null;
  question: string;
  benchmark_set: string[];
  design_dna_version: string;
  benchmark_alignment_score: number;
  visual_render_score: number;
  founder_premium_perception: number;
  overall_summary: string;
  evidence: string[];
};

export type CompetitiveScore = {
  overall_competitive_score: number;
  likely_user_choice: "YES" | "MAYBE" | "NO";
  confidence: number;
  gate_pass: boolean;
  computed_at: string;
  axis_scores: CompetitiveAxisScore[];
};

export type RecommendedImprovement = {
  id: string;
  priority: "critical" | "high" | "medium" | "low";
  target: "design_dna" | "competitive_validation";
  evidence: string[];
  recommendation: string;
  measurable_goal: string;
  founder_approval_required: true;
};

export type DesignDNADelta = {
  generated_at: string;
  design_dna_version: string;
  should_update: boolean;
  rationale: string[];
  proposed_principle_additions: string[];
  proposed_threshold_adjustments: Array<{
    key: string;
    current: number | string | boolean;
    recommended: number | string | boolean;
    reason: string;
  }>;
};

export type CompetitiveValidationOptions = {
  template_path?: string;
  prototype_dir?: string;
  mcp_firecrawl_available?: boolean;
  persist?: boolean;
};

export type CompetitiveValidationResult = {
  pass: boolean;
  template_name: string;
  template_path: string;
  output_dir: string;
  analysis: CompetitiveAnalysis;
  score: CompetitiveScore;
  strengths: string[];
  weaknesses: string[];
  improvements: RecommendedImprovement[];
  design_dna_delta: DesignDNADelta;
  artifacts: string[];
  status: "AWAITING_FOUNDER_APPROVAL";
};
