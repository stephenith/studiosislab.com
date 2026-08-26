/**
 * StudiosisLab Resume Design Knowledge — shared types
 */

export type MarketRegion = "US" | "UK" | "GLOBAL";

export type AtsRiskLevel = "low" | "medium" | "high";

export type ChecklistSeverity = "required" | "recommended" | "warning";

export type ValidationCheckItem = {
  id: string;
  category: string;
  rule: string;
  severity: ChecklistSeverity;
  auto_checkable: boolean;
  check_hint: string;
};

export type SectionDefinition = {
  id: string;
  standard_heading: string;
  alternate_headings: string[];
  required: boolean;
  typical_order: number;
  ats_keywords: string[];
  placeholder_guidance: string;
};

export type TypographyScale = {
  element: string;
  min_pt: number;
  max_pt: number;
  recommended_pt: number;
  weight: string;
};

export type LayoutRule = {
  id: string;
  name: string;
  rule: string;
  ats_risk: AtsRiskLevel;
  studiosislab_current: string;
  target_standard: string;
};

export type DesignStandard = {
  id: string;
  name: string;
  description: string;
  requirements: string[];
};

export type CorpusAnalysisSummary = {
  analyzed_at: string;
  published_template_count: number;
  canvas_dimensions: Record<string, number>;
  fabric_versioned_count: number;
  legacy_format_count: number;
  object_type_distribution: Record<string, number>;
  font_families_observed: string[];
  font_size_range: { min: number; max: number; average: number };
  negative_positioning_objects: number;
  image_object_count: number;
  group_object_count: number;
  category_distribution: Record<string, number>;
  section_keyword_frequency: Record<string, number>;
  improvement_gaps: string[];
};

export type {
  DesignFamilyId,
  DesignFamily,
  TemplateDNA,
  ResumeGeneratorRule,
  ResumeIntelligenceDatabase,
  ResumeIntelligenceEngine,
} from "./intelligence/types.js";

export type ResumeDesignKnowledge = {
  version: string;
  domain: "studiosislab-resume";
  corpus: CorpusAnalysisSummary;
  design_standards: DesignStandard[];
  ats_standards: DesignStandard[];
  layout_rules: LayoutRule[];
  typography_scale: TypographyScale[];
  sections: SectionDefinition[];
  generation_spec: Record<string, unknown>;
  validation_checklist: ValidationCheckItem[];
  thumbnail_spec: Record<string, unknown>;
  sample_profile_standards: Record<string, unknown>;
  external_principles: Record<string, unknown>;
  gap_analysis: string[];
  intelligence: import("./intelligence/types.js").ResumeIntelligenceEngine;
};
