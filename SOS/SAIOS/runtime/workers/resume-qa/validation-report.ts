/**
 * Aggregate QA reports and write SOS/07_LOGS/saios/qa artifacts
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type {
  PipelineStageResult,
  QAModuleReport,
  QATemplateContext,
  QAValidationSummary,
} from "./types.js";
import { QA_OUTPUT_ROOT } from "./template-input.js";
import { buildSEOProposal } from "./seo-check.js";

export function getQAOutputDir(ctx: QATemplateContext): string {
  return join(QA_OUTPUT_ROOT, ctx.prototype_id);
}

export function buildValidationSummary(
  ctx: QATemplateContext,
  stages: PipelineStageResult[],
): QAValidationSummary {
  const stages_passed = stages.filter((s) => s.pass).length;
  return {
    pass: stages.every((s) => s.pass),
    template_id: ctx.template_id,
    prototype_id: ctx.prototype_id,
    validated_at: new Date().toISOString(),
    stages_passed,
    stages_total: stages.length,
    stages,
  };
}

export function writeQAReports(
  ctx: QATemplateContext,
  stages: PipelineStageResult[],
): { output_dir: string; summary: QAValidationSummary } {
  const output_dir = getQAOutputDir(ctx);
  mkdirSync(output_dir, { recursive: true });

  const summary = buildValidationSummary(ctx, stages);
  const byModule = Object.fromEntries(stages.map((s) => [s.stage, s.report]));

  writeFileSync(join(output_dir, "validation.json"), JSON.stringify(summary, null, 2));
  writeFileSync(join(output_dir, "alignment.json"), JSON.stringify(byModule.alignment, null, 2));
  writeFileSync(join(output_dir, "spacing.json"), JSON.stringify(byModule.spacing, null, 2));
  writeFileSync(
    join(output_dir, "typography.json"),
    JSON.stringify(byModule.typography, null, 2),
  );
  writeFileSync(join(output_dir, "ats.json"), JSON.stringify(byModule.ats, null, 2));
  writeFileSync(join(output_dir, "editor.json"), JSON.stringify(byModule.editor, null, 2));
  writeFileSync(join(output_dir, "fabric.json"), JSON.stringify(byModule.fabric, null, 2));
  writeFileSync(join(output_dir, "thumbnail.json"), JSON.stringify(byModule.thumbnail, null, 2));
  writeFileSync(join(output_dir, "seo.json"), JSON.stringify(byModule.seo, null, 2));

  const seo = buildSEOProposal(ctx);
  writeFileSync(join(output_dir, "report.md"), renderMarkdownReport(ctx, summary, stages, seo));

  return { output_dir, summary };
}

function renderMarkdownReport(
  ctx: QATemplateContext,
  summary: QAValidationSummary,
  stages: PipelineStageResult[],
  seo: ReturnType<typeof buildSEOProposal>,
): string {
  const lines: string[] = [
    `# Resume QA Report — ${ctx.title}`,
    "",
    `**Prototype:** \`${ctx.prototype_id}\``,
    `**Validated:** ${summary.validated_at}`,
    `**Overall:** ${summary.pass ? "PASS" : "FAIL"} (${summary.stages_passed}/${summary.stages_total} stages)`,
    "",
    "## Pipeline Stages",
    "",
    "| Stage | Result | Checks |",
    "|-------|--------|--------|",
  ];

  for (const stage of stages) {
    const passed = stage.report.checks.filter((c) => c.pass).length;
    lines.push(
      `| ${stage.stage} | ${stage.pass ? "PASS" : "FAIL"} | ${passed}/${stage.report.checks.length} |`,
    );
  }

  lines.push("", "## SEO Proposal", "");
  lines.push(`- **Title:** ${seo.title}`);
  lines.push(`- **Slug:** ${seo.slug}`);
  lines.push(`- **Category:** ${seo.category}`);
  lines.push(`- **ATS tag:** ${seo.ats_tag}`);
  lines.push(`- **Visual tag:** ${seo.visual_tag}`);
  lines.push(`- **Keywords:** ${seo.keywords.join(", ")}`);
  lines.push("", "## Founder Gate", "");
  lines.push("Status: **WAITING_FOR_FOUNDER_APPROVAL**");
  lines.push("");
  lines.push("No files have been written to `src/`, registry, or manifest.");

  for (const stage of stages) {
    lines.push("", `## ${stage.stage}`, "");
    for (const check of stage.report.checks) {
      lines.push(`- [${check.pass ? "x" : " "}] **${check.id}** — ${check.detail}`);
    }
  }

  return lines.join("\n");
}

export function stageResult(stage: string, report: QAModuleReport): PipelineStageResult {
  return { stage, pass: report.pass, report };
}
