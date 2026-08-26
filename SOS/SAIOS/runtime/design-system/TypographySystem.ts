/**
 * Typography system — font hierarchy, rhythm, density.
 */
import { FONT_TIERS, TYPOGRAPHY_RULES } from "../../domain/studiosislab/resume/TypographyRules.js";
import type { DesignMemoryContext } from "./DesignMemoryBridge.js";
import type { TypographyRole } from "./types.js";
import { DESIGN_SYSTEM_VERSION } from "./types.js";

export type TypographyRoleSpec = {
  role: TypographyRole;
  size_pt: number;
  line_height: number;
  letter_spacing: number;
  weight: "normal" | "bold";
  max_line_length_chars: number;
};

export function buildTypographySystem(ctx: DesignMemoryContext) {
  const { effective_typography: t } = ctx;

  const roles: TypographyRoleSpec[] = [
    {
      role: "display",
      size_pt: t.name_size_pt,
      line_height: t.name_line_height,
      letter_spacing: 0,
      weight: "bold",
      max_line_length_chars: 32,
    },
    {
      role: "heading",
      size_pt: t.title_size_pt,
      line_height: 1.25,
      letter_spacing: 0,
      weight: "normal",
      max_line_length_chars: 48,
    },
    {
      role: "subheading",
      size_pt: t.title_size_pt - 1,
      line_height: 1.25,
      letter_spacing: 0,
      weight: "bold",
      max_line_length_chars: 56,
    },
    {
      role: "section",
      size_pt: t.section_size_pt,
      line_height: 1.2,
      letter_spacing: t.section_char_spacing / 1000,
      weight: "bold",
      max_line_length_chars: 40,
    },
    {
      role: "body",
      size_pt: t.body_size_pt,
      line_height: t.body_line_height,
      letter_spacing: 0,
      weight: "normal",
      max_line_length_chars: 72,
    },
    {
      role: "caption",
      size_pt: Math.max(t.min_body_pt, t.body_size_pt - 1),
      line_height: 1.3,
      letter_spacing: 0,
      weight: "normal",
      max_line_length_chars: 80,
    },
    {
      role: "label",
      size_pt: t.contact_size_pt,
      line_height: 1.25,
      letter_spacing: 0.02,
      weight: "normal",
      max_line_length_chars: 64,
    },
  ];

  return {
    version: DESIGN_SYSTEM_VERSION,
    roles,
    font_families: {
      ats_safe: [...FONT_TIERS.ats_safe],
      visual_approved: [...FONT_TIERS.visual_approved],
      restrict: [...FONT_TIERS.restrict],
    },
    rules: [...TYPOGRAPHY_RULES],
    paragraph_spacing_px: 8,
    section_spacing_px: ctx.effective_spacing.section_gap_px,
    name_prominence_ratio: t.name_size_pt / t.body_size_pt,
    widow_orphan_protection: {
      min_lines_together: 2,
      avoid_single_line_section_tail: true,
    },
    text_density: {
      min_body_pt: t.min_body_pt,
      max_body_pt: 12,
      heading_scale: t.heading_scale,
    },
    generated_at: new Date().toISOString(),
  };
}
