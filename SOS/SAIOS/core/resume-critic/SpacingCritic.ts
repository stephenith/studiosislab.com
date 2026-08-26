/**
 * SpacingCritic — spacing-focused checks (feeds layout metrics; also standalone).
 * Agent #235 — evaluates section rhythm consistency and readability gaps.
 */
import { applyFindings } from "./CriticScore.js";
import { textObjects } from "./canvasHelpers.js";
import type { CategoryReport, CriticFinding, CriticInput } from "./types.js";

/** Spacing is reported under layout score via OverallEvaluator; this exports detail. */
export function evaluateSpacing(input: CriticInput): CategoryReport {
  const findings: CriticFinding[] = [];
  const texts = textObjects(input.canvas).sort(
    (a, b) => Number(a.top ?? 0) - Number(b.top ?? 0),
  );
  // Agent #239 — only compare same-column pairs (avoid false dual-column overlaps)
  const gaps: number[] = [];
  let negative = 0;
  for (let i = 1; i < texts.length; i++) {
    const prev = texts[i - 1]!;
    const cur = texts[i]!;
    const prevLeft = Number(prev.left ?? 0);
    const curLeft = Number(cur.left ?? 0);
    const prevRight = prevLeft + Number(prev.width ?? 0);
    const curRight = curLeft + Number(cur.width ?? 0);
    const overlapX = Math.min(prevRight, curRight) - Math.max(prevLeft, curLeft);
    if (overlapX < 20) continue;
    const prevBottom = Number(prev.top ?? 0) + Number(prev.height ?? 0);
    const gap = Number(cur.top ?? 0) - prevBottom;
    gaps.push(gap);
    if (gap < -1) negative += 1;
  }
  if (negative) {
    findings.push({
      code: "SPC_OVERLAP",
      severity: "fail",
      message: `${negative} overlapping text gap(s)`,
      points_deducted: 15,
    });
  }
  const unit = input.resume_json?.spacing?.unit_px ?? 4;
  if (unit !== 4) {
    findings.push({
      code: "SPC_UNIT",
      severity: "warn",
      message: "Spacing not on 4px grid",
      points_deducted: 4,
    });
  }

  const positive = gaps.filter((g) => g >= 0);
  if (positive.length >= 4) {
    const mean =
      positive.reduce((a, b) => a + b, 0) / Math.max(1, positive.length);
    const variance =
      positive.reduce((a, g) => a + (g - mean) ** 2, 0) /
      Math.max(1, positive.length);
    const stdev = Math.sqrt(variance);
    if (stdev > 28) {
      findings.push({
        code: "SPC_RHYTHM",
        severity: "warn",
        message: "Inconsistent spacing rhythm across text blocks",
        points_deducted: 7,
      });
    }
    const huge = positive.filter((g) => g > 64).length;
    if (huge >= 2) {
      findings.push({
        code: "SPC_LARGE_GAPS",
        severity: "warn",
        message: "Multiple large gaps hurt section consistency",
        points_deducted: 5,
      });
    }
  }

  const sectionGap = input.resume_json?.spacing?.section_gap_px;
  if (sectionGap != null && sectionGap < 16) {
    findings.push({
      code: "SPC_SECTION_TIGHT",
      severity: "info",
      message: "Section gap below recommended 16px readability floor",
      points_deducted: 3,
    });
  }
  if (sectionGap != null && sectionGap > 40) {
    findings.push({
      code: "SPC_SECTION_LOOSE",
      severity: "info",
      message: "Section gap very loose — may create sparse Word-doc feel",
      points_deducted: 4,
    });
  }

  const score = applyFindings(100, findings);
  return {
    category: "layout",
    score,
    max: 100,
    findings,
    metrics: { gaps: gaps.slice(0, 20), unit, gap_count: gaps.length },
  };
}
