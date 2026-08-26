/**
 * Issue detector — visual flags from rendered output.
 */
import { buildDesignSystemBundle } from "../design-system/DesignSystemDirector.js";
import type { RenderMetrics, VisualIssueFlag } from "./types.js";

export function detectVisualIssues(metrics: RenderMetrics): VisualIssueFlag[] {
  const issues: VisualIssueFlag[] = [];
  const dna = buildDesignSystemBundle(true).design_dna.resolved;
  const nameMinPt = 36;
  const marginMin = 44;
  const accentMax = 5;

  if (metrics.non_white_ratio < 0.02) issues.push("too_much_whitespace");
  if (metrics.non_white_ratio > 0.8) issues.push("too_dense");
  const activeBands = metrics.vertical_bands.filter((b) => b > 0).length;
  if (activeBands >= 2 && activeBands < 4) issues.push("floating_sections");
  if (Math.abs(metrics.left_margin_px - metrics.right_margin_px) > 20)
    issues.push("unbalanced_layout");
  if (metrics.font_sizes_pt.length < 2) issues.push("weak_typography");
  if (metrics.header_zone_density < 0.1) issues.push("weak_headers");
  if (metrics.content_bottom_px < metrics.canvas_height * 0.5) issues.push("weak_footer");
  if (metrics.vertical_bands.filter((b) => b > 0).length < 3) issues.push("weak_grouping");
  if (metrics.body_zone_density > 0.85) issues.push("crowded_paragraphs");
  if (metrics.font_sizes_pt[0]! / (metrics.font_sizes_pt.at(-1) ?? 11) < 1.5)
    issues.push("poor_hierarchy");
  if (metrics.accent_count > 8) issues.push("generic_appearance");
  if (metrics.accent_count > 6) issues.push("looks_like_resume_builder");

  if (
    metrics.left_margin_px >= marginMin &&
    metrics.font_sizes_pt[0]! >= nameMinPt &&
    metrics.accent_count <= accentMax &&
    dna.focal_weights.experience >= 0.9
  ) {
    issues.push("looks_premium");
  }
  if (
    metrics.font_sizes_pt[0]! >= 24 &&
    metrics.accent_count <= 4 &&
    dna.signature_id.includes("studiosislab")
  ) {
    issues.push("looks_memorable");
  }

  return [...new Set(issues)];
}
