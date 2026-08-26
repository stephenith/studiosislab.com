/**
 * TechnicalCritic — Fabric / schema / editability.
 */
import { applyFindings } from "./CriticScore.js";
import { contentObjects, isPageBg } from "./canvasHelpers.js";
import type { CategoryReport, CriticFinding, CriticInput } from "./types.js";

const REQUIRED = [
  "version",
  "type",
  "left",
  "top",
  "width",
  "height",
  "originX",
  "originY",
  "scaleX",
  "scaleY",
  "id",
  "selectable",
  "evented",
] as const;

export function evaluateTechnical(input: CriticInput): CategoryReport {
  const findings: CriticFinding[] = [];
  const canvas = input.canvas;

  if (canvas.version !== "6.9.1") {
    findings.push({
      code: "TECH_SCHEMA_VERSION",
      severity: "fail",
      message: `Canvas version ${canvas.version} ≠ 6.9.1`,
      points_deducted: 40,
    });
  }
  if (!Array.isArray(canvas.objects) || canvas.objects.length === 0) {
    findings.push({
      code: "TECH_EMPTY",
      severity: "fail",
      message: "Canvas has no objects",
      points_deducted: 50,
    });
  }

  let schemaMismatch = 0;
  for (const o of canvas.objects) {
    for (const k of REQUIRED) {
      if (o[k] === undefined) {
        schemaMismatch++;
        break;
      }
    }
  }
  if (schemaMismatch) {
    findings.push({
      code: "TECH_SCHEMA_MISMATCH",
      severity: "fail",
      message: `${schemaMismatch} object(s) missing Fabric required props`,
      points_deducted: Math.min(40, schemaMismatch * 5),
    });
  }

  const bg = canvas.objects.filter((o) => isPageBg(o));
  if (bg.length !== 1) {
    findings.push({
      code: "TECH_PAGE_BG",
      severity: "fail",
      message: `Expected 1 page background, found ${bg.length}`,
      points_deducted: 15,
    });
  } else if (bg[0].selectable !== false || bg[0].lockMovementX !== true) {
    findings.push({
      code: "TECH_BG_LOCK",
      severity: "fail",
      message: "Page background not locked",
      points_deducted: 10,
    });
  }

  const content = contentObjects(canvas);
  const uneditable = content.filter(
    (o) => o.selectable !== true || o.evented !== true,
  );
  if (uneditable.length) {
    findings.push({
      code: "TECH_EDITABLE",
      severity: "fail",
      message: `${uneditable.length} content object(s) not editable`,
      points_deducted: Math.min(30, uneditable.length * 5),
    });
  }

  if (input.renderer_validation_pass === false) {
    findings.push({
      code: "TECH_RENDERER_ERROR",
      severity: "fail",
      message: "Renderer validation did not pass",
      points_deducted: 25,
    });
  }

  if (canvas.aios?.publication_allowed === true) {
    findings.push({
      code: "TECH_PUBLICATION_FLAG",
      severity: "fail",
      message: "Canvas aios.publication_allowed is true",
      points_deducted: 20,
    });
  }

  const score = applyFindings(100, findings);
  return {
    category: "technical",
    score,
    max: 100,
    findings,
    metrics: {
      object_count: canvas.objects.length,
      schema_mismatch_objects: schemaMismatch,
      uneditable: uneditable.length,
      page_bg_count: bg.length,
      fabric_version: canvas.version,
    },
  };
}
