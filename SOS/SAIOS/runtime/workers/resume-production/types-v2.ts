/**
 * Resume Production Worker v2 — shared types.
 */

export type ProductionTier = "ats_safe" | "visual" | "hybrid";

export type DesignPlan = {
  plan_id: string;
  generated_at: string;
  objective: string;
  layout: string;
  grid: string;
  spacing: { margin_px: number; section_gap_px: number; paragraph_gap_px: number };
  columns: string;
  font_hierarchy: Array<{ role: string; size_pt: number; weight: string }>;
  color_palette: { accent: string; text: string; muted: string; background: string };
  sections: string[];
  ats_tier: ProductionTier;
  visual_tier: ProductionTier;
  design_reasoning: string[];
  expected_recruiter_impression: string;
  family_id: string;
  differentiation_notes: string[];
};

export type ConfidenceScores = {
  design_confidence: number;
  ats_confidence: number;
  visual_confidence: number;
  editor_compatibility: number;
  overall_confidence: number;
  target_met: boolean;
  computed_at: string;
};

export type SelfCritiqueReport = {
  pass_number: 1 | 2;
  reviewed_at: string;
  categories: Array<{ category: string; score: number; pass: boolean; notes: string }>;
  improvements_applied: string[];
  confidence_before: number;
  confidence_after: number;
};

export type ProductionV2Result = {
  pass: boolean;
  worker_version: "2.0.0";
  prototype_id: string;
  output_dir: string;
  status: "AWAITING_FOUNDER_APPROVAL";
  confidence: ConfidenceScores;
  qa_pass: boolean;
  local_review_command: string;
  duplicate_redesigns: number;
  artifacts: string[];
};

export type RunProductionV2Options = {
  objective?: string;
  output_dir?: string;
  mcp_firecrawl_available?: boolean;
  learning_persist?: boolean;
  seed?: number;
};
