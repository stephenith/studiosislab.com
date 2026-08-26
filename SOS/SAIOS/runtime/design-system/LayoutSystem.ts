/**
 * Layout system — composes grids, margins, and whitespace.
 */
import { LAYOUT_RULES } from "../../domain/studiosislab/resume/LayoutRules.js";
import { buildGridSystem } from "./GridSystem.js";
import { buildMarginSystem } from "./MarginSystem.js";
import type { GridLayoutId } from "./types.js";
import { DESIGN_SYSTEM_VERSION } from "./types.js";

export type LayoutSpec = {
  id: GridLayoutId;
  name: string;
  columns: number;
  gutters_px: number;
  margins_px: number;
  whitespace_profile: "generous" | "balanced" | "compact";
  alignment: "left" | "center-header";
  ats_safe: boolean;
};

export function buildLayoutSystem() {
  const grid = buildGridSystem();
  const margins = buildMarginSystem();

  const layouts: LayoutSpec[] = grid.layouts.map((g) => ({
    id: g.id,
    name: g.name,
    columns: g.columns,
    gutters_px: g.gutter_px,
    margins_px: g.margin_px,
    whitespace_profile:
      g.margin_px >= 56 ? "generous" : g.margin_px <= 44 ? "compact" : "balanced",
    alignment: g.id === "executive" || g.id === "corporate" ? "center-header" : "left",
    ats_safe: g.ats_safe,
  }));

  return {
    version: DESIGN_SYSTEM_VERSION,
    layouts,
    domain_rules: [...LAYOUT_RULES],
    margins,
    generated_at: new Date().toISOString(),
  };
}
