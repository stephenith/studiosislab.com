/**
 * V2 report writers — all mandatory production artifacts.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { DesignPlan, ConfidenceScores, SelfCritiqueReport, ProductionV2Result } from "./types-v2.js";
import type { DuplicateCheckResult } from "./duplicate-detector.js";
import type { EditorValidationResult } from "./editor-validation.js";
import type { ValidationReport } from "./validator.js";

export function writeProductionReports(dir: string, payload: {
  objective: string;
  research_md: string;
  design_plan: DesignPlan;
  critique1: SelfCritiqueReport;
  critique2: SelfCritiqueReport;
  validation: ValidationReport;
  editor: EditorValidationResult;
  confidence: ConfidenceScores;
  duplicate: DuplicateCheckResult;
  thumbnail_analysis: Record<string, unknown>;
  local_review: Record<string, unknown>;
  result: ProductionV2Result;
}): string[] {
  const files: string[] = [];

  const write = (name: string, content: string | object) => {
    const path = join(dir, name);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(
      path,
      typeof content === "string" ? content : JSON.stringify(content, null, 2),
    );
    files.push(name);
  };

  write("research-report.md", payload.research_md);
  write("design-plan.json", payload.design_plan);
  write("design-review-1.md", renderCritiqueMd(payload.critique1));
  write("design-review-2.md", renderCritiqueMd(payload.critique2));
  write("validation.json", {
    ...payload.validation,
    editor_checks: payload.editor.editor_checks,
    editor_pass: payload.editor.pass,
  });
  write("confidence.json", payload.confidence);
  write("generation-report.md", renderGenerationReport(payload));
  write("thumbnail-analysis.json", payload.thumbnail_analysis);
  write("localhost/review.json", payload.local_review);
  write("final-summary.md", renderFinalSummary(payload));

  return files;
}

function renderCritiqueMd(c: SelfCritiqueReport): string {
  return [
    `# Design Self-Critique Pass #${c.pass_number}`,
    "",
    `**Reviewed:** ${c.reviewed_at}`,
    `**Confidence:** ${c.confidence_before} → ${c.confidence_after}`,
    "",
    "## Categories",
    "",
    ...c.categories.map(
      (cat) => `- **${cat.category}** (${cat.score}/100) — ${cat.pass ? "PASS" : "NEEDS WORK"}: ${cat.notes}`,
    ),
    "",
    "## Improvements Applied",
    "",
    ...c.improvements_applied.map((i) => `- ${i}`),
  ].join("\n");
}

function renderGenerationReport(payload: {
  objective: string;
  design_plan: DesignPlan;
  confidence: ConfidenceScores;
  duplicate: DuplicateCheckResult;
}): string {
  return [
    "# Generation Report — Resume Production Worker v2",
    "",
    `**Objective:** ${payload.objective}`,
    `**Family:** ${payload.design_plan.family_id}`,
    `**Overall Confidence:** ${payload.confidence.overall_confidence}/100`,
    `**Duplicate redesigns:** ${payload.duplicate.redesign_required ? 1 : 0}`,
    "",
    "## Pipeline",
    "",
    "Knowledge → Research → Planning → Self-Critique ×2 → Fabric JSON → Validation → QA → Local Review → STOP",
    "",
    "## Status",
    "",
    "**AWAITING_FOUNDER_APPROVAL** — no publishing",
  ].join("\n");
}

function renderFinalSummary(payload: {
  result: ProductionV2Result;
  confidence: ConfidenceScores;
}): string {
  return [
    "# Final Summary",
    "",
    `**Worker:** v2.0.0`,
    `**Prototype:** ${payload.result.prototype_id}`,
    `**Status:** ${payload.result.status}`,
    `**Overall Confidence:** ${payload.confidence.overall_confidence}`,
    `**QA:** ${payload.result.qa_pass ? "PASS" : "FAIL"}`,
    "",
    `Review: \`${payload.result.local_review_command}\``,
  ].join("\n");
}
