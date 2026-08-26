/**
 * SectionCritic — required/optional section presence and duplicates.
 */
import { applyFindings } from "./CriticScore.js";
import { sectionIdsFromCanvas } from "./canvasHelpers.js";
import type { CategoryReport, CriticFinding, CriticInput } from "./types.js";
import { OPTIONAL_SECTIONS, REQUIRED_SECTIONS } from "./types.js";

export function evaluateSections(input: CriticInput): CategoryReport {
  const findings: CriticFinding[] = [];
  const fromCanvas = sectionIdsFromCanvas(input.canvas);
  const fromJson = (input.resume_json?.sections ?? [])
    .slice()
    .sort((a, b) => a.order - b.order)
    .map((s) => s.id);

  const sections = fromCanvas.length ? fromCanvas : fromJson;

  const missing = REQUIRED_SECTIONS.filter((s) => !sections.includes(s));
  for (const m of missing) {
    findings.push({
      code: "SEC_MISSING",
      severity: "fail",
      message: `Missing required section: ${m}`,
      points_deducted: 12,
    });
  }

  // Duplicates
  const counts = new Map<string, number>();
  for (const s of sections) counts.set(s, (counts.get(s) ?? 0) + 1);
  for (const [s, n] of counts) {
    if (n > 1) {
      findings.push({
        code: "SEC_DUPLICATE",
        severity: "fail",
        message: `Duplicate section: ${s}`,
        points_deducted: 10,
      });
    }
  }

  // Ordering of required among present
  const requiredPresent = sections.filter((s) =>
    (REQUIRED_SECTIONS as readonly string[]).includes(s),
  );
  const expected = REQUIRED_SECTIONS.filter((s) => sections.includes(s));
  if (requiredPresent.join(",") !== expected.join(",")) {
    findings.push({
      code: "SEC_ORDER",
      severity: "warn",
      message: "Required sections out of canonical order",
      points_deducted: 6,
    });
  }

  const optionalPresent = OPTIONAL_SECTIONS.filter((s) => sections.includes(s));

  const score = applyFindings(100, findings);
  return {
    category: "sections",
    score,
    max: 100,
    findings,
    metrics: {
      sections,
      missing_required: missing,
      optional_present: optionalPresent,
      from_canvas: fromCanvas,
      from_resume_json: fromJson,
    },
  };
}
