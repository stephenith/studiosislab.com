/**
 * Pipeline reporter — founder-facing pipeline summary and report.
 */
import { writeFileSync } from "node:fs";
import type { PipelineRunState, PipelineStage, StageTiming } from "./PipelineState.js";
import type { RunFolderLayout } from "./RunManager.js";

export type PipelineReport = {
  run_id: string;
  final_status: string;
  total_duration_ms: number;
  research_time_ms: number;
  generation_time_ms: number;
  qa_time_ms: number;
  review_time_ms: number;
  learning_time_ms: number;
  cursor_invocations: number;
  failures: number;
  retries: number;
  founder_decision: string | null;
  prototype_id: string | null;
  stages_completed: PipelineStage[];
  generated_at: string;
};

function sumStageMs(timings: StageTiming[], stages: PipelineStage[]): number {
  return timings
    .filter((t) => stages.includes(t.stage))
    .reduce((acc, t) => acc + t.duration_ms, 0);
}

export function buildPipelineReport(state: PipelineRunState): PipelineReport {
  const timings = state.stage_timings;
  const total_duration_ms = timings.reduce((acc, t) => acc + t.duration_ms, 0);

  return {
    run_id: state.run_id,
    final_status: state.final_status,
    total_duration_ms,
    research_time_ms: sumStageMs(timings, ["cursor_research", "cursor_execution"]),
    generation_time_ms: sumStageMs(timings, ["production"]),
    qa_time_ms: sumStageMs(timings, ["qa"]),
    review_time_ms: sumStageMs(timings, ["local_review", "founder_approval"]),
    learning_time_ms: sumStageMs(timings, ["learning", "batch_completion"]),
    cursor_invocations: state.cursor_invocations,
    failures: state.cursor_failures + (state.failed_stage ? 1 : 0),
    retries: state.retry_count,
    founder_decision: state.founder_decision,
    prototype_id: state.prototype_id,
    stages_completed: state.completed_stages,
    generated_at: new Date().toISOString(),
  };
}

export function renderPipelineReportMd(
  state: PipelineRunState,
  report: PipelineReport,
): string {
  return [
    "# Resume Autonomous Production Pipeline Report",
    "",
    `**Run ID:** \`${report.run_id}\``,
    `**Final Status:** ${report.final_status}`,
    `**Prototype:** ${report.prototype_id ?? "—"}`,
    `**Founder Decision:** ${report.founder_decision ?? "pending"}`,
    "",
    "## Timing",
    "",
    "| Phase | Duration |",
    "|-------|----------|",
    `| Total | ${report.total_duration_ms}ms |`,
    `| Research | ${report.research_time_ms}ms |`,
    `| Generation | ${report.generation_time_ms}ms |`,
    `| QA | ${report.qa_time_ms}ms |`,
    `| Review | ${report.review_time_ms}ms |`,
    `| Learning | ${report.learning_time_ms}ms |`,
    "",
    "## Operations",
    "",
    `| Metric | Value |`,
    `|--------|-------|`,
    `| Cursor Invocations | ${report.cursor_invocations} |`,
    `| Failures | ${report.failures} |`,
    `| Retries | ${report.retries} |`,
    "",
    "## Stages Completed",
    "",
    report.stages_completed.map((s) => `- ${s}`).join("\n"),
    "",
    "## Integration Chain",
    "",
    "```",
    "Founder → Batch Director → Queue → Runtime Loop → Production Worker → Cursor → QA → Local Review → Founder Approval → Learning → Batch Report",
    "```",
    "",
    "*Integration only — no src/, manifest, or registry changes.*",
  ].join("\n");
}

export function writePipelineReport(
  layout: RunFolderLayout,
  state: PipelineRunState,
): PipelineReport {
  const report = buildPipelineReport(state);
  writeFileSync(layout.pipeline_report, renderPipelineReportMd(state, report), "utf8");
  return report;
}

export function renderRunSummary(state: PipelineRunState, report: PipelineReport): string {
  return [
    "# Pipeline Run Summary",
    "",
    `**Run:** ${state.run_id}`,
    `**Status:** ${state.final_status}`,
    `**Objective:** ${state.objective}`,
    "",
    `Total Duration: ${report.total_duration_ms}ms`,
    `Cursor Invocations: ${report.cursor_invocations}`,
    `Founder Decision: ${report.founder_decision ?? "pending"}`,
    "",
    "Artifacts:",
    "- objective.md",
    "- batch-plan.json",
    "- research.md",
    "- cursor-output.md",
    "- generated/template-preview.json",
    "- qa/validation.json",
    "- localhost/review.json",
    "- learning/feedback.json",
    "- pipeline-report.md",
  ].join("\n");
}
