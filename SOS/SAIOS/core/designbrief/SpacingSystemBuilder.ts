/**
 * Spacing system — layout margins + DNA-influenced density from planning.
 */
import type {
  BrainPlanningOutput,
  LayoutBlueprint,
  SpacingSystem,
} from "./types.js";

export function buildSpacingSystem(
  layout: LayoutBlueprint,
  output?: BrainPlanningOutput,
): SpacingSystem {
  const fromPlan =
    output &&
    typeof output.section_gap_px === "number" &&
    Number(output.section_gap_px) > 0;

  if (fromPlan && output) {
    const density =
      output.spacing_density === "compact" ||
      output.spacing_density === "spacious" ||
      output.spacing_density === "balanced"
        ? output.spacing_density
        : "balanced";
    return {
      unit_px: 4,
      section_gap_px: Math.max(16, Number(output.section_gap_px)),
      item_gap_px: Math.max(6, Number(output.item_gap_px ?? 10)),
      paragraph_gap_px: Math.max(4, Number(output.paragraph_gap_px ?? 8)),
      header_rule_gap_px: density === "spacious" ? 10 : 8,
      density,
    };
  }

  const avgMargin =
    (layout.margins_px.top +
      layout.margins_px.right +
      layout.margins_px.bottom +
      layout.margins_px.left) /
    4;
  const density: SpacingSystem["density"] =
    avgMargin < 40 ? "compact" : avgMargin > 56 ? "spacious" : "balanced";

  // Stronger defaults than Agent #234 (was 14/18/24) — catalog-like rhythm
  const section_gap_px =
    density === "compact" ? 22 : density === "spacious" ? 32 : 28;
  const item_gap_px = density === "compact" ? 8 : density === "spacious" ? 12 : 10;
  const paragraph_gap_px = density === "compact" ? 6 : 8;

  return {
    unit_px: 4,
    section_gap_px,
    item_gap_px,
    paragraph_gap_px,
    header_rule_gap_px: 8,
    density,
  };
}
