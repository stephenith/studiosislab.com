/**
 * Margin system — A4, Letter, print-safe zones.
 */
import { LAYOUT_SAFE_AREA } from "../../domain/studiosislab/resume/LayoutRules.js";
import { DESIGN_SYSTEM_VERSION } from "./types.js";

/** A4 at 96 DPI — matches Fabric canvas */
export const A4_SAFE_MARGINS = {
  format: "A4",
  width_px: 794,
  height_px: 1123,
  margin_top_px: 48,
  margin_bottom_px: 48,
  margin_left_px: 56,
  margin_right_px: 56,
  print_safe_zone_px: 40,
} as const;

/** US Letter at 96 DPI */
export const LETTER_SAFE_MARGINS = {
  format: "Letter",
  width_px: 816,
  height_px: 1056,
  margin_top_px: 48,
  margin_bottom_px: 48,
  margin_left_px: 56,
  margin_right_px: 56,
  print_safe_zone_px: 40,
} as const;

export function buildMarginSystem() {
  return {
    version: DESIGN_SYSTEM_VERSION,
    a4: A4_SAFE_MARGINS,
    letter: LETTER_SAFE_MARGINS,
    default: {
      ...LAYOUT_SAFE_AREA,
      print_safe_zone_px: 40,
    },
    alignment_rules: [
      "Minimum 40px print-safe zone on all edges",
      "Content must not extend into bleed area",
      "Header band within top 25% of safe area",
    ],
    section_spacing: {
      between_sections_px: 16,
      after_header_px: 24,
      before_footer_px: 16,
    },
    baseline_rhythm_px: 8,
    generated_at: new Date().toISOString(),
  };
}
