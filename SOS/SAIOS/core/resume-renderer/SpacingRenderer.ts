/**
 * SpacingRenderer — resolve spacing tokens from Resume JSON.
 */
import type { ResolvedSpacing, ResumeJsonInput } from "./types.js";

export function renderSpacing(input: ResumeJsonInput): ResolvedSpacing {
  const s = input.spacing;
  return {
    unit_px: s.unit_px,
    section_gap_px: s.section_gap_px,
    item_gap_px: s.item_gap_px,
    paragraph_gap_px: s.paragraph_gap_px,
    header_rule_gap_px: s.header_rule_gap_px,
  };
}
