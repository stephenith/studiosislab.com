/**
 * Grid engine — alignment grid and column structure.
 */
import type { IndustryStyleDecision } from "./IndustryStyleEngine.js";
import type { SpacingSystem } from "./types.js";
import type { GridSystem } from "./types.js";

export function resolveGrid(
  style: IndustryStyleDecision,
  spacing: SpacingSystem,
): GridSystem {
  const singleColumn = style.ats_mode !== "visual_first";

  return {
    base_unit_px: 8,
    columns: singleColumn ? 1 : 2,
    margin_px: spacing.margin_px,
    gutter_px: singleColumn ? 0 : 24,
    alignment: style.conservative ? "left" : "mixed",
  };
}
