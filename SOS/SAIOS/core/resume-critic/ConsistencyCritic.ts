/**
 * ConsistencyCritic — StudiosisLab construction conventions.
 */
import { applyFindings } from "./CriticScore.js";
import { sectionIdsFromCanvas, textObjects } from "./canvasHelpers.js";
import type { CategoryReport, CriticFinding, CriticInput } from "./types.js";
import { REQUIRED_SECTIONS } from "./types.js";

const CANONICAL_ORDER = [...REQUIRED_SECTIONS];

export function evaluateConsistency(input: CriticInput): CategoryReport {
  const findings: CriticFinding[] = [];
  const canvas = input.canvas;
  const sections = sectionIdsFromCanvas(canvas);

  // Section order vs canonical required prefix
  const presentRequired = CANONICAL_ORDER.filter((s) => sections.includes(s));
  const actualRequiredOrder = sections.filter((s) =>
    (CANONICAL_ORDER as readonly string[]).includes(s),
  );
  if (presentRequired.join(",") !== actualRequiredOrder.join(",")) {
    // order mismatch among required
    const ok = presentRequired.every((s, i) => actualRequiredOrder[i] === s);
    if (!ok) {
      findings.push({
        code: "CON_SECTION_ORDER",
        severity: "warn",
        message: "Required section order differs from StudiosisLab ATS convention",
        points_deducted: 8,
      });
    }
  }

  // Spacing unit from resume JSON
  if (input.resume_json?.spacing?.unit_px != null && input.resume_json.spacing.unit_px !== 4) {
    findings.push({
      code: "CON_SPACING_UNIT",
      severity: "warn",
      message: "Spacing unit is not 4px grid",
      points_deducted: 4,
    });
  }

  // Object hierarchy: page bg first
  if (canvas.objects[0] && canvas.objects[0].data?.role !== "pageBackground" && !canvas.objects[0].isPageBg) {
    findings.push({
      code: "CON_HIERARCHY",
      severity: "warn",
      message: "Page background is not the first object",
      points_deducted: 5,
    });
  }

  // Template convention: Textbox + Rect only for ATS dry-run
  const exotic = canvas.objects.filter(
    (o) => !["Textbox", "Rect"].includes(String(o.type)),
  );
  if (exotic.length) {
    findings.push({
      code: "CON_OBJECT_TYPES",
      severity: "warn",
      message: `Non-standard object types for ATS dry-run: ${exotic.map((e) => e.type).join(",")}`,
      points_deducted: 6,
    });
  }

  // data.id present
  const missingDataId = canvas.objects.filter(
    (o) => !(o.data && typeof o.data === "object" && "id" in o.data),
  );
  if (missingDataId.length) {
    findings.push({
      code: "CON_METADATA",
      severity: "info",
      message: `${missingDataId.length} objects missing data.id`,
      points_deducted: 2,
    });
  }

  // Fonts match resume plan when present
  const planFamily = input.resume_json?.typography?.body_family;
  if (planFamily) {
    const mismatch = textObjects(canvas).some(
      (t) => String(t.fontFamily) !== planFamily && String(t.fontFamily) !== input.resume_json?.typography?.heading_family,
    );
    // Allow heading/body pair only
    const families = new Set(textObjects(canvas).map((t) => String(t.fontFamily)));
    const allowed = new Set(
      [planFamily, input.resume_json?.typography?.heading_family].filter(Boolean),
    );
    for (const f of families) {
      if (!allowed.has(f)) {
        findings.push({
          code: "CON_FONT_PLAN",
          severity: "warn",
          message: "Rendered fonts diverge from DesignBrief typography plan",
          points_deducted: 5,
        });
        break;
      }
    }
    void mismatch;
  }

  const score = applyFindings(100, findings);
  return {
    category: "consistency",
    score,
    max: 100,
    findings,
    metrics: {
      sections,
      exotic_types: exotic.map((e) => e.type),
      missing_data_id: missingDataId.length,
    },
  };
}
