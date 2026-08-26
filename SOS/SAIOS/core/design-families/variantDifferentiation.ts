/**
 * Agent #239 — Require ≥4 geometric/visual dimensions between family variants.
 */
import type { ResolvedDesignFamily } from "./types.js";

const DIMENSIONS = [
  "header_geometry",
  "section_title_system",
  "alignment_system",
  "color_distribution",
  "accent_shape_system",
  "spacing_profile",
  "page_silhouette",
  "content_grouping",
  "sidebar_presence",
  "contact_placement",
] as const;

export type VariantDiffReport = {
  differing_dimensions: string[];
  count: number;
  pass: boolean;
};

export function compareVariantDimensions(
  a: ResolvedDesignFamily,
  b: ResolvedDesignFamily,
): VariantDiffReport {
  const diffs: string[] = [];
  if (a.header_system !== b.header_system) diffs.push("header_geometry");
  if (a.section_title_system !== b.section_title_system)
    diffs.push("section_title_system");
  if (a.alignment_system !== b.alignment_system) diffs.push("alignment_system");
  if (
    a.color_strategy.accent !== b.color_strategy.accent ||
    a.color_strategy.header_band !== b.color_strategy.header_band ||
    a.color_strategy.pale_tint !== b.color_strategy.pale_tint
  ) {
    diffs.push("color_distribution");
  }
  if (a.accent_shape_strategy !== b.accent_shape_strategy)
    diffs.push("accent_shape_system");
  if (
    a.spacing.density !== b.spacing.density ||
    Math.abs(a.spacing.section_before_gap_px - b.spacing.section_before_gap_px) >=
      4
  ) {
    diffs.push("spacing_profile");
  }
  if (
    a.layout_architecture !== b.layout_architecture ||
    a.silhouette_hint !== b.silhouette_hint
  ) {
    diffs.push("page_silhouette");
  }
  // content grouping approximated by section title + sidebar policy
  if (
    a.sidebar_policy !== b.sidebar_policy ||
    a.section_title_system !== b.section_title_system
  ) {
    if (!diffs.includes("content_grouping")) diffs.push("content_grouping");
  }
  if (a.sidebar_policy !== b.sidebar_policy) diffs.push("sidebar_presence");
  if (
    a.header_system !== b.header_system ||
    a.alignment_system !== b.alignment_system
  ) {
    if (!diffs.includes("contact_placement")) diffs.push("contact_placement");
  }

  const unique = [...new Set(diffs)].filter((d) =>
    (DIMENSIONS as readonly string[]).includes(d),
  );
  return {
    differing_dimensions: unique,
    count: unique.length,
    pass: unique.length >= 4,
  };
}
