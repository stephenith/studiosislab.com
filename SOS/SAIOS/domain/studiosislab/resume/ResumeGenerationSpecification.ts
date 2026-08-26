/**
 * Resume Generation Specification — mandatory contract for all future Resume Workers.
 * Planning and knowledge only; does not generate templates.
 */
export const RESUME_GENERATION_SPECIFICATION = {
  version: "1.0.0",
  mandatory_for: "resume-worker",
  pre_generation: [
    "Load ResumeDesignKnowledge via loadResumeDesignKnowledge()",
    "Load ResumeIntelligenceEngine via loadResumeIntelligenceEngine()",
    "Consult Template DNA for target family and match spacing/typography profiles",
    "Apply RESUME_GENERATOR_RULES for the selected tier (ats_safe | visual)",
    "Read category from Engineering job metadata or ResumeCategories domain",
    "Select section set from SECTION_LIBRARY for target category",
    "Choose tier: ats_safe (default) or visual (explicit opt-in only)",
  ],
  canvas: {
    width: 794,
    height: 1123,
    page_size: "A4",
    background: "#ffffff",
    fabric_version: "6.9.1",
  },
  object_rules: [
    "Root JSON must include objects[] array",
    "First object: full-page background Rect at (0,0), locked, non-selectable",
    "All readable content in Textbox objects — never rasterized text",
    "Images optional in visual tier only; forbidden in ats_safe tier",
    "Groups max depth 2; prefer flat Textbox list for ATS tier",
  ],
  typography: {
    apply: "TYPOGRAPHY_SCALE from TypographyRules.ts",
    ats_safe_fonts_only: true,
    max_font_families: 2,
    min_body_pt: 10.5,
  },
  layout: {
    apply: "LAYOUT_RULES and LAYOUT_SAFE_AREA",
    reading_order: "top-to-bottom, left-to-right within sections",
    negative_coords_forbidden_on_content: true,
  },
  sections: {
    apply: "SECTION_LIBRARY standard headings",
    order: "CATEGORY_SECTION_DEFAULTS or explicit plan order",
    placeholders: "Fictional names and employers per SampleProfileStandards",
  },
  output_artifacts: [
    "template-json/{template_id}.json — Fabric canvas JSON",
    "templates/{template_id}.png — catalog thumbnail per ThumbnailSpecification",
    "manifest entry in templates.manifest.json (human review gate — not auto-written by worker)",
  ],
  post_generation: [
    "Run VALIDATION_CHECKLIST automated checks",
    "Emit validation report JSON to SOS/07_LOGS/saios/resume-validation/",
    "Queue for testing-worker QA — do not publish without PASS",
  ],
  forbidden: [
    "Modify existing published templates in src/",
    "Use Material Icons or icon fonts as section headings",
    "Skill progress bars or star ratings in ATS tier",
    "Tables for skills layout",
    "Photos in US/UK ATS tier",
  ],
} as const;

export type ResumeGenerationSpecification = typeof RESUME_GENERATION_SPECIFICATION;
