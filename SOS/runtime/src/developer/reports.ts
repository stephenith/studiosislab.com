import { writeFile, mkdir, appendFile } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import type { DeveloperPaths } from "./paths.js";
import type { ExecutionResult, ParsedBrief, ExecutionReport } from "./types.js";
import type { EventEnvelope } from "../types.js";
import { emitProgress } from "./progress.js";

export type PmDeveloperReport = {
  task_id: string;
  correlation_id: string;
  completed_at: string;
  summary: string;
  files_changed: string[];
  build_passed: boolean;
  confidence: number;
  blocker: boolean;
  blocker_reason?: string;
  evidence: string[];
  needs_qa: boolean;
  qa_checklist: string[];
  estimated_regression_risk: "low" | "medium" | "high";
};

export function toPmReport(result: ExecutionResult, brief: ParsedBrief): PmDeveloperReport {
  return {
    task_id: brief.task_id,
    correlation_id: brief.correlation_id,
    completed_at: new Date().toISOString(),
    summary: result.summary,
    files_changed: result.files_changed,
    build_passed: result.build_passed,
    confidence: result.confidence,
    blocker: result.blocker,
    blocker_reason: result.blocker_reason,
    evidence: result.evidence,
    needs_qa: result.needs_qa,
    qa_checklist: result.qa_checklist,
    estimated_regression_risk: result.estimated_regression_risk,
  };
}

export async function writeExecutionReport(
  paths: DeveloperPaths,
  report: ExecutionReport,
): Promise<string> {
  await mkdir(paths.reports, { recursive: true });
  const out = join(paths.reports, `${report.task_id}-execution.json`);
  await writeFile(out, JSON.stringify(report, null, 2), "utf8");
  return out;
}

export type PmHandoffPayload = {
  summary: string;
  files_changed: string[];
  build_passed: boolean;
  confidence: number;
  evidence: string[];
  diff_summary: string;
  qa_checklist?: string[];
  needs_qa?: boolean;
  estimated_regression_risk?: "low" | "medium" | "high";
  acceptance_criteria?: string[];
};

/** Writes PM developer report for QA routing — does NOT mark task completed. */
export async function notifyPmDeveloperHandoff(
  paths: DeveloperPaths,
  brief: ParsedBrief,
  payload: PmHandoffPayload,
): Promise<string> {
  const pmReport = {
    task_id: brief.task_id,
    correlation_id: brief.correlation_id,
    completed_at: new Date().toISOString(),
    summary: payload.summary,
    files_changed: payload.files_changed,
    build_passed: payload.build_passed,
    confidence: payload.confidence,
    blocker: false,
    evidence: payload.evidence,
    needs_qa: payload.needs_qa ?? true,
    qa_checklist: payload.qa_checklist ?? brief.qa_checklist,
    estimated_regression_risk: payload.estimated_regression_risk ?? "medium",
    acceptance_criteria: payload.acceptance_criteria ?? brief.acceptance_criteria,
  };

  await mkdir(paths.pmDevReports, { recursive: true });
  const out = join(paths.pmDevReports, `${brief.task_id}.json`);
  await writeFile(out, JSON.stringify(pmReport, null, 2), "utf8");

  const event: EventEnvelope = {
    event_id: randomUUID(),
    timestamp: new Date().toISOString(),
    tenant_id: "studiosis",
    repo_id: "studiosislab",
    project_id: "sos-developer",
    agent: "developer",
    type: "task_complete",
    priority: "P2",
    title: `Developer handoff for QA: ${brief.title}`,
    body: `${payload.summary}\n\nDiff: ${payload.diff_summary}`,
    correlation_id: brief.correlation_id,
    requires_approval: false,
    approval_status: "not_required",
    metadata: { task_id: brief.task_id, ready_for_qa: true },
  };

  const date = new Date().toISOString().slice(0, 10);
  await mkdir(paths.events, { recursive: true });
  await appendFile(join(paths.events, `${date}.jsonl`), `${JSON.stringify(event)}\n`, "utf8");

  return out;
}

export async function writePmCompletionReport(
  paths: DeveloperPaths,
  report: PmDeveloperReport,
): Promise<string> {
  await mkdir(paths.pmDevReports, { recursive: true });
  const out = join(paths.pmDevReports, `${report.task_id}.json`);
  await writeFile(out, JSON.stringify(report, null, 2), "utf8");
  return out;
}

export async function writeDeveloperCompletionReport(
  paths: DeveloperPaths,
  report: PmDeveloperReport,
): Promise<string> {
  await mkdir(paths.reports, { recursive: true });
  const out = join(paths.reports, `${report.task_id}-completion.json`);
  await writeFile(out, JSON.stringify(report, null, 2), "utf8");
  return out;
}

export async function emitTaskCompleteEvent(
  paths: DeveloperPaths,
  brief: ParsedBrief,
  summary: string,
): Promise<void> {
  const event: EventEnvelope = {
    event_id: randomUUID(),
    timestamp: new Date().toISOString(),
    tenant_id: "studiosis",
    repo_id: "studiosislab",
    project_id: "sos-developer",
    agent: "developer",
    type: "task_complete",
    priority: "P2",
    title: `Developer complete: ${brief.title}`,
    body: summary,
    correlation_id: brief.correlation_id,
    requires_approval: false,
    approval_status: "not_required",
    metadata: { task_id: brief.task_id },
  };

  const date = new Date().toISOString().slice(0, 10);
  await mkdir(paths.events, { recursive: true });
  await appendFile(join(paths.events, `${date}.jsonl`), `${JSON.stringify(event)}\n`, "utf8");
}

export async function finalizeCompletion(
  paths: DeveloperPaths,
  brief: ParsedBrief,
  result: ExecutionResult,
): Promise<string> {
  const report = toPmReport(result, brief);
  await writeDeveloperCompletionReport(paths, report);
  const pmPath = await writePmCompletionReport(paths, report);
  await emitProgress(
    paths,
    brief.task_id,
    brief.correlation_id,
    "execution_complete",
    result.summary,
    100,
    { pm_report: pmPath },
  );
  await emitTaskCompleteEvent(paths, brief, result.summary);
  return pmPath;
}
