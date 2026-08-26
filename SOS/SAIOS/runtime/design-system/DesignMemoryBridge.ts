/**
 * Bridge to founder learning memory and calibration — no duplication.
 */
import { loadDesignMemory } from "../workers/resume-learning/design-memory.js";
import {
  CALIBRATED_SPACING,
  CALIBRATED_TYPOGRAPHY,
  CALIBRATED_HEADER_RHYTHM,
  CALIBRATED_HIERARCHY,
  CALIBRATED_PREMIUM_HEADER,
  CALIBRATED_SECTION_RHYTHM,
  CALIBRATED_PREMIUM_IDENTITY,
  CALIBRATED_CONTENT_DENSITY,
  CALIBRATED_PAGE_WIDTH,
  CALIBRATED_VISUAL_LANGUAGE,
  CALIBRATED_EXPERIENCE_BLOCK,
  CALIBRATED_DESIGN_DNA,
  loadLatestCalibration,
} from "../workers/resume-production/founder-calibration.js";
import { loadResumeDesignKnowledge } from "../../domain/studiosislab/resume/ResumeDesignKnowledge.js";

export type DesignMemoryContext = {
  design_memory: ReturnType<typeof loadDesignMemory>;
  founder_calibration: ReturnType<typeof loadLatestCalibration>;
  domain_knowledge: ReturnType<typeof loadResumeDesignKnowledge>;
  effective_typography: typeof CALIBRATED_TYPOGRAPHY & {
    min_body_pt: number;
    heading_scale: number;
    font_families: string[];
  };
  effective_spacing: {
    margin_px: number;
    section_gap_px: number;
    paragraph_gap_px: number;
    heading_body_gap_px: number;
    page_utilization_min: number;
    page_utilization_max: number;
  };
  effective_header_rhythm: typeof CALIBRATED_HEADER_RHYTHM;
  effective_hierarchy: typeof CALIBRATED_HIERARCHY;
  effective_premium_header: typeof CALIBRATED_PREMIUM_HEADER;
  effective_section_rhythm: typeof CALIBRATED_SECTION_RHYTHM;
  effective_premium_identity: typeof CALIBRATED_PREMIUM_IDENTITY;
  effective_content_density: typeof CALIBRATED_CONTENT_DENSITY;
  effective_page_width: typeof CALIBRATED_PAGE_WIDTH;
  effective_visual_language: typeof CALIBRATED_VISUAL_LANGUAGE;
  effective_experience_block: typeof CALIBRATED_EXPERIENCE_BLOCK;
  effective_design_dna: typeof CALIBRATED_DESIGN_DNA;
};

export function loadDesignMemoryContext(applyCalibration = true): DesignMemoryContext {
  const design_memory = loadDesignMemory();
  const founder_calibration = loadLatestCalibration();
  const domain_knowledge = loadResumeDesignKnowledge();

  const calTypography = applyCalibration
    ? (founder_calibration?.typography ?? CALIBRATED_TYPOGRAPHY)
    : null;
  const calSpacing = applyCalibration
    ? (founder_calibration?.spacing ?? CALIBRATED_SPACING)
    : null;
  const calPageWidth = applyCalibration
    ? (founder_calibration?.page_width ?? CALIBRATED_PAGE_WIDTH)
    : CALIBRATED_PAGE_WIDTH;

  return {
    design_memory,
    founder_calibration,
    domain_knowledge,
    effective_typography: {
      body_size_pt: Math.max(
        design_memory.preferred_typography.min_body_pt,
        calTypography?.body_size_pt ?? 11,
      ),
      name_size_pt: calTypography?.name_size_pt ?? 32,
      title_size_pt: calTypography?.title_size_pt ?? 14,
      section_size_pt: calTypography?.section_size_pt ?? 13,
      contact_size_pt: calTypography?.contact_size_pt ?? 11,
      body_line_height: calTypography?.body_line_height ?? 1.35,
      name_line_height: calTypography?.name_line_height ?? 1.15,
      section_char_spacing: calTypography?.section_char_spacing ?? 60,
      min_body_pt: design_memory.preferred_typography.min_body_pt,
      heading_scale: design_memory.preferred_typography.heading_scale,
      font_families: design_memory.preferred_typography.font_families,
    },
    effective_spacing: {
      margin_px: calPageWidth.margin_px,
      section_gap_px: Math.max(
        design_memory.preferred_spacing.min_section_gap_px,
        calSpacing?.section_gap_px ?? 16,
      ),
      paragraph_gap_px: Math.max(
        design_memory.preferred_spacing.min_paragraph_gap_px,
        calSpacing?.paragraph_gap_px ?? 8,
      ),
      heading_body_gap_px: calSpacing?.heading_body_gap_px ?? 12,
      page_utilization_min: calSpacing?.page_utilization_target_min ?? 0.8,
      page_utilization_max: calSpacing?.page_utilization_target_max ?? 0.9,
    },
    effective_header_rhythm: {
      ...CALIBRATED_HEADER_RHYTHM,
      ...(founder_calibration?.header_rhythm ?? {}),
    },
    effective_hierarchy: {
      ...CALIBRATED_HIERARCHY,
      ...(founder_calibration?.hierarchy ?? {}),
    },
    effective_premium_header: {
      ...CALIBRATED_PREMIUM_HEADER,
      ...(founder_calibration?.premium_header ?? {}),
    },
    effective_section_rhythm: {
      ...CALIBRATED_SECTION_RHYTHM,
      ...(founder_calibration?.section_rhythm ?? {}),
    },
    effective_premium_identity: {
      ...CALIBRATED_PREMIUM_IDENTITY,
      ...(founder_calibration?.premium_identity ?? {}),
    },
    effective_content_density: {
      ...CALIBRATED_CONTENT_DENSITY,
      ...(founder_calibration?.content_density ?? {}),
    },
    effective_page_width: {
      ...CALIBRATED_PAGE_WIDTH,
      ...(founder_calibration?.page_width ?? {}),
      content_width_px:
        founder_calibration?.page_width?.content_width_px ??
        calPageWidth.canvas_width_px - calPageWidth.margin_px * 2,
    },
    effective_visual_language: {
      ...CALIBRATED_VISUAL_LANGUAGE,
      ...(founder_calibration?.visual_language ?? {}),
    },
    effective_experience_block: {
      ...CALIBRATED_EXPERIENCE_BLOCK,
      ...(founder_calibration?.experience_block ?? {}),
    },
    effective_design_dna: {
      ...CALIBRATED_DESIGN_DNA,
      ...(founder_calibration?.design_dna ?? {}),
    },
  };
}
