/**
 * TypographyCritic — font rules only.
 */
import { applyFindings } from "./CriticScore.js";
import { textObjects } from "./canvasHelpers.js";
import type { CategoryReport, CriticFinding, CriticInput } from "./types.js";

const ATS_FONTS = new Set([
  "Inter",
  "Arial",
  "Helvetica",
  "Calibri",
  "Georgia",
  "Times New Roman",
  "Garamond",
  "Roboto",
  "Source Sans 3",
  "IBM Plex Sans",
]);

export function evaluateTypography(input: CriticInput): CategoryReport {
  const findings: CriticFinding[] = [];
  const texts = textObjects(input.canvas);
  const families = new Set(texts.map((t) => String(t.fontFamily ?? "")));

  if (families.size > 2) {
    findings.push({
      code: "TYP_FAMILY_COUNT",
      severity: "warn",
      message: `Too many font families (${families.size})`,
      points_deducted: 8,
    });
  }
  for (const f of families) {
    if (f && !ATS_FONTS.has(f)) {
      findings.push({
        code: "TYP_UNSAFE_FONT",
        severity: "fail",
        message: `Non ATS-safe font: ${f}`,
        points_deducted: 10,
      });
    }
  }

  for (const t of texts) {
    const size = Number(t.fontSize ?? 0);
    const lh = Number(t.lineHeight ?? 0);
    const cs = Number(t.charSpacing ?? 0);
    if (size > 0 && size < 9) {
      findings.push({
        code: "TYP_SIZE_SMALL",
        severity: "warn",
        message: `Font size ${size} below readability floor`,
        points_deducted: 2,
      });
      break;
    }
    if (lh > 0 && (lh < 1.05 || lh > 1.8)) {
      findings.push({
        code: "TYP_LINE_HEIGHT",
        severity: "warn",
        message: `Line height ${lh} outside readable range`,
        points_deducted: 4,
      });
      break;
    }
    if (cs > 200) {
      findings.push({
        code: "TYP_LETTER_SPACING",
        severity: "warn",
        message: "Excessive letter spacing",
        points_deducted: 3,
      });
      break;
    }
  }

  const weights = new Set(texts.map((t) => String(t.fontWeight ?? "")));
  if (weights.size > 4) {
    findings.push({
      code: "TYP_WEIGHT_SPRAWL",
      severity: "info",
      message: "Many font weights reduce consistency",
      points_deducted: 2,
    });
  }

  const plan = input.resume_json?.typography;
  if (plan?.ats_safe_fonts_only === false) {
    findings.push({
      code: "TYP_PLAN_UNSAFE",
      severity: "fail",
      message: "Resume JSON declares ats_safe_fonts_only=false",
      points_deducted: 15,
    });
  }

  // Agent #235 — hierarchy quality (not compliance-only)
  const sizes = texts
    .map((t) => Number(t.fontSize ?? 0))
    .filter((n) => n > 0)
    .sort((a, b) => b - a);
  if (sizes.length >= 2) {
    const nameSize = sizes[0];
    const bodyish = sizes[Math.min(sizes.length - 1, 2)] ?? sizes[sizes.length - 1];
    if (nameSize < 34) {
      findings.push({
        code: "TYP_HERO_WEAK",
        severity: "warn",
        message: "Hero/name size below modern premium resume builders",
        points_deducted: 8,
      });
    }
    if (nameSize - bodyish < 22) {
      findings.push({
        code: "TYP_HIERARCHY_FLAT",
        severity: "warn",
        message: "Flat type hierarchy between name and body",
        points_deducted: 6,
      });
    }
  }
  const headingPlan = plan?.scale_pt;
  if (headingPlan && headingPlan.name < headingPlan.heading + 14) {
    findings.push({
      code: "TYP_SCALE_PLAN",
      severity: "info",
      message: "Planned name scale barely above section headings",
      points_deducted: 3,
    });
  }

  const score = applyFindings(100, findings);
  return {
    category: "typography",
    score,
    max: 100,
    findings,
    metrics: {
      families: [...families],
      weight_count: weights.size,
      text_count: texts.length,
      max_font: sizes[0] ?? 0,
    },
  };
}
