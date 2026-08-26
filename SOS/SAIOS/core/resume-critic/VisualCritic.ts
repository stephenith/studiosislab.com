/**
 * VisualCritic — deterministic visual heuristics.
 * Agent #235 — grades hierarchy, whitespace fill, density, balance (not auto-100).
 */
import { applyFindings } from "./CriticScore.js";
import { contentObjects, isPageBg, textObjects } from "./canvasHelpers.js";
import type { CategoryReport, CriticFinding, CriticInput } from "./types.js";

export function evaluateVisual(input: CriticInput): CategoryReport {
  const findings: CriticFinding[] = [];
  const canvas = input.canvas;
  const content = contentObjects(canvas);
  const texts = textObjects(canvas);

  // Alignment: left edges should cluster
  const lefts = texts.map((t) => Math.round(Number(t.left ?? 0)));
  const leftSet = new Set(lefts);
  if (leftSet.size > 3) {
    findings.push({
      code: "VIS_ALIGNMENT",
      severity: "warn",
      message: "Multiple left-edge alignments reduce visual consistency",
      points_deducted: 6,
    });
  }

  // Hierarchy: name (largest font) near top + clear size steps
  const bySize = [...texts].sort(
    (a, b) => Number(b.fontSize ?? 0) - Number(a.fontSize ?? 0),
  );
  const name = bySize[0];
  if (name && Number(name.top ?? 0) > 80) {
    findings.push({
      code: "VIS_HIERARCHY",
      severity: "warn",
      message: "Largest text not near top — weak hierarchy",
      points_deducted: 5,
    });
  }
  const sizes = [...new Set(texts.map((t) => Number(t.fontSize ?? 0)).filter((n) => n > 0))].sort(
    (a, b) => b - a,
  );
  if (sizes.length > 0 && sizes[0] < 28) {
    findings.push({
      code: "VIS_NAME_SCALE",
      severity: "warn",
      message: "Name/hero scale below premium threshold (<28pt)",
      points_deducted: 8,
    });
  }
  if (sizes.length < 3) {
    findings.push({
      code: "VIS_TYPE_STEPS",
      severity: "warn",
      message: "Insufficient typography steps for clear hierarchy",
      points_deducted: 6,
    });
  } else if (sizes[0] - sizes[sizes.length - 1] < 14) {
    findings.push({
      code: "VIS_TYPE_RANGE",
      severity: "info",
      message: "Narrow type range — hierarchy could be stronger",
      points_deducted: 4,
    });
  }

  // Whitespace: gaps between consecutive text blocks
  const sorted = [...texts].sort(
    (a, b) => Number(a.top ?? 0) - Number(b.top ?? 0),
  );
  let tight = 0;
  let sparse = 0;
  for (let i = 1; i < sorted.length; i++) {
    const prevBottom =
      Number(sorted[i - 1].top ?? 0) + Number(sorted[i - 1].height ?? 0);
    const gap = Number(sorted[i].top ?? 0) - prevBottom;
    if (gap < 2) tight++;
    if (gap > 80) sparse++;
  }
  if (tight > 2) {
    findings.push({
      code: "VIS_WHITESPACE_TIGHT",
      severity: "warn",
      message: "Overlapping or cramped text rhythm",
      points_deducted: 7,
    });
  }
  if (sparse > 3) {
    findings.push({
      code: "VIS_WHITESPACE_SPARSE",
      severity: "warn",
      message: "Uneven section rhythm / excessive gaps",
      points_deducted: 4,
    });
  }

  // Page fill / information density (catalog peers ~87–100%; DI target ~88%)
  const maxBottom = content.reduce((m, o) => {
    const b =
      Number(o.top ?? 0) + Number(o.height ?? 0) * Number(o.scaleY ?? 1);
    return Math.max(m, b);
  }, 0);
  const fillRatio = canvas.height > 0 ? maxBottom / canvas.height : 0;
  const fillObjective = Number(
    (input.resume_json as { visual_guidance?: { page_fill_objective?: number } })
      ?.visual_guidance?.page_fill_objective ?? 0.88,
  );
  if (fillRatio < 0.55) {
    findings.push({
      code: "VIS_PAGE_UNDERFILL",
      severity: "warn",
      message: `Page underfilled (${Math.round(fillRatio * 100)}%) — Word-document sparse look`,
      points_deducted: 14,
    });
  } else if (fillRatio < 0.72) {
    findings.push({
      code: "VIS_PAGE_LIGHT",
      severity: "warn",
      message: `Page fill modest (${Math.round(fillRatio * 100)}%) vs premium target`,
      points_deducted: 8,
    });
  } else if (fillRatio < fillObjective - 0.06) {
    findings.push({
      code: "VIS_PAGE_BELOW_OBJECTIVE",
      severity: "info",
      message: `Page fill ${Math.round(fillRatio * 100)}% below Design Intelligence objective ${Math.round(fillObjective * 100)}%`,
      points_deducted: 4,
    });
  }
  if (texts.length < 22) {
    findings.push({
      code: "VIS_DENSITY_LOW",
      severity: "warn",
      message: `Low information density (${texts.length} text objects)`,
      points_deducted: 10,
    });
  } else if (texts.length < 26) {
    findings.push({
      code: "VIS_DENSITY_MODEST",
      severity: "info",
      message: `Density below catalog-like target (${texts.length} text objects)`,
      points_deducted: 3,
    });
  }

  // Header spacing: accent rule after header texts
  const hasRule = content.some(
    (o) =>
      o.type === "Rect" &&
      !isPageBg(o) &&
      (o.role === "accent-bar" || o.data?.role === "accent-bar"),
  );
  if (!hasRule) {
    findings.push({
      code: "VIS_HEADER_RULE",
      severity: "info",
      message: "No accent rule under header",
      points_deducted: 2,
    });
  } else {
    const rules = content.filter(
      (o) =>
        o.type === "Rect" &&
        !isPageBg(o) &&
        (o.role === "accent-bar" || o.data?.role === "accent-bar"),
    );
    const shortRules = rules.filter((r) => Number(r.width ?? 0) < 100);
    if (shortRules.length && rules.every((r) => Number(r.width ?? 0) < 100)) {
      findings.push({
        code: "VIS_RULE_WEAK",
        severity: "info",
        message: "Accent rule too short for premium header weight",
        points_deducted: 3,
      });
    }
  }

  // Professional appearance: high-contrast dark text on light bg
  const bg = canvas.objects.find((o) => isPageBg(o));
  const bgFill = String(bg?.fill ?? "#ffffff").toLowerCase();
  if (bgFill !== "#ffffff" && bgFill !== "#fff") {
    findings.push({
      code: "VIS_BG",
      severity: "warn",
      message: "Non-white background may reduce professional ATS look",
      points_deducted: 3,
    });
  }

  // Balance: large empty band in lower third with little content
  const lowerThird = canvas.height * (2 / 3);
  const lowerTexts = texts.filter((t) => Number(t.top ?? 0) >= lowerThird);
  if (fillRatio < 0.78 && lowerTexts.length < 3) {
    findings.push({
      code: "VIS_BALANCE_LOWER",
      severity: "warn",
      message: "Lower page lacks content — unbalanced composition",
      points_deducted: 8,
    });
  }

  // Agent #236 — readability (body size + contrast already assumed dark-on-light)
  const bodySizes = texts
    .map((t) => Number(t.fontSize ?? 0))
    .filter((n) => n > 0 && n <= 14);
  const avgBody =
    bodySizes.length > 0
      ? bodySizes.reduce((a, b) => a + b, 0) / bodySizes.length
      : 0;
  if (avgBody > 0 && avgBody < 10) {
    findings.push({
      code: "VIS_READABILITY",
      severity: "warn",
      message: `Average body size ${avgBody.toFixed(1)}pt hurts readability`,
      points_deducted: 6,
    });
  }

  // Originality / non-generic Word look: require title under name + multi-step type
  const headingLike = texts.filter((t) => {
    const s = String(t.text ?? "").trim();
    return /^[A-Z][A-Z\s/&-]{2,20}$/.test(s);
  });
  if (headingLike.length < 3) {
    findings.push({
      code: "VIS_SECTION_RHYTHM",
      severity: "info",
      message: "Weak section-header rhythm",
      points_deducted: 3,
    });
  }
  if (sizes[0] != null && sizes[0] < 34) {
    findings.push({
      code: "VIS_PREMIUM_NAME",
      severity: "warn",
      message: "Name scale below modern premium resume builders (~34–40pt)",
      points_deducted: 5,
    });
  }
  // Generic / flat originality signal: only 1–2 type steps
  if (sizes.length <= 2) {
    findings.push({
      code: "VIS_ORIGINALITY_FLAT",
      severity: "warn",
      message: "Flat visual system — limited hierarchy originality",
      points_deducted: 7,
    });
  }

  const score = applyFindings(100, findings);
  return {
    category: "visual",
    score,
    max: 100,
    findings,
    metrics: {
      left_edge_clusters: leftSet.size,
      tight_gaps: tight,
      sparse_gaps: sparse,
      has_accent_rule: hasRule,
      page_fill_ratio: Math.round(fillRatio * 1000) / 1000,
      page_fill_objective: fillObjective,
      text_count: texts.length,
      type_steps: sizes.length,
      avg_body_pt: Math.round(avgBody * 10) / 10,
    },
  };
}
