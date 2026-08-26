/**
 * Resume Design Brain — shared types.
 */
import type { IndustryId } from "../research/types.js";

export type DesignLanguage =
  | "corporate-modern"
  | "executive-refined"
  | "minimal-ats"
  | "creative-expressive"
  | "healthcare-clinical"
  | "technical-precise";

export type VisualStyle = "premium" | "professional" | "conservative" | "modern" | "minimal" | "expressive";

export type AtsMode = "ats_first" | "visual_first" | "hybrid" | "balanced";

export type GridSystem = {
  base_unit_px: number;
  columns: number;
  margin_px: number;
  gutter_px: number;
  alignment: "left" | "center" | "mixed";
};

export type SpacingSystem = {
  section_gap_px: number;
  paragraph_gap_px: number;
  margin_px: number;
  header_zone_pct: number;
  density: "compact" | "balanced" | "spacious";
};

export type TypographySystem = {
  primary_font: string;
  secondary_font: string | null;
  name_size_pt: number;
  title_size_pt: number;
  section_size_pt: number;
  body_size_pt: number;
  line_height: number;
  heading_char_spacing: number;
  hierarchy_levels: Array<{ level: string; size_pt: number; weight: string }>;
};

export type ColorSystem = {
  primary_accent: string;
  secondary_accent: string;
  text: string;
  muted: string;
  background: string;
  use_accent: boolean;
  contrast_ratio: number;
  palette_style: "calm-professional" | "executive-neutral" | "creative-accent";
};

export type VisualHierarchy = {
  name_weight: number;
  title_weight: number;
  section_weight: number;
  body_weight: number;
  emphasis_zones: string[];
  reading_order: string[];
};

export type ComponentEmphasis = {
  header: number;
  summary: number;
  experience: number;
  education: number;
  skills: number;
  decorations: number;
};

export type DesignDecisions = {
  decision_id: string;
  generated_at: string;
  objective: string;
  industry: IndustryId;
  design_language: DesignLanguage;
  visual_style: VisualStyle;
  layout_family: string;
  grid_system: GridSystem;
  spacing_system: SpacingSystem;
  typography_system: TypographySystem;
  color_system: ColorSystem;
  section_order: string[];
  section_priority: Record<string, number>;
  visual_hierarchy: VisualHierarchy;
  component_emphasis: ComponentEmphasis;
  ats_mode: AtsMode;
  decoration_budget: number;
  premium_feel: boolean;
  conservative: boolean;
  originality_score: number;
  confidence: number;
  reasoning: string[];
};

export type QualityDimension =
  | "visual_hierarchy"
  | "balance"
  | "whitespace"
  | "alignment"
  | "typography"
  | "color_harmony"
  | "readability"
  | "professional_appearance"
  | "premium_perception"
  | "originality"
  | "ats_compatibility"
  | "accessibility";

export type QualityScores = Record<QualityDimension, number> & {
  overall_quality: number;
  target_met: boolean;
};

export type DesignConfidenceReport = {
  overall: number;
  decision_confidence: number;
  research_confidence: number;
  memory_confidence: number;
  quality_confidence: number;
  target_met: boolean;
  computed_at: string;
};

export type BrainRunResult = {
  pass: boolean;
  session_id: string;
  session_dir: string;
  decisions: DesignDecisions;
  quality: QualityScores;
  confidence: DesignConfidenceReport;
};

export type BrainRunOptions = {
  objective: string;
  industry?: IndustryId;
  mcp_firecrawl_available?: boolean;
  persist?: boolean;
};
