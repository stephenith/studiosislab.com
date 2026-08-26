/**
 * PageLayoutEngine — family-aware page geometry.
 * Agent #239 — canonical printable safe-area is the outer margin source of truth.
 */
import {
  buildPrintableSafeArea,
  contentSafeRect,
  type PrintableSafeArea,
} from "./printableSafeArea.js";
import type { LayoutMargins, ResumeJsonInput } from "./types.js";

export type PageLayout = {
  width_px: number;
  height_px: number;
  background: string;
  margins: LayoutMargins;
  content_x: number;
  content_width: number;
  content_top: number;
  content_bottom_limit: number;
  sidebar_width: number;
  sidebar_x: number;
  main_x: number;
  main_width: number;
  header_band_height: number;
  body_offset_x: number;
  architecture: string;
  alignment_system: string;
  has_sidebar: boolean;
  safe_area: PrintableSafeArea;
  allow_edge_to_edge_decoration: boolean;
};

export function buildPageLayout(
  input: ResumeJsonInput,
  margins?: LayoutMargins,
): PageLayout {
  const vg = input.visual_guidance ?? {};
  const arch = String(vg.layout_architecture ?? vg.layout_family ?? "classic_single");
  const align = String(vg.alignment_system ?? "strict_left");
  const sidebarPolicy = String(vg.sidebar_policy ?? "forbidden");
  const header = String(vg.header_system ?? "");

  const allow_edge_to_edge_decoration =
    header === "dark_band_full" ||
    header === "muted_band_name_block" ||
    arch === "header_band" ||
    arch === "wide_header_single" ||
    String(vg.accent_shape_strategy) === "header_band";

  let family_inset_x = 0;
  if (arch === "editorial_offset" || align === "offset_body") {
    family_inset_x = 24;
  }
  if (
    String(vg.accent_shape_strategy) === "left_rail" ||
    String(vg.accent_shape_strategy) === "index_rail"
  ) {
    family_inset_x = Math.max(family_inset_x, 16);
  }

  const safe_area = buildPrintableSafeArea({
    page_width_px: input.page.width_px,
    page_height_px: input.page.height_px,
    family_inset_x,
    allow_edge_to_edge_decoration,
  });
  const content = contentSafeRect(safe_area);

  // Canonical safe margins win over scattered family mm margins
  const m: LayoutMargins = margins
    ? {
        top: safe_area.top,
        right: safe_area.right,
        bottom: safe_area.bottom,
        left: safe_area.left,
        content_width_px: content.width,
      }
    : {
        top: safe_area.top,
        right: safe_area.right,
        bottom: safe_area.bottom,
        left: safe_area.left,
        content_width_px: content.width,
      };

  let header_band_height = 0;
  if (allow_edge_to_edge_decoration) {
    // Tall enough for name + title + contact with safe-top inset
    header_band_height =
      header === "dark_band_full" || arch === "wide_header_single" ? 138 : 124;
  }

  const has_sidebar = sidebarPolicy === "narrow_ats_safe";
  // Agent #239 — stronger sidebar width for fill/balance
  const sidebar_width = has_sidebar ? 220 : 0;
  const gutter = has_sidebar ? 16 : 0;

  const body_offset_x = has_sidebar ? 0 : family_inset_x;
  const content_x = content.x;
  const content_width = content.width;
  const sidebar_x = content_x;
  const main_x = has_sidebar
    ? content_x + sidebar_width + gutter
    : content_x + body_offset_x;
  const main_width = has_sidebar
    ? content_width - sidebar_width - gutter
    : content_width - body_offset_x;

  const content_top =
    header_band_height > 0
      ? Math.max(header_band_height + 14, safe_area.top)
      : content.y;

  return {
    width_px: input.page.width_px,
    height_px: input.page.height_px,
    background: input.page.background,
    margins: m,
    content_x,
    content_width,
    content_top,
    content_bottom_limit: safe_area.printable_bottom,
    sidebar_width,
    sidebar_x,
    main_x,
    main_width,
    header_band_height,
    body_offset_x,
    architecture: arch,
    alignment_system: align,
    has_sidebar,
    safe_area,
    allow_edge_to_edge_decoration,
  };
}
