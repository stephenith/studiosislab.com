/**
 * Core design tokens — spacing, typography roles, baseline rhythm.
 */
import { TYPOGRAPHY_SCALE } from "../../domain/studiosislab/resume/TypographyRules.js";
import { LAYOUT_SAFE_AREA } from "../../domain/studiosislab/resume/LayoutRules.js";
import { RESUME_GENERATION_SPECIFICATION } from "../../domain/studiosislab/resume/ResumeGenerationSpecification.js";
import type { DesignTokenSet, SpacingToken, TypographyRole } from "./types.js";
import { DESIGN_SYSTEM_VERSION } from "./types.js";

export const SPACING_SCALE: readonly SpacingToken[] = [
  4, 8, 12, 16, 20, 24, 32, 40, 48, 64,
] as const;

export const TYPOGRAPHY_ROLES: readonly TypographyRole[] = [
  "display",
  "heading",
  "subheading",
  "section",
  "body",
  "caption",
  "label",
] as const;

export const BASELINE_RHYTHM_PX = 8;
export const SECTION_SPACING_DEFAULT_PX = 16;
export const PARAGRAPH_SPACING_DEFAULT_PX = 8;

export function buildDesignTokens(): DesignTokenSet {
  return {
    version: DESIGN_SYSTEM_VERSION,
    spacing: [...SPACING_SCALE],
    typography_roles: [...TYPOGRAPHY_ROLES],
    grid_layouts: [
      "classic-ats",
      "executive",
      "corporate",
      "modern",
      "sidebar",
      "creative-ats-safe",
      "compact",
      "student",
      "technical",
      "dual-column",
      "executive-split",
      "minimal",
      "sidebar-layout",
    ],
    color_palettes: [
      "corporate-blue",
      "minimal-gray",
      "executive-navy",
      "emerald",
      "teal",
      "indigo",
      "slate",
      "professional-black",
      "muted-accent",
    ],
    generated_at: new Date().toISOString(),
  };
}

export function buildTokenReference() {
  return {
    version: DESIGN_SYSTEM_VERSION,
    spacing_scale: SPACING_SCALE,
    typography_roles: TYPOGRAPHY_ROLES,
    baseline_rhythm_px: BASELINE_RHYTHM_PX,
    section_spacing_default_px: SECTION_SPACING_DEFAULT_PX,
    paragraph_spacing_default_px: PARAGRAPH_SPACING_DEFAULT_PX,
    canvas: RESUME_GENERATION_SPECIFICATION.canvas,
    safe_area: LAYOUT_SAFE_AREA,
    domain_typography_scale: TYPOGRAPHY_SCALE,
    alignment_rules: [
      "Left-align body content to single gutter",
      "Section headings align to content gutter",
      "No center-origin textboxes in ATS tier",
      "Maximum 3 left-alignment columns",
    ],
    generated_at: new Date().toISOString(),
  };
}
