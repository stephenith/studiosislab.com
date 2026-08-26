/**
 * Layout intelligence — consumes Resume Design System grid library.
 */
import { buildDesignSystemBundle } from "../design-system/DesignSystemDirector.js";
import type { CompositionMode, LayoutComposition, LayoutMode } from "./types.js";
import type { IndustryId } from "../research/types.js";

export function buildLayoutComposition(input: {
  industry: IndustryId;
  mode: CompositionMode;
  seed: number;
}): LayoutComposition {
  const system = buildDesignSystemBundle(true);
  const layouts = system.grid.layouts;

  let layout_mode: LayoutMode;
  if (input.mode === "ats") layout_mode = "single_column";
  else if (input.mode === "executive") layout_mode = "executive";
  else if (input.industry === "software" || input.industry === "engineering") {
    layout_mode = input.seed % 2 === 0 ? "minimal" : "single_column";
  } else if (input.mode === "creative") layout_mode = "sidebar";
  else layout_mode = "single_column";

  const premiumGridIds = ["corporate", "modern", "executive", "technical"] as const;
  const gridLayout =
    layouts.find((g) => g.id === (layout_mode === "sidebar" ? "sidebar" : premiumGridIds[input.seed % premiumGridIds.length])) ??
    layouts[input.seed % layouts.length]!;

  const pageWidth = system.page_width;

  const column_count: 1 | 2 = gridLayout.columns === 1 ? 1 : 2;
  const sidebar_width_pct =
    column_count === 2 ? Math.round(gridLayout.gutter_px + 28) : null;

  return {
    layout_mode,
    column_count,
    sidebar_width_pct,
    grid_columns: 12,
    grid_gutter_px: gridLayout.gutter_px,
    alignment: gridLayout.ats_safe ? "left" : "left",
    justification: [
      `${gridLayout.name} (${gridLayout.id}) from design-system grid library`,
      column_count === 1
        ? "Single column from design-system ATS-safe layout"
        : `Two-column layout gutter ${gridLayout.gutter_px}px from design-system`,
      `Margins ${pageWidth.margins.left_px}px from design-system page_width (${pageWidth.content_width_px}px content)`,
    ],
  };
}
