/**
 * Dimension evaluator — score all 26 visual dimensions from rendered metrics.
 */
import type { DimensionScore, RenderMetrics, VisualDimension } from "./types.js";

const ALL_DIMENSIONS: VisualDimension[] = [
  "overall_premium_impression",
  "whitespace_distribution",
  "balance",
  "visual_weight",
  "typography_hierarchy",
  "section_hierarchy",
  "alignment_consistency",
  "margins",
  "grid_usage",
  "section_density",
  "page_utilization",
  "recruiter_eye_flow",
  "reading_rhythm",
  "modern_appearance",
  "ats_appearance",
  "premium_appearance",
  "executive_appearance",
  "industry_suitability",
  "originality",
  "visual_confidence",
  "scan_speed",
  "information_grouping",
  "spacing_consistency",
  "color_harmony",
  "visual_noise",
  "professional_trust_score",
];

export function evaluateAllDimensions(
  metrics: RenderMetrics,
  benchmarkBoost: number,
): DimensionScore[] {
  return ALL_DIMENSIONS.map((dimension) => scoreDimension(dimension, metrics, benchmarkBoost));
}

function scoreDimension(
  dimension: VisualDimension,
  m: RenderMetrics,
  boost: number,
): DimensionScore {
  const base = dimensionBase(dimension, m);
  const score = Math.min(100, Math.round(base + boost * 0.15));
  return {
    dimension,
    score,
    pass: score >= 85,
    notes: dimensionNote(dimension, m),
  };
}

function dimensionBase(d: VisualDimension, m: RenderMetrics): number {
  const utilization = m.content_bottom_px / m.canvas_height;
  const marginScore = m.left_margin_px >= 48 && m.left_margin_px <= 60 ? 92 : 80;
  const hierarchyScore =
    m.font_sizes_pt.length >= 2 && m.font_sizes_pt[0]! / m.font_sizes_pt.at(-1)! >= 2.2
      ? 94
      : m.font_sizes_pt.length >= 2 && m.font_sizes_pt[0]! / m.font_sizes_pt.at(-1)! >= 1.8
        ? 88
        : 78;
  const alignmentScore = m.alignment_columns.length <= 3 ? 91 : 76;
  const densityScore = m.non_white_ratio > 0.03 && m.non_white_ratio < 0.75 ? 90 : 76;
  const noiseScore = m.accent_count <= 6 ? 91 : 74;
  const groupingScore = m.vertical_bands.filter((b) => b > 0).length >= 4 ? 90 : 78;
  const pageUtilScore = pageUtilizationScore(utilization);

  const map: Record<VisualDimension, number> = {
    overall_premium_impression: (marginScore + hierarchyScore + pageUtilScore) / 3,
    whitespace_distribution: (marginScore + pageUtilScore) / 2,
    balance: (marginScore + groupingScore + pageUtilScore) / 3,
    visual_weight: hierarchyScore,
    typography_hierarchy: hierarchyScore,
    section_hierarchy: groupingScore,
    alignment_consistency: alignmentScore,
    margins: marginScore,
    grid_usage: m.alignment_columns.every((c) => c % 8 === 0) ? 90 : 84,
    section_density: densityScore,
    page_utilization: pageUtilScore,
    recruiter_eye_flow: (hierarchyScore + groupingScore) / 2,
    reading_rhythm: (alignmentScore + densityScore) / 2,
    modern_appearance: hierarchyScore,
    ats_appearance: m.textbox_count >= 20 ? 97 : 88,
    premium_appearance: (marginScore + noiseScore) / 2,
    executive_appearance: m.header_zone_density >= 0.15 ? 93 : 86,
    industry_suitability: 90,
    originality: noiseScore,
    visual_confidence: (hierarchyScore + marginScore) / 2,
    scan_speed: groupingScore,
    information_grouping: groupingScore,
    spacing_consistency: alignmentScore,
    color_harmony: noiseScore,
    visual_noise: 100 - Math.min(30, m.accent_count * 4),
    professional_trust_score: (marginScore + hierarchyScore + alignmentScore) / 3,
  };

  return map[d];
}

function pageUtilizationScore(utilization: number): number {
  if (utilization >= 0.8 && utilization <= 0.9) return 96;
  if (utilization >= 0.75 && utilization <= 0.93) return 91;
  if (utilization >= 0.65 && utilization < 0.75) return 84;
  if (utilization < 0.65) return 76;
  return 82;
}

function dimensionNote(d: VisualDimension, m: RenderMetrics): string {
  if (d === "margins") return `Rendered left margin ${m.left_margin_px}px`;
  if (d === "typography_hierarchy")
    return `Font scale ${m.font_sizes_pt[0] ?? "?"}pt → ${m.font_sizes_pt.at(-1) ?? "?"}pt`;
  if (d === "visual_noise") return `${m.accent_count} accent elements detected in render`;
  if (d === "page_utilization")
    return `Content spans ${Math.round((m.content_bottom_px / m.canvas_height) * 100)}% of page`;
  return `Evaluated from rendered canvas — ${m.object_count} objects`;
}
