/**
 * LayoutCritic — margins, overflow, clipping.
 */
import { applyFindings } from "./CriticScore.js";
import { contentObjects } from "./canvasHelpers.js";
import type { CategoryReport, CriticFinding, CriticInput } from "./types.js";

export function evaluateLayout(input: CriticInput): CategoryReport {
  const findings: CriticFinding[] = [];
  const canvas = input.canvas;
  const content = contentObjects(canvas);

  // Ignore edge-to-edge decorative bands for margin probes
  const marginProbe = content.filter((o) => {
    const role = String(o.data?.role ?? o.role ?? "");
    return !["header-band", "accent-rail", "sidebar-bg"].includes(role);
  });
  const lefts = marginProbe.map((o) => Number(o.left ?? 0));
  const tops = marginProbe.map((o) => Number(o.top ?? 0));
  const minLeft = lefts.length ? Math.min(...lefts) : 48;
  const minTop = tops.length ? Math.min(...tops) : 48;
  if (minLeft < 24) {
    findings.push({
      code: "LAY_MARGIN_LEFT",
      severity: "warn",
      message: "Left margin below 24px",
      points_deducted: 6,
    });
  }
  if (minTop < 24) {
    findings.push({
      code: "LAY_MARGIN_TOP",
      severity: "warn",
      message: "Top margin below 24px",
      points_deducted: 6,
    });
  }

  if (input.overflow?.overflow) {
    findings.push({
      code: "LAY_OVERFLOW",
      severity: "fail",
      message: `Content overflow ${input.overflow.overflow_px ?? "?"}px`,
      points_deducted: 30,
    });
  }

  const clipped = content.filter((o) => {
    const bottom =
      Number(o.top ?? 0) + Number(o.height ?? 0) * Number(o.scaleY ?? 1);
    const right =
      Number(o.left ?? 0) + Number(o.width ?? 0) * Number(o.scaleX ?? 1);
    return (
      bottom > canvas.height + 0.5 ||
      right > canvas.width + 0.5 ||
      Number(o.left ?? 0) < -0.5 ||
      Number(o.top ?? 0) < -0.5
    );
  });
  if (clipped.length) {
    findings.push({
      code: "LAY_CLIPPING",
      severity: "fail",
      message: `${clipped.length} clipped object(s)`,
      points_deducted: 20,
    });
  }

  // Page breaks: single page dry-run expects content within one page
  const maxBottom = content.reduce((m, o) => {
    const b =
      Number(o.top ?? 0) + Number(o.height ?? 0) * Number(o.scaleY ?? 1);
    return Math.max(m, b);
  }, 0);
  if (maxBottom > canvas.height) {
    findings.push({
      code: "LAY_PAGE_BREAK",
      severity: "fail",
      message: "Content exceeds single page bounds",
      points_deducted: 15,
    });
  }

  const sectionGap = input.resume_json?.spacing?.section_gap_px;
  if (sectionGap != null && sectionGap < 12) {
    findings.push({
      code: "LAY_SECTION_SPACING",
      severity: "warn",
      message: "Section gap below 12px",
      points_deducted: 4,
    });
  }

  // Agent #235 — page utilization vs catalog peers
  const fillRatio = canvas.height > 0 ? maxBottom / canvas.height : 0;
  if (fillRatio < 0.55 && !input.overflow?.overflow) {
    findings.push({
      code: "LAY_UNDERUTILIZED",
      severity: "warn",
      message: "Layout leaves excessive empty page area",
      points_deducted: 10,
    });
  }

  const score = applyFindings(100, findings);
  return {
    category: "layout",
    score,
    max: 100,
    findings,
    metrics: {
      min_left: minLeft,
      min_top: minTop,
      clipped: clipped.length,
      overflow: Boolean(input.overflow?.overflow),
      max_bottom: maxBottom,
      page_fill_ratio: Math.round(fillRatio * 1000) / 1000,
    },
  };
}
