/**
 * Spacing system — scale, rhythm, section gaps.
 */
import { SPACING_SCALE, BASELINE_RHYTHM_PX, SECTION_SPACING_DEFAULT_PX } from "./DesignTokens.js";
import type { DesignMemoryContext } from "./DesignMemoryBridge.js";
import { DESIGN_SYSTEM_VERSION } from "./types.js";

export function buildSpacingSystem(ctx: DesignMemoryContext) {
  const s = ctx.effective_spacing;

  return {
    version: DESIGN_SYSTEM_VERSION,
    scale: [...SPACING_SCALE],
    baseline_rhythm_px: BASELINE_RHYTHM_PX,
    section_spacing_px: s.section_gap_px,
    paragraph_spacing_px: s.paragraph_gap_px,
    heading_body_gap_px: s.heading_body_gap_px,
    margin_px: s.margin_px,
    page_utilization: {
      min: s.page_utilization_min,
      max: s.page_utilization_max,
    },
    rules: [
      "All spacing values must be multiples of 4px",
      "Section gaps use scale values 12–24px",
      "Paragraph gaps use scale values 4–12px",
      "No arbitrary spacing outside the scale",
      `Default section spacing: ${SECTION_SPACING_DEFAULT_PX}px`,
    ],
    token_map: {
      xs: 4,
      sm: 8,
      md: 12,
      base: 16,
      lg: 20,
      xl: 24,
      "2xl": 32,
      "3xl": 40,
      "4xl": 48,
      "5xl": 64,
    },
    generated_at: new Date().toISOString(),
  };
}
