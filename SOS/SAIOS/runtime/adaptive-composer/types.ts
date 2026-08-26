/**
 * Adaptive Resume Composer — type definitions.
 */
import type { DesignDecisions } from "../design-brain/types.js";
import type { IndustryId } from "../research/types.js";

export const COMPOSER_DUPLICATE_THRESHOLD = 0.7;
export const PREMIUM_SCORE_TARGET = 98;
export const VISUAL_RENDER_TARGET = 98;
export const ATS_SCORE_TARGET = 100;

export type ComponentCategory =
  | "header"
  | "professional_summary"
  | "experience"
  | "education"
  | "skills"
  | "projects"
  | "certification"
  | "achievements"
  | "languages"
  | "contact"
  | "sidebar"
  | "divider"
  | "cta"
  | "accent"
  | "whitespace"
  | "grid";

export type ComponentVariant =
  | "corporate"
  | "executive"
  | "modern"
  | "minimal"
  | "tech"
  | "creative"
  | "luxury"
  | "ats"
  | "healthcare"
  | "finance"
  | "marketing"
  | "software"
  | "student";

export type LayoutMode =
  | "single_column"
  | "two_column"
  | "hybrid"
  | "executive"
  | "minimal"
  | "sidebar"
  | "full_width";

export type CompositionMode =
  | "ats"
  | "premium"
  | "executive"
  | "creative"
  | "student";

export type SelectedComponent = {
  category: ComponentCategory;
  variant: ComponentVariant;
  justification: string;
};

export type SpacingStrategy = {
  vertical_rhythm_px: number;
  section_spacing_px: number;
  paragraph_spacing_px: number;
  line_spacing: number;
  margin_top_px: number;
  margin_bottom_px: number;
  margin_left_px: number;
  margin_right_px: number;
  padding_section_px: number;
  whitespace_distribution: "balanced" | "generous" | "compact";
  justification: string[];
};

export type TypographyStrategy = {
  primary_font: string;
  secondary_font: string;
  header_weight: number;
  body_weight: number;
  name_size_pt: number;
  title_size_pt: number;
  section_header_pt: number;
  body_size_pt: number;
  line_height: number;
  letter_spacing: number;
  header_scale_ratio: number;
  justification: string[];
};

export type HierarchyStrategy = {
  section_order: string[];
  emphasis_weights: Record<string, number>;
  header_prominence: "high" | "medium" | "low";
  footer_prominence: "high" | "medium" | "low";
  justification: string[];
};

export type LayoutComposition = {
  layout_mode: LayoutMode;
  column_count: 1 | 2;
  sidebar_width_pct: number | null;
  grid_columns: number;
  grid_gutter_px: number;
  alignment: "left" | "center" | "justified";
  justification: string[];
};

export type CompositionPlan = {
  composition_id: string;
  objective: string;
  industry: IndustryId;
  mode: CompositionMode;
  country: string;
  section_order: string[];
  components: SelectedComponent[];
  layout: LayoutComposition;
  spacing: SpacingStrategy;
  typography: TypographyStrategy;
  hierarchy: HierarchyStrategy;
  fingerprint: string;
  redesign_count: number;
};

export type CompositionConfidence = {
  premium_score: number;
  recruiter_score: number;
  ats_score: number;
  visual_render_prediction: number;
  founder_prediction: "REJECT" | "REVISION" | "LIKELY APPROVE";
  originality_score: number;
  composition_confidence: number;
  targets_met: {
    premium: boolean;
    ats: boolean;
    visual_render: boolean;
    founder: boolean;
  };
};

export type AdaptiveComposerOptions = {
  objective: string;
  mode?: CompositionMode;
  country?: string;
  seed?: number;
  mcp_firecrawl_available?: boolean;
  persist?: boolean;
  max_redesigns?: number;
  prior_fingerprints?: string[];
};

export type AdaptiveComposerResult = {
  pass: boolean;
  composition_id: string;
  output_dir: string;
  plan: CompositionPlan;
  confidence: CompositionConfidence;
  artifacts: string[];
  originality: {
    max_similarity: number;
    redesign_required: boolean;
    redesign_count: number;
  };
  brain_decisions?: DesignDecisions;
};
