/**
 * Premium Resume Generator v3 — shared types.
 */
import type { DesignDecisions, QualityScores, DesignConfidenceReport } from "../../design-brain/types.js";
import type { DesignPrinciple } from "../../benchmark/types.js";
import type { ConfidenceScores, DesignPlan } from "./types-v2.js";
import type { DuplicateCheckResult } from "./duplicate-detector.js";
import type { ProductionDesignBundle } from "./design-bundle.js";
import type { DesignSystemGatesResult } from "./design-system-gates.js";

export type DesignIntent = {
  intent_id: string;
  generated_at: string;
  objective: string;
  premium_targets: string[];
  design_sources: string[];
  benchmark_principles_applied: string[];
  brain_decision_id: string;
  learning_preferences_applied: string[];
  pass: boolean;
};

export type LayoutSelection = {
  selected_family_id: string;
  layout_pattern: string;
  column_strategy: string;
  header_style: string;
  sidebar_usage: boolean;
  rationale: string[];
  duplicate_redesigns: number;
  pass: boolean;
};

export type VisualStrategy = {
  first_impression_goal: string;
  premium_feel: boolean;
  executive_polish: boolean;
  download_likelihood_factors: string[];
  user_preference_signals: string[];
  decoration_budget: number;
  pass: boolean;
};

export type SpacingPlan = {
  margin_px: number;
  section_gap_px: number;
  paragraph_gap_px: number;
  header_zone_pct: number;
  whitespace_strategy: string;
  grid_unit_px: number;
  pass: boolean;
};

export type TypographyPlan = {
  primary_font: string;
  secondary_font: string | null;
  name_size_pt: number;
  title_size_pt: number;
  section_size_pt: number;
  body_size_pt: number;
  line_height: number;
  pass: boolean;
};

export type ColorPlan = {
  primary_accent: string;
  text: string;
  muted: string;
  background: string;
  palette_style: string;
  contrast_ratio: number;
  pass: boolean;
};

export type HierarchyPlan = {
  reading_order: string[];
  emphasis_zones: string[];
  section_priority: Record<string, number>;
  name_weight: number;
  pass: boolean;
};

export type OriginalityCheck = {
  uniqueness_score: number;
  max_similarity: number;
  exceeds_threshold: boolean;
  benchmark_memory_clear: boolean;
  learning_memory_clear: boolean;
  batch_clear: boolean;
  redesign_required: boolean;
  pass: boolean;
};

export type QualityPrediction = {
  predicted_professional: number;
  predicted_premium: number;
  predicted_executive: number;
  predicted_modern: number;
  predicted_originality: number;
  predicted_ats: number;
  predicted_accessibility: number;
  predicted_user_appeal: number;
  predicted_click: number;
  predicted_download: number;
  overall_confidence: number;
  target_met: boolean;
  pass: boolean;
};

export type DesignSystemGatesChecklist = {
  pass: boolean;
  checks: DesignSystemGatesResult["checks"];
  design_system_version: string;
  bundle_id: string;
};

export type PreGenerationChecklist = {
  checklist_id: string;
  generated_at: string;
  design_intent: DesignIntent;
  layout_selection: LayoutSelection;
  visual_strategy: VisualStrategy;
  spacing_plan: SpacingPlan;
  typography_plan: TypographyPlan;
  color_plan: ColorPlan;
  hierarchy_plan: HierarchyPlan;
  originality_check: OriginalityCheck;
  quality_prediction: QualityPrediction;
  design_system_gates: DesignSystemGatesChecklist;
  all_pass: boolean;
};

export type CritiqueRole = "designer" | "recruiter" | "founder";

export type TripleCritiqueReport = {
  pass_number: 1 | 2 | 3;
  role: CritiqueRole;
  reviewed_at: string;
  categories: Array<{ category: string; score: number; pass: boolean; notes: string }>;
  revisions_applied: string[];
  confidence_before: number;
  confidence_after: number;
};

export type PremiumScores = {
  professional_score: number;
  premium_score: number;
  executive_score: number;
  modern_score: number;
  originality_score: number;
  ats_score: number;
  accessibility_score: number;
  user_appeal_prediction: number;
  click_prediction: number;
  download_prediction: number;
  first_impression_score: number;
  visual_rhythm_score: number;
  composition_score: number;
  density_score: number;
  design_identity_score: number;
  brand_identity_score: number;
  recognizability_score: number;
  visual_confidence_score: number;
  attention_flow_score: number;
  dna_alignment_score: number;
  overall_confidence: number;
  target_met: boolean;
  computed_at: string;
};

export type PremiumIntegrationContext = {
  research_session_id: string;
  brain_decisions: DesignDecisions;
  brain_quality: QualityScores;
  brain_confidence: DesignConfidenceReport;
  benchmark_principles: DesignPrinciple[];
  benchmark_patterns_used: string[];
  learning_notes: string[];
};

export type ProductionV3Result = {
  pass: boolean;
  worker_version: "3.0.0";
  generator: "premium-resume-generator";
  prototype_id: string;
  output_dir: string;
  status: "AWAITING_FOUNDER_APPROVAL";
  premium_scores: PremiumScores;
  confidence: ConfidenceScores;
  qa_pass: boolean;
  local_review_command: string;
  duplicate_redesigns: number;
  checklist_pass: boolean;
  triple_critique_pass: boolean;
  artifacts: string[];
};

export type RunProductionV3Options = {
  objective?: string;
  output_dir?: string;
  mcp_firecrawl_available?: boolean;
  learning_persist?: boolean;
  seed?: number;
};

export type V3PipelineContext = {
  objective: string;
  design_plan: DesignPlan;
  duplicate: DuplicateCheckResult;
  integration: PremiumIntegrationContext;
  checklist: PreGenerationChecklist;
};
