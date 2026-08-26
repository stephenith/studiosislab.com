/**
 * Resume Design Research & Planning Engine — shared types.
 */

export const SUPPORTED_INDUSTRIES = [
  "software",
  "finance",
  "marketing",
  "sales",
  "healthcare",
  "engineering",
  "construction",
  "government",
  "legal",
  "hr",
  "operations",
  "hospitality",
  "education",
  "creative",
  "academic",
  "student",
  "executive",
] as const;

export type IndustryId = (typeof SUPPORTED_INDUSTRIES)[number];

export type ExperienceLevel = "entry" | "mid" | "senior" | "executive";

export type IndustryAnalysis = {
  industry: IndustryId;
  experience_level: ExperienceLevel;
  hiring_style: string;
  ats_sensitivity: "high" | "medium" | "low";
  expected_resume_length: "one_page" | "two_page";
  visual_preference: "ats_first" | "visual_first" | "balanced" | "hybrid";
  target_recruiter_style: string;
  confidence: number;
};

export type TemplateComparison = {
  most_similar_templates: Array<{
    template_id: string;
    family: string;
    similarity_score: number;
    ats_score: number;
    visual_score: number;
  }>;
  reusable_ideas: string[];
  weaknesses_to_avoid: string[];
  improvement_opportunities: string[];
  uniqueness_score: number;
  target_similarity_max: number;
  pass_uniqueness: boolean;
};

export type TypographyPlan = {
  font_family: string;
  heading_hierarchy: Array<{ level: string; size_pt: number; weight: string }>;
  body_hierarchy: { size_pt: number; line_height: number; weight: string };
  spacing: { section_gap_px: number; paragraph_gap_px: number };
  character_spacing: { headings: number; body: number };
  visual_density: "compact" | "balanced" | "spacious";
  readability_score: number;
  accessibility_notes: string[];
};

export type ColorPlan = {
  primary_accent: string;
  secondary_accent: string;
  neutral_colors: string[];
  background: string;
  body_text: string;
  contrast_ratio: number;
  accessibility_score: number;
  corporate_appropriateness: "high" | "medium";
  palette_rationale: string;
};

export type LayoutPlan = {
  structure:
    | "single_column"
    | "dual_column"
    | "sidebar"
    | "executive"
    | "compact"
    | "minimal"
    | "modern"
    | "ats_first"
    | "visual_first"
    | "hybrid";
  margins_px: { top: number; right: number; bottom: number; left: number };
  whitespace_strategy: string;
  section_order: string[];
  reading_flow: string;
  column_structure: string;
};

export type ATSPlan = {
  compatibility_tier: "ats_safe" | "visual" | "hybrid";
  section_order: string[];
  keyword_strategy: string[];
  heading_structure: string[];
  text_hierarchy_rules: string[];
  forbidden_elements: string[];
  tables_allowed: boolean;
  images_allowed: boolean;
  icons_allowed: boolean;
  widgets_allowed: boolean;
  parse_reliability_score: number;
};

export type FirecrawlResearchSummary = {
  mcp_available: boolean;
  topics_researched: string[];
  findings: Array<{ topic: string; summary: string; temporary: true }>;
  copyright_safe: true;
  copied_layouts: false;
};

export type CursorResearchTask = {
  session_id: string;
  objective: string;
  mandatory_reads: string[];
  firecrawl_topics: string[];
  mcp_firecrawl_available: boolean;
  temporary_only: true;
};

export type CursorResearchResult = {
  session_id: string;
  success: boolean;
  duration_ms: number;
  sources_consulted: string[];
  intelligence_applied: string[];
  external_findings: FirecrawlResearchSummary | null;
  error?: string;
};

export type DesignBrief = {
  brief_id: string;
  session_id: string;
  generated_at: string;
  objective: string;
  industry: IndustryId;
  target_user: string;
  ats_strategy: string;
  layout_strategy: string;
  typography_plan: TypographyPlan;
  color_plan: ColorPlan;
  spacing_plan: { section_gap_px: number; margin_px: number; whitespace_notes: string };
  section_plan: { order: string[]; optional: string[] };
  research_summary: string;
  studiosislab_comparison: TemplateComparison;
  improvement_opportunities: string[];
  risk_assessment: string[];
  confidence: number;
  ats_plan: ATSPlan;
  layout_plan: LayoutPlan;
};

export type ResearchSession = {
  session_id: string;
  session_dir: string;
  objective: string;
  created_at: string;
  industry_analysis: IndustryAnalysis;
  template_comparison: TemplateComparison;
  firecrawl: FirecrawlResearchSummary;
  typography_plan: TypographyPlan;
  color_plan: ColorPlan;
  layout_plan: LayoutPlan;
  ats_plan: ATSPlan;
  design_brief: DesignBrief;
  cursor_result: CursorResearchResult;
};

export type ValidationResult = {
  pass: boolean;
  checks: Record<string, boolean>;
  errors: string[];
};
