/**
 * DesignBrief Engine V1 — contracts (Agent #127).
 * Converts structured Brain/Mock planning output into deterministic
 * resume construction instructions. Dry-run only; never publishes.
 */

export type PageSize = "A4" | "Letter";

export type DesignBriefDecision = "dry_run_map" | "fixture";

/** Structured Brain / Mock planning payload (subset we consume). */
export type BrainPlanningOutput = {
  mock?: boolean;
  dry_run?: boolean;
  plan_type?: string;
  capability?: string;
  sections?: string[];
  layout?: {
    columns?: number;
    margins_mm?: { top?: number; right?: number; bottom?: number; left?: number };
    page_size?: string;
  };
  typography?: {
    heading?: string;
    body?: string;
    scale?: Array<string | number>;
  };
  notes?: string[];
  [key: string]: unknown;
};

export type LayoutBlueprint = {
  structure: "single_column" | "dual_column";
  columns: 1 | 2;
  page_size: PageSize;
  width_px: number;
  height_px: number;
  margins_mm: { top: number; right: number; bottom: number; left: number };
  margins_px: { top: number; right: number; bottom: number; left: number };
  content_width_px: number;
  reading_flow: "top_to_bottom";
  whitespace_strategy: string;
};

export type TypographyBlueprint = {
  heading_family: string;
  body_family: string;
  scale_pt: { name: number; heading: number; body: number; meta: number };
  line_height: { heading: number; body: number };
  weights: { name: number; heading: number; body: number };
  ats_safe_fonts_only: boolean;
};

export type SectionOrdering = {
  order: string[];
  required: string[];
  optional: string[];
  omitted: string[];
};

export type SpacingSystem = {
  unit_px: number;
  section_gap_px: number;
  item_gap_px: number;
  paragraph_gap_px: number;
  header_rule_gap_px: number;
  density: "compact" | "balanced" | "spacious";
};

export type ColorPalette = {
  id: string;
  background: string;
  body_text: string;
  heading_text: string;
  accent: string;
  rule: string;
  muted: string;
  contrast_ok: boolean;
  ats_safe: boolean;
  rationale: string;
};

export type AtsConstraints = {
  tier: "ats_safe";
  single_column_required: boolean;
  tables_allowed: false;
  images_allowed: false;
  icons_allowed: false;
  text_boxes_only: true;
  multi_column_forbidden: boolean;
  min_margin_mm: number;
  standard_section_headings: boolean;
  parse_notes: string[];
};

export type ComponentMapping = {
  section: string;
  component: string;
  role: string;
  required: boolean;
  children?: string[];
};

export type VisualGuidance = {
  hero_emphasis: string;
  typography_scale: {
    name_pt: number;
    heading_pt: number;
    body_pt: number;
    meta_pt: number;
  };
  spacing_scale: {
    section_gap_px: number;
    item_gap_px: number;
    paragraph_gap_px: number;
    density: "compact" | "balanced" | "spacious";
  };
  margin_strategy: string;
  alignment_rules: string[];
  section_rhythm: string;
  content_density: string;
  visual_weight: string;
  divider_strategy: "short" | "full" | "double";
  ats_constraints: string[];
  design_variant: number;
  visual_profile: string;
  content_profile: string;
  rule_style: "short" | "full" | "double";
  name_weight: number;
  /** Agent #236 — Design Intelligence fields consumed by Canvas/BlockRenderer */
  layout_intent?: string;
  visual_hierarchy?: string;
  page_fill_objective?: number;
  typography_strategy?: string;
  spacing_strategy?: string;
  design_personality?: string[];
  information_density?: string;
  visual_rhythm?: string;
  layout_family?: string;
  role_family?: string;
  header_style?: string;
  design_family?: string;
  layout_architecture?: string;
  header_system?: string;
  section_title_system?: string;
  alignment_system?: string;
  accent_shape_strategy?: string;
  sidebar_policy?: string;
  color_strategy?: Record<string, string>;
  spacing_tokens?: Record<string, unknown>;
  ats_risk_level?: string;
  silhouette_hint?: string;
  family_contract?: unknown;
};

export type ResumeJsonInstruction = {
  version: "designbrief-resume-json-1.0.0";
  dry_run: true;
  publication_allowed: false;
  template_generated: false;
  page: {
    size: PageSize;
    width_px: number;
    height_px: number;
    background: string;
  };
  typography: TypographyBlueprint;
  spacing: SpacingSystem;
  colors: ColorPalette;
  visual_guidance?: VisualGuidance;
  sections: Array<{
    id: string;
    component: string;
    order: number;
    placeholder_content: "fictional_sample_only";
  }>;
  objects_plan: Array<{
    kind: string;
    section: string;
    component: string;
    fill?: string;
    fontFamily?: string;
    fontSize?: number;
  }>;
};

export type DesignBrief = {
  brief_id: string;
  version: "1.0.0";
  created_at: string;
  source: {
    provider: "mock";
    task_id: string | null;
    skill_id: string | null;
    plan_type: string | null;
    fingerprint: string | null;
  };
  dry_run: true;
  live_enabled: false;
  publication_allowed: false;
  template_generated: false;
  renderer_ready: boolean;
  layout: LayoutBlueprint;
  typography: TypographyBlueprint;
  sections: SectionOrdering;
  spacing: SpacingSystem;
  colors: ColorPalette;
  ats: AtsConstraints;
  visual_guidance: VisualGuidance;
  components: ComponentMapping[];
  resume_json: ResumeJsonInstruction;
  notes: string[];
  validation: {
    pass: boolean;
    errors: string[];
    warnings: string[];
  };
};

export type DesignBriefBuildInput = {
  brain_output: BrainPlanningOutput;
  task_id?: string | null;
  skill_id?: string | null;
  fixture?: boolean;
};

export type DesignBriefEngineResult = {
  brief: DesignBrief;
  wrote_artifacts: string[];
  overall: "PASS" | "FAIL";
};
