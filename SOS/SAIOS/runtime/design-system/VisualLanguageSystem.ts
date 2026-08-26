/**
 * StudiosisLab signature visual language — recognizability without decoration.
 * Founder Review #004.
 */
import type { DesignMemoryContext } from "./DesignMemoryBridge.js";
import { DESIGN_SYSTEM_VERSION } from "./types.js";

export const VISUAL_LANGUAGE_RULES = {
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

export type VisualLanguageSpec = typeof VISUAL_LANGUAGE_RULES;

export function buildVisualLanguageSystem(ctx: DesignMemoryContext) {
  const lang = ctx.effective_visual_language;
  const t = ctx.effective_typography;

  return {
    version: DESIGN_SYSTEM_VERSION,
    spec: lang,
    signature: {
      id: lang.signature_id,
      alignment_grid_px: lang.alignment_grid_px,
      identity: "accent-marker + section rule + role/company split + focal experience",
    },
    typography: {
      name_size_pt: t.name_size_pt + lang.name_dominance_boost_pt,
      title_letter_spacing: lang.title_letter_spacing,
      title_weight: lang.title_weight,
    },
    focal_weights: {
      header: lang.focal_header,
      experience: lang.focal_experience,
      summary: lang.focal_summary,
      supporting: lang.supporting_sections,
    },
    experience: {
      section_scale: lang.experience_section_scale,
      marker_width_px: lang.experience_marker_width_px,
      role_company_split: lang.role_company_split,
      role_to_company_gap_px: lang.role_to_company_gap_px,
      lead_gap_px: lang.experience_lead_gap_px,
      bullet_metric_emphasis: lang.bullet_metric_emphasis,
    },
    rules: [
      "StudiosisLab signature: short accent + marker/rule sections + split role/company",
      "Visual weight: header (primary) → experience (focal) → summary (secondary) → rest (supporting)",
      "Typography contrast via weight and spacing — not size inflation",
      "Experience is the visual center of the page",
      "ATS-safe linear text order preserved",
    ],
    generated_at: new Date().toISOString(),
  };
}
