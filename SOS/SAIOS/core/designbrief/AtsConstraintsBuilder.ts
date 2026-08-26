/**
 * ATS constraints — always ats_safe for DesignBrief V1 dry-run.
 */
import type { AtsConstraints, LayoutBlueprint } from "./types.js";

export function buildAtsConstraints(layout: LayoutBlueprint): AtsConstraints {
  const min_margin_mm = Math.min(
    layout.margins_mm.top,
    layout.margins_mm.right,
    layout.margins_mm.bottom,
    layout.margins_mm.left,
  );
  return {
    tier: "ats_safe",
    single_column_required: true,
    tables_allowed: false,
    images_allowed: false,
    icons_allowed: false,
    text_boxes_only: true,
    multi_column_forbidden: true,
    min_margin_mm,
    standard_section_headings: true,
    parse_notes: [
      "Single-column text flow only",
      "No tables, images, icons, or multi-column sidebars",
      "Standard section headings for parser reliability",
      "Fictional sample content only — not personal user data",
    ],
  };
}
