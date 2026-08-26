/**
 * Founder calibration v1 — production-batch-001 review learnings.
 * Append-only; never overwrites prior learning records.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  applyFeedbackBatch,
  DESIGN_MEMORY_PATH,
  LEARNING_ROOT,
  loadDesignMemory,
  saveDesignMemory,
} from "../resume-learning/design-memory.js";
import type { StructuredFeedback } from "../resume-learning/types.js";

const SOS_ROOT = resolve(import.meta.dirname, "../../../..");
export const FOUNDER_CALIBRATION_PATH = join(LEARNING_ROOT, "founder-calibration.json");
export const CALIBRATION_VERSION = "1.0.0";
export const HEADER_CALIBRATION_VERSION = "1.1.0";
export const HIERARCHY_CALIBRATION_VERSION = "1.2.0";
export const PREMIUM_CALIBRATION_VERSION = "1.3.0";
export const VISUAL_LANGUAGE_CALIBRATION_VERSION = "1.4.1";

/** StudiosisLab signature visual language — Founder Review #004 */
export const CALIBRATED_VISUAL_LANGUAGE = {
  signature_id: "studiosislab-premium-ats-v1",
  alignment_grid_px: 8,
  name_dominance_boost_pt: 2,
  title_letter_spacing: 30,
  title_weight: 500,
  experience_section_scale: 1.0,
  experience_marker_width_px: 56,
  focal_header: 1.0,
  focal_experience: 0.95,
  focal_summary: 0.72,
  supporting_sections: 0.55,
  role_company_split: true,
  role_to_company_gap_px: 6,
  experience_lead_gap_px: 10,
  bullet_metric_emphasis: true,
} as const;

/** Experience block design — Founder Review #004 */
export const CALIBRATED_EXPERIENCE_BLOCK = {
  role_pt: 12.5,
  company_pt: 11,
  company_weight: 500,
  date_pt: 10.5,
  date_weight: 400,
  bullet_pt: 11.5,
  bullet_weight: 400,
  bullet_metric_weight: 500,
  role_weight: 700,
  entry_gap_px: 20,
  role_to_company_gap_px: 6,
  company_to_date_gap_px: 6,
  date_to_bullet_gap_px: 8,
  bullet_gap_px: 10,
  achievement_lead_chars: 48,
} as const;

/** Premium header V2 — Founder Review #003 */
export const CALIBRATED_PREMIUM_HEADER = {
  accent_bar_height_px: 4,
  accent_bar_width_pct: 0.18,
  accent_bar_min_width_px: 96,
  accent_bar_max_width_px: 140,
  header_rule_width_px: 120,
  header_rule_thickness_px: 2,
  header_rule_gap_below_contact_px: 12,
  contact_letter_spacing: 20,
  name_tracking: 0,
  header_zone_max_pct: 0.24,
} as const;

/** Advanced section rhythm — Founder Review #003 */
export const CALIBRATED_SECTION_RHYTHM = {
  after_summary_px: 24,
  after_experience_px: 20,
  after_skills_px: 16,
  after_education_px: 12,
  after_certifications_px: 8,
  default_transition_px: 16,
} as const;

/** Premium visual identity — Founder Review #003 */
export const CALIBRATED_PREMIUM_IDENTITY = {
  section_marker_width_px: 48,
  section_marker_height_px: 3,
  section_rule_width_pct: 1.0,
  section_rule_thickness_px: 1,
  section_rule_gap_below_heading_px: 6,
  section_rule_gap_above_content_px: 10,
  divider_color_role: "divider" as const,
  accent_marker: true,
  header_identity: "accent-bar-plus-rule",
} as const;

/** Content density — Founder Review #003 */
export const CALIBRATED_CONTENT_DENSITY = {
  optimal_chars_per_line: 72,
  summary_line_break_target: 2,
  bullet_gap_px: 10,
  experience_entry_gap_px: 18,
  paragraph_composition_gap_px: 6,
  density_target: "balanced-rich" as const,
} as const;

/** Page width optimization — Founder Review #003 */
export const CALIBRATED_PAGE_WIDTH = {
  canvas_width_px: 794,
  canvas_height_px: 1123,
  margin_px: 44,
  print_safe_zone_px: 40,
  content_utilization_target: 0.88,
  content_width_px: 794 - 44 * 2,
} as const;

/** Calibrated visual hierarchy — Founder Review #002 */
export const CALIBRATED_HIERARCHY = {
  name_prominence_ratio_min: 3.3,
  name_weight: 800,
  title_weight: 500,
  section_weight: 700,
  contact_weight: 400,
  job_title_weight: 700,
  company_weight: 400,
  date_weight: 400,
  bullet_weight: 400,
  job_title_pt: 12,
  company_pt: 11.5,
  date_pt: 10.5,
  experience_entry_gap_px: 16,
  role_to_date_gap_px: 6,
  date_to_bullet_gap_px: 8,
  bullet_line_px: 22,
  section_separator_px: 20,
  vertical_rhythm_px: 8,
} as const;

/** Calibrated header rhythm — Founder Review #001 */
export const CALIBRATED_HEADER_RHYTHM = {
  name_below_accent_gap_px: 16,
  name_to_title_gap_px: 14,
  title_to_contact_gap_px: 12,
  contact_to_summary_gap_px: 20,
  min_clearance_px: 8,
} as const;

/** Calibrated typography — active pipeline defaults (v1.2 hierarchy) */
export const CALIBRATED_TYPOGRAPHY = {
  body_size_pt: 11.5,
  name_size_pt: 38,
  title_size_pt: 13,
  section_size_pt: 14,
  contact_size_pt: 10.5,
  body_line_height: 1.4,
  name_line_height: 1.12,
  section_char_spacing: 80,
} as const;

/** Calibrated spacing — premium vertical rhythm */
export const CALIBRATED_SPACING = {
  margin_px: 52,
  section_gap_px: 18,
  heading_body_gap_px: 14,
  paragraph_gap_px: 8,
  bullet_line_px: 22,
  plain_line_px: 18,
  header_top_px: 44,
  header_to_content_px: 72,
  page_utilization_target_min: 0.8,
  page_utilization_target_max: 0.92,
} as const;

export const FOUNDER_CALIBRATION_FEEDBACK: StructuredFeedback[] = [
  {
    id: "cal-v1-page-utilization",
    raw: "Increase page utilization from 55-60% to 80-90%. Remove large empty whitespace at bottom.",
    template_id: "production-batch-001",
    founder_decision: "revision",
    categories: ["whitespace", "layout", "visual_balance"],
    sentiment: "negative",
    action: "increase",
    signals: ["increase_page_fill", "reduce_bottom_whitespace", "improve_vertical_rhythm"],
    parsed_at: new Date().toISOString(),
  },
  {
    id: "cal-v1-typography",
    raw: "Text is visually too small at 100% zoom. Increase body and heading sizes while maintaining ATS compatibility.",
    template_id: "production-batch-001",
    founder_decision: "revision",
    categories: ["typography", "readability"],
    sentiment: "negative",
    action: "increase",
    signals: ["increase_body_size", "refine_font_scale", "improve_hierarchy"],
    parsed_at: new Date().toISOString(),
  },
  {
    id: "cal-v1-hierarchy",
    raw: "Strengthen name and section title emphasis. Improve spacing between sections and heading-to-body separation.",
    template_id: "production-batch-001",
    founder_decision: "revision",
    categories: ["hierarchy", "spacing", "typography"],
    sentiment: "negative",
    action: "improve",
    signals: ["improve_hierarchy", "increase_section_gap", "increase_vertical_rhythm"],
    parsed_at: new Date().toISOString(),
  },
  {
    id: "cal-v1-premium",
    raw: "Designs should resemble premium ATS templates — clean, minimal, modern, professional recruiter quality.",
    template_id: "production-batch-001",
    founder_decision: "revision",
    categories: ["visual_balance", "branding"],
    sentiment: "positive",
    action: "prefer",
    signals: ["modernize_layout", "ats_safe", "reinforce_current_direction"],
    parsed_at: new Date().toISOString(),
  },
  {
    id: "cal-v1-scoring",
    raw: "AI scores of Visual 100 / Premium 100 / Render 100 do not reflect actual design quality. Calibrate scoring to be realistic.",
    template_id: "production-batch-001",
    founder_decision: "revision",
    categories: ["layout"],
    sentiment: "negative",
    action: "improve",
    signals: ["calibrate_scoring", "never_assume_perfection"],
    parsed_at: new Date().toISOString(),
  },
];

export const FOUNDER_REVIEW_001_FEEDBACK: StructuredFeedback[] = [
  {
    id: "fr-001-header-overlap",
    raw: "Header text overlaps. Job title overlaps contact information. Increase spacing below candidate name.",
    template_id: "production-batch-001-software-engineer",
    founder_decision: "revision",
    categories: ["spacing", "hierarchy", "header"],
    sentiment: "negative",
    action: "increase",
    signals: [
      "fix_header_overlap",
      "increase_name_bottom_spacing",
      "increase_title_contact_separation",
      "improve_header_summary_rhythm",
      "ats_safe",
      "preserve_layout",
      "preserve_page_utilization",
    ],
    parsed_at: new Date().toISOString(),
  },
];

export const FOUNDER_REVIEW_002_FEEDBACK: StructuredFeedback[] = [
  {
    id: "fr-002-hierarchy",
    raw:
      "Increase name dominance. Strengthen hierarchy between name, title, contact, sections, company, position, bullets. Improve vertical rhythm and section separation. Premium but ATS-safe.",
    template_id: "production-batch-001-software-engineer",
    founder_decision: "revision",
    categories: ["hierarchy", "typography", "spacing", "premium"],
    sentiment: "negative",
    action: "improve",
    signals: [
      "increase_name_dominance",
      "improve_hierarchy",
      "improve_vertical_rhythm",
      "increase_section_gap",
      "improve_experience_readability",
      "premium_perception",
      "ats_safe",
      "preserve_layout",
      "no_clutter",
      "print_safe",
    ],
    parsed_at: new Date().toISOString(),
  },
];

export const FOUNDER_REVIEW_003_FEEDBACK: StructuredFeedback[] = [
  {
    id: "fr-003-premium-identity",
    raw:
      "Template is technically correct but does not feel premium or downloadable. Improve header identity, page balance, visual rhythm, section transitions, and design consistency while staying ATS-safe.",
    template_id: "production-batch-001-software-engineer",
    founder_decision: "revision",
    categories: ["premium", "header", "spacing", "visual_balance", "identity"],
    sentiment: "negative",
    action: "improve",
    signals: [
      "premium_header_v2",
      "page_width_optimization",
      "advanced_vertical_rhythm",
      "premium_visual_identity",
      "content_density",
      "first_impression",
      "design_consistency",
      "ats_safe",
      "print_safe",
      "no_clutter",
    ],
    parsed_at: new Date().toISOString(),
  },
];

export const FOUNDER_REVIEW_004_FEEDBACK: StructuredFeedback[] = [
  {
    id: "fr-004-visual-language",
    raw:
      "Template is technically strong but lacks distinctive design language. Improve header confidence, experience focal design, visual weight distribution, and StudiosisLab recognizability while staying ATS-safe.",
    template_id: "production-batch-001-software-engineer",
    founder_decision: "revision",
    categories: ["premium", "visual_identity", "experience", "typography", "design_language"],
    sentiment: "negative",
    action: "improve",
    signals: [
      "premium_header_v3",
      "experience_block_design",
      "visual_weight_distribution",
      "signature_design_language",
      "typography_refinement",
      "brand_recognizability",
      "emotional_appeal",
      "ats_safe",
      "print_safe",
    ],
    parsed_at: new Date().toISOString(),
  },
];

export const DESIGN_DNA_CALIBRATION_VERSION = "1.5.0";

/** Design DNA calibration — AGENT #080 permanent creative foundation */
export const CALIBRATED_DESIGN_DNA = {
  dna_version: "1.0.0",
  enabled: true,
  scan_path_enforced: true,
  experience_dwell_min_pct: 0.4,
  recognizability_floor: 90,
  trust_floor: 88,
  emotional_appeal_weight: 0.15,
} as const;

export const FOUNDER_DESIGN_DNA_FEEDBACK: StructuredFeedback[] = [
  {
    id: "agent-080-design-dna",
    raw:
      "Permanent Design DNA: teach factory WHY premium feels premium — eye guidance, trust, editorial composition, brand signature. Never copy competitors; extract design thinking only.",
    template_id: "studiosislab-design-dna",
    founder_decision: "approved",
    categories: ["design_dna", "premium", "visual_identity", "editorial", "brand"],
    sentiment: "positive",
    action: "strengthen",
    signals: [
      "design_dna_integration",
      "attention_flow",
      "visual_trust",
      "brand_language",
      "editorial_composition",
      "premium_behaviour",
      "founder_learning_append",
    ],
    parsed_at: new Date().toISOString(),
  },
];

export type FounderCalibrationRecord = {
  version: string;
  applied_at: string;
  source:
    | "production-batch-001-founder-review"
    | "founder-review-001"
    | "founder-review-002"
    | "founder-review-003"
    | "founder-review-004"
    | "agent-080-design-dna";
  principles: string[];
  typography: typeof CALIBRATED_TYPOGRAPHY;
  spacing: typeof CALIBRATED_SPACING;
  header_rhythm?: typeof CALIBRATED_HEADER_RHYTHM;
  hierarchy?: typeof CALIBRATED_HIERARCHY;
  premium_header?: typeof CALIBRATED_PREMIUM_HEADER;
  section_rhythm?: typeof CALIBRATED_SECTION_RHYTHM;
  premium_identity?: typeof CALIBRATED_PREMIUM_IDENTITY;
  content_density?: typeof CALIBRATED_CONTENT_DENSITY;
  page_width?: typeof CALIBRATED_PAGE_WIDTH;
  visual_language?: typeof CALIBRATED_VISUAL_LANGUAGE;
  experience_block?: typeof CALIBRATED_EXPERIENCE_BLOCK;
  design_dna?: typeof CALIBRATED_DESIGN_DNA;
  scoring_bands: {
    exceptional: string;
    excellent: string;
    very_good: string;
    good: string;
    needs_improvement: string;
  };
  feedback_entries: StructuredFeedback[];
};

export function appendFounderCalibration(): FounderCalibrationRecord {
  mkdirSync(LEARNING_ROOT, { recursive: true });

  const prior: FounderCalibrationRecord[] = existsSync(FOUNDER_CALIBRATION_PATH)
    ? (JSON.parse(readFileSync(FOUNDER_CALIBRATION_PATH, "utf8")) as FounderCalibrationRecord[])
    : [];

  const alreadyApplied = prior.some((r) => r.version === CALIBRATION_VERSION);
  if (alreadyApplied) {
    return prior.find((r) => r.version === CALIBRATION_VERSION)!;
  }

  const record: FounderCalibrationRecord = {
    version: CALIBRATION_VERSION,
    applied_at: new Date().toISOString(),
    source: "production-batch-001-founder-review",
    principles: [
      "Target 80-90% page utilization — no large empty footer blocks",
      "Body text ≥ 11.5pt readable at 100% zoom",
      "Name 34pt bold; section titles 13pt with clear heading-body separation",
      "Even whitespace rhythm; premium ATS recruiter aesthetic",
      "Calibrated scores — never assume perfection for technically correct output",
    ],
    typography: CALIBRATED_TYPOGRAPHY,
    spacing: CALIBRATED_SPACING,
    scoring_bands: {
      exceptional: "98-100",
      excellent: "95-97",
      very_good: "92-94",
      good: "88-91",
      needs_improvement: "below 88",
    },
    feedback_entries: FOUNDER_CALIBRATION_FEEDBACK,
  };

  prior.push(record);
  writeFileSync(FOUNDER_CALIBRATION_PATH, JSON.stringify(prior, null, 2));

  let memory = loadDesignMemory();
  memory = applyFeedbackBatch(memory, FOUNDER_CALIBRATION_FEEDBACK);
  memory.preferred_typography.min_body_pt = Math.max(
    memory.preferred_typography.min_body_pt,
    CALIBRATED_TYPOGRAPHY.body_size_pt,
  );
  memory.preferred_typography.heading_scale = Math.max(
    memory.preferred_typography.heading_scale,
    2.0,
  );
  memory.preferred_spacing.min_section_gap_px = Math.max(
    memory.preferred_spacing.min_section_gap_px,
    CALIBRATED_SPACING.section_gap_px,
  );
  memory.preferred_spacing.min_paragraph_gap_px = Math.max(
    memory.preferred_spacing.min_paragraph_gap_px,
    CALIBRATED_SPACING.paragraph_gap_px,
  );
  memory.preferred_visual_density = "balanced";
  memory.feedback_count += FOUNDER_CALIBRATION_FEEDBACK.length;
  saveDesignMemory(memory);

  return record;
}

export function appendFounderReview001Calibration(): FounderCalibrationRecord {
  mkdirSync(LEARNING_ROOT, { recursive: true });

  const prior: FounderCalibrationRecord[] = existsSync(FOUNDER_CALIBRATION_PATH)
    ? (JSON.parse(readFileSync(FOUNDER_CALIBRATION_PATH, "utf8")) as FounderCalibrationRecord[])
    : [];

  const alreadyApplied = prior.some((r) => r.version === HEADER_CALIBRATION_VERSION);
  if (alreadyApplied) {
    return prior.find((r) => r.version === HEADER_CALIBRATION_VERSION)!;
  }

  const record: FounderCalibrationRecord = {
    version: HEADER_CALIBRATION_VERSION,
    applied_at: new Date().toISOString(),
    source: "founder-review-001",
    principles: [
      "No header text overlap — measure textbox height for positioning",
      "14px minimum gap below candidate name",
      "12px minimum gap between job title and contact line",
      "20px vertical rhythm between contact block and summary section",
      "Preserve ATS compatibility and overall layout",
      "Do not reduce page utilization when correcting header spacing",
    ],
    typography: CALIBRATED_TYPOGRAPHY,
    spacing: CALIBRATED_SPACING,
    header_rhythm: CALIBRATED_HEADER_RHYTHM,
    scoring_bands: {
      exceptional: "98-100",
      excellent: "95-97",
      very_good: "92-94",
      good: "88-91",
      needs_improvement: "below 88",
    },
    feedback_entries: FOUNDER_REVIEW_001_FEEDBACK,
  };

  prior.push(record);
  writeFileSync(FOUNDER_CALIBRATION_PATH, JSON.stringify(prior, null, 2));

  let memory = loadDesignMemory();
  memory = applyFeedbackBatch(memory, FOUNDER_REVIEW_001_FEEDBACK);
  memory.feedback_count += FOUNDER_REVIEW_001_FEEDBACK.length;
  saveDesignMemory(memory);

  return record;
}

export function appendFounderReview002Calibration(): FounderCalibrationRecord {
  mkdirSync(LEARNING_ROOT, { recursive: true });

  const prior: FounderCalibrationRecord[] = existsSync(FOUNDER_CALIBRATION_PATH)
    ? (JSON.parse(readFileSync(FOUNDER_CALIBRATION_PATH, "utf8")) as FounderCalibrationRecord[])
    : [];

  const alreadyApplied = prior.some((r) => r.version === HIERARCHY_CALIBRATION_VERSION);
  if (alreadyApplied) {
    return prior.find((r) => r.version === HIERARCHY_CALIBRATION_VERSION)!;
  }

  const record: FounderCalibrationRecord = {
    version: HIERARCHY_CALIBRATION_VERSION,
    applied_at: new Date().toISOString(),
    source: "founder-review-002",
    principles: [
      "Name at 38pt bold — clear visual dominance over all other text",
      "Hierarchy ladder: name → title → contact → section → role → date → bullet",
      "Section headings 14pt with increased separation (18px gaps)",
      "Experience: role bold 12pt, dates muted 10.5pt, bullets 11.5pt with 22px line rhythm",
      "8px vertical rhythm grid across entire page",
      "Premium whitespace consistency without decorative clutter",
      "ATS-safe linear order and print-safe contrast preserved",
    ],
    typography: { ...CALIBRATED_TYPOGRAPHY },
    spacing: { ...CALIBRATED_SPACING },
    header_rhythm: { ...CALIBRATED_HEADER_RHYTHM },
    hierarchy: { ...CALIBRATED_HIERARCHY },
    scoring_bands: {
      exceptional: "98-100",
      excellent: "95-97",
      very_good: "92-94",
      good: "88-91",
      needs_improvement: "below 88",
    },
    feedback_entries: FOUNDER_REVIEW_002_FEEDBACK,
  };

  prior.push(record);
  writeFileSync(FOUNDER_CALIBRATION_PATH, JSON.stringify(prior, null, 2));

  let memory = loadDesignMemory();
  memory = applyFeedbackBatch(memory, FOUNDER_REVIEW_002_FEEDBACK);
  memory.preferred_typography.min_body_pt = Math.max(
    memory.preferred_typography.min_body_pt,
    CALIBRATED_TYPOGRAPHY.body_size_pt,
  );
  memory.preferred_typography.heading_scale = Math.max(
    memory.preferred_typography.heading_scale,
    2.2,
  );
  memory.preferred_spacing.min_section_gap_px = Math.max(
    memory.preferred_spacing.min_section_gap_px,
    CALIBRATED_SPACING.section_gap_px,
  );
  memory.feedback_count += FOUNDER_REVIEW_002_FEEDBACK.length;
  saveDesignMemory(memory);

  return record;
}

export function appendFounderReview003Calibration(): FounderCalibrationRecord {
  mkdirSync(LEARNING_ROOT, { recursive: true });

  const prior: FounderCalibrationRecord[] = existsSync(FOUNDER_CALIBRATION_PATH)
    ? (JSON.parse(readFileSync(FOUNDER_CALIBRATION_PATH, "utf8")) as FounderCalibrationRecord[])
    : [];

  const alreadyApplied = prior.some((r) => r.version === PREMIUM_CALIBRATION_VERSION);
  if (alreadyApplied) {
    return prior.find((r) => r.version === PREMIUM_CALIBRATION_VERSION)!;
  }

  const record: FounderCalibrationRecord = {
    version: PREMIUM_CALIBRATION_VERSION,
    applied_at: new Date().toISOString(),
    source: "founder-review-003",
    principles: [
      "Premium Header V2: short accent mark + header rule for strong first impression",
      "Page width optimized to 44px margins — wider text column, print-safe",
      "Advanced vertical rhythm: intentional section transitions (large→medium→small)",
      "Premium identity: accent section markers + subtle rules — memorable, ATS-safe",
      "Content density: balanced-rich composition without crowding",
      "Premium scoring evaluates first impression, rhythm, composition, identity — not just ATS",
    ],
    typography: { ...CALIBRATED_TYPOGRAPHY },
    spacing: { ...CALIBRATED_SPACING, margin_px: CALIBRATED_PAGE_WIDTH.margin_px },
    header_rhythm: { ...CALIBRATED_HEADER_RHYTHM },
    hierarchy: {
      ...CALIBRATED_HIERARCHY,
      experience_entry_gap_px: CALIBRATED_CONTENT_DENSITY.experience_entry_gap_px,
    },
    premium_header: { ...CALIBRATED_PREMIUM_HEADER },
    section_rhythm: { ...CALIBRATED_SECTION_RHYTHM },
    premium_identity: { ...CALIBRATED_PREMIUM_IDENTITY },
    content_density: { ...CALIBRATED_CONTENT_DENSITY },
    page_width: { ...CALIBRATED_PAGE_WIDTH },
    scoring_bands: {
      exceptional: "98-100",
      excellent: "95-97",
      very_good: "92-94",
      good: "88-91",
      needs_improvement: "below 88",
    },
    feedback_entries: FOUNDER_REVIEW_003_FEEDBACK,
  };

  prior.push(record);
  writeFileSync(FOUNDER_CALIBRATION_PATH, JSON.stringify(prior, null, 2));

  let memory = loadDesignMemory();
  memory = applyFeedbackBatch(memory, FOUNDER_REVIEW_003_FEEDBACK);
  memory.preferred_spacing.margin_px = Math.min(
    memory.preferred_spacing.margin_px,
    CALIBRATED_PAGE_WIDTH.margin_px,
  );
  memory.preferred_visual_density = "balanced";
  memory.feedback_count += FOUNDER_REVIEW_003_FEEDBACK.length;
  saveDesignMemory(memory);

  return record;
}

export function appendFounderReview004Calibration(): FounderCalibrationRecord {
  mkdirSync(LEARNING_ROOT, { recursive: true });

  const prior: FounderCalibrationRecord[] = existsSync(FOUNDER_CALIBRATION_PATH)
    ? (JSON.parse(readFileSync(FOUNDER_CALIBRATION_PATH, "utf8")) as FounderCalibrationRecord[])
    : [];

  const alreadyApplied = prior.some((r) => r.version === VISUAL_LANGUAGE_CALIBRATION_VERSION);
  if (alreadyApplied) {
    return prior.find((r) => r.version === VISUAL_LANGUAGE_CALIBRATION_VERSION)!;
  }

  const record: FounderCalibrationRecord = {
    version: VISUAL_LANGUAGE_CALIBRATION_VERSION,
    applied_at: new Date().toISOString(),
    source: "founder-review-004",
    principles: [
      "Premium Header V3: stronger name dominance (40pt) and title letter-spacing for confidence",
      "Experience block: split role/company, focal section marker, achievement-readable bullets",
      "Visual weight: header → experience (center) → summary → supporting sections",
      "StudiosisLab signature language via spacing, dividers, typography — no graphics",
      "Premium scoring includes brand identity and recognizability — avoid inflated perfect scores",
    ],
    typography: {
      ...CALIBRATED_TYPOGRAPHY,
      name_size_pt: 40,
      section_char_spacing: 90,
    },
    spacing: { ...CALIBRATED_SPACING, margin_px: CALIBRATED_PAGE_WIDTH.margin_px },
    header_rhythm: { ...CALIBRATED_HEADER_RHYTHM },
    hierarchy: { ...CALIBRATED_HIERARCHY },
    premium_header: {
      ...CALIBRATED_PREMIUM_HEADER,
      header_rule_width_px: 140,
      accent_bar_max_width_px: 148,
      contact_letter_spacing: 24,
    },
    section_rhythm: { ...CALIBRATED_SECTION_RHYTHM },
    premium_identity: { ...CALIBRATED_PREMIUM_IDENTITY },
    content_density: {
      ...CALIBRATED_CONTENT_DENSITY,
      experience_entry_gap_px: CALIBRATED_EXPERIENCE_BLOCK.entry_gap_px,
    },
    page_width: { ...CALIBRATED_PAGE_WIDTH },
    visual_language: { ...CALIBRATED_VISUAL_LANGUAGE },
    experience_block: { ...CALIBRATED_EXPERIENCE_BLOCK },
    scoring_bands: {
      exceptional: "98-100",
      excellent: "95-97",
      very_good: "92-94",
      good: "88-91",
      needs_improvement: "below 88",
    },
    feedback_entries: FOUNDER_REVIEW_004_FEEDBACK,
  };

  prior.push(record);
  writeFileSync(FOUNDER_CALIBRATION_PATH, JSON.stringify(prior, null, 2));

  let memory = loadDesignMemory();
  memory = applyFeedbackBatch(memory, FOUNDER_REVIEW_004_FEEDBACK);
  memory.preferred_typography.heading_scale = Math.max(
    memory.preferred_typography.heading_scale,
    2.3,
  );
  memory.feedback_count += FOUNDER_REVIEW_004_FEEDBACK.length;
  saveDesignMemory(memory);

  return record;
}

export function appendDesignDNACalibration(): FounderCalibrationRecord {
  mkdirSync(LEARNING_ROOT, { recursive: true });

  const prior: FounderCalibrationRecord[] = existsSync(FOUNDER_CALIBRATION_PATH)
    ? (JSON.parse(readFileSync(FOUNDER_CALIBRATION_PATH, "utf8")) as FounderCalibrationRecord[])
    : [];

  const alreadyApplied = prior.some((r) => r.version === DESIGN_DNA_CALIBRATION_VERSION);
  if (alreadyApplied) {
    return prior.find((r) => r.version === DESIGN_DNA_CALIBRATION_VERSION)!;
  }

  const record: FounderCalibrationRecord = {
    version: DESIGN_DNA_CALIBRATION_VERSION,
    applied_at: new Date().toISOString(),
    source: "agent-080-design-dna",
    principles: [
      "Design DNA teaches WHY premium feels premium — not spacing, typography, or ATS alone",
      "Ask where the eye moves — not what font size",
      "Experience is the hiring decision zone — focal mass and dwell time",
      "Trust through restraint, alignment, and predictable structure",
      "StudiosisLab signature is structural micro-identity — never graphics",
      "Founder reviews append taste signals to DNA — never overwrite",
    ],
    typography: { ...CALIBRATED_TYPOGRAPHY },
    spacing: { ...CALIBRATED_SPACING, margin_px: CALIBRATED_PAGE_WIDTH.margin_px },
    header_rhythm: { ...CALIBRATED_HEADER_RHYTHM },
    hierarchy: { ...CALIBRATED_HIERARCHY },
    premium_header: { ...CALIBRATED_PREMIUM_HEADER },
    section_rhythm: { ...CALIBRATED_SECTION_RHYTHM },
    premium_identity: { ...CALIBRATED_PREMIUM_IDENTITY },
    content_density: { ...CALIBRATED_CONTENT_DENSITY },
    page_width: { ...CALIBRATED_PAGE_WIDTH },
    visual_language: { ...CALIBRATED_VISUAL_LANGUAGE },
    experience_block: { ...CALIBRATED_EXPERIENCE_BLOCK },
    design_dna: { ...CALIBRATED_DESIGN_DNA },
    scoring_bands: {
      exceptional: "98-100",
      excellent: "95-97",
      very_good: "92-94",
      good: "88-91",
      needs_improvement: "below 88",
    },
    feedback_entries: FOUNDER_DESIGN_DNA_FEEDBACK,
  };

  prior.push(record);
  writeFileSync(FOUNDER_CALIBRATION_PATH, JSON.stringify(prior, null, 2));

  let memory = loadDesignMemory();
  memory = applyFeedbackBatch(memory, FOUNDER_DESIGN_DNA_FEEDBACK);
  memory.feedback_count += FOUNDER_DESIGN_DNA_FEEDBACK.length;
  saveDesignMemory(memory);

  return record;
}

export function loadLatestCalibration(): FounderCalibrationRecord | null {
  if (!existsSync(FOUNDER_CALIBRATION_PATH)) return null;
  try {
    const entries = JSON.parse(readFileSync(FOUNDER_CALIBRATION_PATH, "utf8")) as FounderCalibrationRecord[];
    return entries.at(-1) ?? null;
  } catch {
    return null;
  }
}

export function scoreBand(score: number): string {
  if (score >= 98) return "exceptional";
  if (score >= 95) return "excellent";
  if (score >= 92) return "very_good";
  if (score >= 88) return "good";
  return "needs_improvement";
}
