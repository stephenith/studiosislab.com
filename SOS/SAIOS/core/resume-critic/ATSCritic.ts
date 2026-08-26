/**
 * ATSCritic — rule-based ATS evaluation (no AI).
 */
import { applyFindings } from "./CriticScore.js";
import {
  detectIcons,
  detectImages,
  detectTables,
  hasMultiColumn,
  keywordDensity,
  sectionIdsFromCanvas,
  textObjects,
} from "./canvasHelpers.js";
import type { CategoryReport, CriticFinding, CriticInput } from "./types.js";
import { REQUIRED_SECTIONS } from "./types.js";

const ATS_KEYWORDS = [
  "marketing",
  "manager",
  "campaign",
  "pipeline",
  "analytics",
  "brand",
  "demand",
  "strategy",
  "leadership",
  "experience",
  // Cross-role ATS tokens (Agent #237 — family engine roles)
  "engineer",
  "software",
  "design",
  "graphic",
  "accountant",
  "audit",
  "gaap",
  "hr",
  "people",
  "talent",
  "project",
  "typescript",
  "api",
];

export function evaluateAts(input: CriticInput): CategoryReport {
  const findings: CriticFinding[] = [];
  const canvas = input.canvas;
  const sections = sectionIdsFromCanvas(canvas);
  const texts = textObjects(canvas);
  const blob = texts.map((t) => String(t.text ?? "")).join(" ");

  const vg = (input.resume_json as { visual_guidance?: Record<string, unknown> })
    ?.visual_guidance;
  const sidebarAllowed =
    String(vg?.sidebar_policy ?? "") === "narrow_ats_safe" ||
    String(vg?.ats_constraints ?? "").includes("narrow_ats_safe");
  const splitHeaderAllowed =
    /split|grid_two_track/i.test(String(vg?.header_system ?? "")) ||
    /split|grid_two_track/i.test(String(vg?.alignment_system ?? ""));
  if (hasMultiColumn(canvas)) {
    if (sidebarAllowed) {
      findings.push({
        code: "ATS_NARROW_SIDEBAR",
        severity: "info",
        message: "Narrow ATS-safe sidebar family — monitored dual text tracks",
        points_deducted: 0,
      });
    } else if (splitHeaderAllowed) {
      findings.push({
        code: "ATS_SPLIT_HEADER",
        severity: "info",
        message: "Split/grid header metadata column — body remains single-flow",
        points_deducted: 0,
      });
    } else {
      findings.push({
        code: "ATS_MULTI_COLUMN",
        severity: "fail",
        message: "Multi-column layout detected — ATS parse risk",
        points_deducted: 25,
      });
    }
  }
  if (detectTables(canvas)) {
    findings.push({
      code: "ATS_TABLES",
      severity: "fail",
      message: "Tables present — forbidden for ATS-safe resumes",
      points_deducted: 20,
    });
  }
  if (detectIcons(canvas)) {
    findings.push({
      code: "ATS_ICONS",
      severity: "fail",
      message: "Icons present — ATS-unsafe",
      points_deducted: 10,
    });
  }
  if (detectImages(canvas)) {
    findings.push({
      code: "ATS_IMAGES",
      severity: "fail",
      message: "Images present — ATS-unsafe",
      points_deducted: 15,
    });
  }

  const missingRequired = REQUIRED_SECTIONS.filter((s) => !sections.includes(s));
  if (missingRequired.length) {
    findings.push({
      code: "ATS_SECTION_ORDER",
      severity: "fail",
      message: `Missing required sections: ${missingRequired.join(", ")}`,
      points_deducted: 5 * missingRequired.length,
    });
  }

  // Contact placement: first text near top
  const sorted = [...texts].sort(
    (a, b) => Number(a.top ?? 0) - Number(b.top ?? 0),
  );
  const contactCandidate = sorted[1] ?? sorted[0];
  const contactTop = Number(contactCandidate?.top ?? 9999);
  const bandHeader =
    /band|header_band|dark_band|muted_band/i.test(
      String(vg?.header_system ?? ""),
    ) || String(vg?.accent_shape_strategy ?? "") === "header_band";
  const contactLimit = bandHeader ? 175 : 120;
  if (contactTop > contactLimit) {
    findings.push({
      code: "ATS_CONTACT_PLACEMENT",
      severity: "warn",
      message: "Contact block not near page top",
      points_deducted: 5,
    });
  }

  const density = keywordDensity(blob, ATS_KEYWORDS);
  if (density < 0.01) {
    findings.push({
      code: "ATS_KEYWORD_DENSITY",
      severity: "warn",
      message: "Very low rule-based keyword density",
      points_deducted: 3,
    });
  }

  // Header present as first section
  if (sections[0] && sections[0] !== "header") {
    findings.push({
      code: "ATS_HEADER_FIRST",
      severity: "warn",
      message: "Header is not the first section",
      points_deducted: 4,
    });
  }

  const score = applyFindings(100, findings);
  return {
    category: "ats",
    score,
    max: 100,
    findings,
    metrics: {
      sections,
      multi_column: hasMultiColumn(canvas),
      tables: detectTables(canvas),
      icons: detectIcons(canvas),
      images: detectImages(canvas),
      keyword_density: Number(density.toFixed(4)),
      contact_top: contactTop,
    },
  };
}
