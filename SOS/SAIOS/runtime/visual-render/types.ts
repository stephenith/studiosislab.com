/**
 * Visual Render Evaluation Engine — shared types.
 */

export const RENDER_SCORE_GATE = 96;

export type VisualDimension =
  | "overall_premium_impression"
  | "whitespace_distribution"
  | "balance"
  | "visual_weight"
  | "typography_hierarchy"
  | "section_hierarchy"
  | "alignment_consistency"
  | "margins"
  | "grid_usage"
  | "section_density"
  | "page_utilization"
  | "recruiter_eye_flow"
  | "reading_rhythm"
  | "modern_appearance"
  | "ats_appearance"
  | "premium_appearance"
  | "executive_appearance"
  | "industry_suitability"
  | "originality"
  | "visual_confidence"
  | "scan_speed"
  | "information_grouping"
  | "spacing_consistency"
  | "color_harmony"
  | "visual_noise"
  | "professional_trust_score";

export type DimensionScore = {
  dimension: VisualDimension;
  score: number;
  pass: boolean;
  notes: string;
};

export type VisualIssueFlag =
  | "too_much_whitespace"
  | "too_dense"
  | "floating_sections"
  | "unbalanced_layout"
  | "weak_typography"
  | "weak_headers"
  | "weak_footer"
  | "weak_grouping"
  | "crowded_paragraphs"
  | "poor_hierarchy"
  | "generic_appearance"
  | "looks_like_resume_builder"
  | "looks_premium"
  | "looks_memorable";

export type RenderMetrics = {
  canvas_width: number;
  canvas_height: number;
  object_count: number;
  textbox_count: number;
  left_margin_px: number;
  right_margin_px: number;
  content_top_px: number;
  content_bottom_px: number;
  vertical_bands: number[];
  non_white_ratio: number;
  header_zone_density: number;
  body_zone_density: number;
  alignment_columns: number[];
  font_sizes_pt: number[];
  accent_count: number;
};

export type FounderApprovalPrediction = "REJECT" | "REVISION" | "LIKELY APPROVE";

export type RenderScores = {
  overall_render_score: number;
  premium_score: number;
  recruiter_score: number;
  founder_approval_prediction: FounderApprovalPrediction;
  computed_at: string;
};

export type VisualRenderResult = {
  pass: boolean;
  evaluation_id: string;
  template_name: string;
  template_path: string;
  output_dir: string;
  scores: RenderScores;
  dimensions: DimensionScore[];
  issues: VisualIssueFlag[];
  quality_gate_pass: boolean;
  publication_blocked: boolean;
  artifacts: string[];
};

export type VisualRenderOptions = {
  template_path?: string;
  mcp_firecrawl_available?: boolean;
  persist?: boolean;
};
