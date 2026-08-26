/**
 * V3 report writers — premium artifacts + local review package.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type {
  PreGenerationChecklist,
  PremiumScores,
  ProductionV3Result,
  TripleCritiqueReport,
  PremiumIntegrationContext,
} from "./types-v3.js";
import type { DesignPlan, ConfidenceScores } from "./types-v2.js";
import type { DuplicateCheckResultV3 } from "./duplicate-detector-v3.js";
import type { EditorValidationResult } from "./editor-validation.js";
import type { ValidationReport } from "./validator.js";
import type { ProductionDesignBundle } from "./design-bundle.js";
import type { DesignSystemGatesResult } from "./design-system-gates.js";
import { writeChecklistArtifacts } from "./pre-generation-checklist.js";

export function writePremiumReports(dir: string, payload: {
  objective: string;
  integration: PremiumIntegrationContext;
  checklist: PreGenerationChecklist;
  design_plan: DesignPlan;
  design_bundle: ProductionDesignBundle;
  design_system_gates: DesignSystemGatesResult;
  design_bundle_artifacts: string[];
  critiques: TripleCritiqueReport[];
  validation: ValidationReport;
  editor: EditorValidationResult;
  premium_scores: PremiumScores;
  confidence: ConfidenceScores;
  duplicate: DuplicateCheckResultV3;
  thumbnail_analysis: Record<string, unknown>;
  local_review: Record<string, unknown>;
  result: ProductionV3Result;
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

  writeChecklistArtifacts(dir, payload.checklist, (name, content) => write(name, content));

  write("designer-review.md", renderCritiqueMd(payload.critiques[0]));
  write("recruiter-review.md", renderCritiqueMd(payload.critiques[1]));
  write("founder-review.md", renderCritiqueMd(payload.critiques[2]));
  write("premium-score.json", payload.premium_scores);
  write("design-plan.json", payload.design_plan);
  write("design-system-gates.json", payload.design_system_gates);
  for (const artifact of payload.design_bundle_artifacts) {
    files.push(artifact);
  }
  write("validation.json", {
    ...payload.validation,
    editor_checks: payload.editor.editor_checks,
    editor_pass: payload.editor.pass,
  });
  write("confidence.json", payload.confidence);
  write("generation-report-v3.md", renderGenerationReportV3(payload));
  write("comparison-report.md", renderComparisonReport(payload));
  write("before-after.md", renderBeforeAfter(payload));
  write("thumbnail-analysis.json", payload.thumbnail_analysis);
  write("localhost/review.json", payload.local_review);
  write("localhost/designer-review.md", renderCritiqueMd(payload.critiques[0]));
  write("final-summary.md", renderFinalSummary(payload));

  return files;
}

function renderCritiqueMd(c: TripleCritiqueReport | undefined): string {
  if (!c) return "# Critique\n\n_No report_";
  return [
    `# ${c.role.charAt(0).toUpperCase() + c.role.slice(1)} Critique — Pass #${c.pass_number}`,
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
    "## Revisions Applied",
    "",
    ...c.revisions_applied.map((r) => `- ${r}`),
  ].join("\n");
}

function renderGenerationReportV3(payload: {
  objective: string;
  integration: PremiumIntegrationContext;
  checklist: PreGenerationChecklist;
  premium_scores: PremiumScores;
  duplicate: DuplicateCheckResultV3;
}): string {
  return [
    "# Generation Report — Premium Resume Generator v3",
    "",
    `**Objective:** ${payload.objective}`,
    `**Family:** ${payload.checklist.layout_selection.selected_family_id}`,
    `**Premium Score:** ${payload.premium_scores.premium_score}/100`,
    `**Overall Confidence:** ${payload.premium_scores.overall_confidence}/100`,
    "",
    "## Design Sources",
    "",
    "Research → Benchmark → Design Brain → Learning → Intelligence → Worker",
    "",
    `**Brain decision:** ${payload.integration.brain_decisions.decision_id}`,
    `**Benchmark patterns:** ${payload.integration.benchmark_patterns_used.length}`,
    "",
    "## Pipeline",
    "",
    "Integration → Pre-generation checklist → Triple critique → Fabric JSON → QA → Local Review → STOP",
    "",
    "## Status",
    "",
    "**AWAITING_FOUNDER_APPROVAL** — no publishing",
  ].join("\n");
}

function renderComparisonReport(payload: {
  duplicate: DuplicateCheckResultV3;
  integration: PremiumIntegrationContext;
}): string {
  const top = payload.duplicate.comparison.most_similar_templates.slice(0, 3);
  return [
    "# Comparison Report",
    "",
    `**Max similarity:** ${Math.round(payload.duplicate.max_similarity * 100)}%`,
    `**Uniqueness:** ${payload.duplicate.uniqueness_score}%`,
    `**Threshold:** 70%`,
    "",
    "## Corpus Comparison",
    "",
    ...top.map(
      (t) => `- ${t.template_id}: ${Math.round(t.similarity_score * 100)}% similar — ${t.reason}`,
    ),
    "",
    "## Memory Checks",
    "",
    `- Benchmark memory clear: ${payload.duplicate.benchmark_memory_clear ? "yes" : "no"}`,
    `- Learning memory clear: ${payload.duplicate.learning_memory_clear ? "yes" : "no"}`,
    `- Production batch clear: ${payload.duplicate.batch_clear ? "yes" : "no"}`,
  ].join("\n");
}

function renderBeforeAfter(payload: {
  checklist: PreGenerationChecklist;
  premium_scores: PremiumScores;
}): string {
  return [
    "# Before / After — Premium Generation",
    "",
    "## Before (Prediction)",
    "",
    `- Predicted premium: ${payload.checklist.quality_prediction.predicted_premium}`,
    `- Predicted download: ${payload.checklist.quality_prediction.predicted_download}`,
    "",
    "## After (Scored)",
    "",
    `- Premium score: ${payload.premium_scores.premium_score}`,
    `- Download prediction: ${payload.premium_scores.download_prediction}`,
    `- Overall confidence: ${payload.premium_scores.overall_confidence}`,
  ].join("\n");
}

function renderFinalSummary(payload: {
  result: ProductionV3Result;
  premium_scores: PremiumScores;
}): string {
  return [
    "# Final Summary — Premium Resume Generator v3",
    "",
    `**Generator:** v3.0.0`,
    `**Prototype:** ${payload.result.prototype_id}`,
    `**Status:** ${payload.result.status}`,
    `**Premium Score:** ${payload.premium_scores.premium_score}`,
    `**Overall Confidence:** ${payload.premium_scores.overall_confidence}`,
    `**QA:** ${payload.result.qa_pass ? "PASS" : "FAIL"}`,
    "",
    `Review: \`${payload.result.local_review_command}\``,
  ].join("\n");
}
