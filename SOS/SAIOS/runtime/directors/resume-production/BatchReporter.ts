/**
 * Batch reporter — produce founder-facing batch summaries.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import type { BatchMetrics, BatchPlan, BatchSummary } from "./types.js";

const SOS_ROOT = resolve(import.meta.dirname, "../../../..");

export function getBatchOutputDir(batch_id: string): string {
  return join(SOS_ROOT, "07_LOGS/saios/batches", batch_id);
}

export function buildBatchSummary(
  plan: BatchPlan,
  metrics: BatchMetrics,
  learning_rules_added: number,
): BatchSummary {
  const completed = plan.jobs.filter((j) => j.status === "completed");
  const passed_qa = completed.filter((j) => j.qa_pass);
  const founder_approved = completed.filter((j) => j.founder_approved);
  const revision_required = completed.filter((j) => j.qa_pass && !j.founder_approved).length;
  const failed = plan.jobs.filter((j) => j.status === "failed").length;

  const confidences = completed
    .map((j) => j.confidence)
    .filter((c): c is number => typeof c === "number");
  const average_confidence =
    confidences.length > 0
      ? Math.round(confidences.reduce((a, b) => a + b, 0) / confidences.length)
      : 0;

  const priorityLabel = plan.primary_priority.toUpperCase();
  const title = `Batch ${plan.size} ${priorityLabel} Templates`;

  return {
    batch_id: plan.batch_id,
    title,
    completed: completed.length,
    passed_qa: passed_qa.length,
    founder_approved: founder_approved.length,
    revision_required,
    failed,
    average_confidence,
    learning_rules_added,
    generated_at: new Date().toISOString(),
  };
}

export function writeBatchReports(
  plan: BatchPlan,
  metrics: BatchMetrics,
  summary: BatchSummary,
): string {
  const dir = getBatchOutputDir(plan.batch_id);
  mkdirSync(dir, { recursive: true });

  writeFileSync(join(dir, "batch-plan.json"), JSON.stringify(plan, null, 2));
  writeFileSync(join(dir, "batch-metrics.json"), JSON.stringify(metrics, null, 2));
  writeFileSync(join(dir, "batch-summary.json"), JSON.stringify(summary, null, 2));
  writeFileSync(join(dir, "report.md"), renderBatchReportMd(plan, metrics, summary));

  return dir;
}

function renderBatchReportMd(
  plan: BatchPlan,
  metrics: BatchMetrics,
  summary: BatchSummary,
): string {
  return [
    `# ${summary.title}`,
    "",
    `**Batch ID:** \`${plan.batch_id}\``,
    `**Generated:** ${summary.generated_at}`,
    "",
    "## Batch Summary",
    "",
    "| Metric | Value |",
    "|--------|-------|",
    `| Completed | ${summary.completed} |`,
    `| Passed QA | ${summary.passed_qa} |`,
    `| Founder Approved | ${summary.founder_approved} |`,
    `| Revision Required | ${summary.revision_required} |`,
    `| Failed | ${summary.failed} |`,
    `| Average Confidence | ${summary.average_confidence} |`,
    `| Learning Rules Added | ${summary.learning_rules_added} |`,
    "",
    "## Monitoring",
    "",
    `| Metric | Value |`,
    `|--------|-------|`,
    `| Success Rate | ${metrics.success_rate}% |`,
    `| Active Jobs | ${metrics.active} |`,
    `| Remaining | ${metrics.remaining} |`,
    `| Cursor Failures | ${metrics.cursor_failures} |`,
    `| Research Time | ${metrics.research_time_ms}ms |`,
    `| QA Time | ${metrics.qa_time_ms}ms |`,
    `| Approval Rate | ${metrics.approval_rate}% |`,
    `| ETA | ${metrics.eta_ms}ms |`,
    "",
    "## Delegation chain",
    "",
    "```",
    "Founder → Director → Batch Plan → Resume Jobs → Resume Workers → Cursor Agent → QA → Founder Approval",
    "```",
    "",
    "*Director orchestrates only. Cursor Agent executes production. No src/ or manifest changes.*",
  ].join("\n");
}

export function formatSummaryConsole(summary: BatchSummary): string {
  return [
    "Batch Summary",
    "─────────────",
    summary.title,
    `Completed:          ${summary.completed}`,
    `Passed QA:          ${summary.passed_qa}`,
    `Founder Approved:   ${summary.founder_approved}`,
    `Revision Required:  ${summary.revision_required}`,
    `Average Confidence: ${summary.average_confidence}`,
    `Learning Rules Added: ${summary.learning_rules_added}`,
  ].join("\n");
}
