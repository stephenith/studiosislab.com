/**
 * Resume Intelligence Engine — type definitions (#054)
 */

export type DesignFamilyId =
  | "executive-ats"
  | "corporate-modern"
  | "corporate-sidebar"
  | "minimal-ats"
  | "creative-visual"
  | "designer-portfolio"
  | "healthcare-professional"
  | "engineering-technical"
  | "academic-entry"
  | "finance-conservative"
  | "sales-marketing-visual"
  | "sales-marketing-ats"
  | "operations-management"
  | "administrative-ats"
  | "hospitality-service"
  | "hr-people-ops"
  | "analytics-professional"
  | "legal-formal"
  | "government-formal";

export type ColumnStructure =
  | "single"
  | "sidebar-left"
  | "sidebar-right"
  | "two-column-balanced";

export type SpacingProfile = {
  median_vertical_gap_px: number;
  left_gutter_px: number;
  negative_position_count: number;
};

export type TypographyProfile = {
  font_families: string[];
  font_family_count: number;
  size_min: number;
  size_max: number;
  size_avg: number;
};

export type ColorProfile = {
  dominant_colors: string[];
  has_dark_sidebar: boolean;
};

export type SectionProfile = {
  detected_order: string[];
  column_structure: ColumnStructure;
};

export type TemplateDNA = {
  id: string;
  family: DesignFamilyId;
  ats_score: number;
  visual_score: number;
  spacing_profile: SpacingProfile;
  typography_profile: TypographyProfile;
  color_profile: ColorProfile;
  section_profile: SectionProfile;
  reusable_components: string[];
  weaknesses: string[];
  improvement_opportunities: string[];
};

export type DesignFamily = {
  id: DesignFamilyId;
  display_name: string;
  description: string;
  template_ids: string[];
  template_count: number;
  strengths: string[];
  weaknesses: string[];
  spacing_rules: string[];
  typography_rules: string[];
  reusable_blocks: string[];
  ats_score: number;
  visual_score: number;
  preferred_for_roles: string[];
  tier: "ats_safe" | "visual" | "hybrid";
};

export type ResumeGeneratorRule = {
  id: string;
  category: "spacing" | "typography" | "color" | "layout" | "sections" | "decoration" | "balance" | "widgets";
  rule: string;
  value?: string | number;
  min?: number;
  max?: number;
  severity: "required" | "recommended" | "forbidden";
  applies_to_tiers: Array<"ats_safe" | "visual" | "all">;
  rationale: string;
};

export type ResumeIntelligenceDatabase = {
  version: string;
  analyzed_at: string;
  published_template_count: number;
  design_families: DesignFamily[];
  template_dna: TemplateDNA[];
  family_index: Record<DesignFamilyId, string[]>;
};

export type ResumeIntelligenceEngine = {
  version: string;
  database: ResumeIntelligenceDatabase;
  generator_rules: ResumeGeneratorRule[];
};
