import { writeFile, mkdir, appendFile } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import type { QaPaths } from "./paths.js";
import type { DeveloperReportInput, ParsedQaBrief, QaFullReport, VerificationResult } from "./types.js";
import type { EventEnvelope } from "../types.js";

export function toFullReport(
  brief: ParsedQaBrief,
  devReport: DeveloperReportInput | null,
  verification: VerificationResult,
): QaFullReport {
  return {
    task_id: brief.task_id,
    correlation_id: brief.correlation_id,
    completed_at: new Date().toISOString(),
    verdict: verification.verdict,
    summary: verification.summary,
    confidence: verification.confidence,
    regression_risk: verification.regression_risk,
    recommended_fixes: verification.recommended_fixes,
    remaining_blockers: verification.remaining_blockers,
    checklist_results: verification.checklist_results,
    repro_steps: verification.repro_steps,
    severity: verification.severity,
    evidence: verification.evidence,
    developer_summary: devReport?.summary,
    recommendation: verification.recommendation,
    screenshots: verification.screenshots,
    screenshot_supported: verification.screenshot_supported,
    failed_checks: verification.checklist_results.filter((r) => !r.passed).map((r) => r.item_id),
  };
}

export function toPmQaReport(report: QaFullReport): {
  task_id: string;
  correlation_id: string;
  completed_at: string;
  verdict: "pass" | "fail" | "blocked";
  summary: string;
  repro_steps?: string[];
  severity?: "critical" | "high" | "medium" | "low";
  evidence: string[];
  recommendation?: string;
  failed_checks?: string[];
  recommended_fixes?: string[];
} {
  return {
    task_id: report.task_id,
    correlation_id: report.correlation_id,
    completed_at: report.completed_at,
    verdict: report.verdict,
    summary: report.summary,
    repro_steps: report.repro_steps,
    severity: report.severity,
    evidence: report.evidence,
    recommendation: report.recommendation,
    failed_checks: report.failed_checks,
    recommended_fixes: report.recommended_fixes,
  };
}

export async function writeQaReports(
  paths: QaPaths,
  full: QaFullReport,
): Promise<{ qaPath: string; pmPath: string }> {
  await mkdir(paths.reports, { recursive: true });
  await mkdir(paths.pmQaReports, { recursive: true });

  const qaPath = join(paths.reports, `${full.task_id}.json`);
  await writeFile(qaPath, JSON.stringify(full, null, 2), "utf8");

  const pmPath = join(paths.pmQaReports, `${full.task_id}.json`);
  await writeFile(pmPath, JSON.stringify(toPmQaReport(full), null, 2), "utf8");

  return { qaPath, pmPath };
}

async function appendEvent(paths: QaPaths, event: EventEnvelope): Promise<void> {
  const date = new Date().toISOString().slice(0, 10);
  await mkdir(paths.events, { recursive: true });
  await appendFile(join(paths.events, `${date}.jsonl`), `${JSON.stringify(event)}\n`, "utf8");
}

export async function emitQaEvents(
  paths: QaPaths,
  brief: ParsedQaBrief,
  verification: VerificationResult,
  full: QaFullReport,
): Promise<void> {
  const base = {
    event_id: randomUUID(),
    timestamp: new Date().toISOString(),
    tenant_id: "studiosis",
    repo_id: "studiosislab",
    project_id: "sos-qa",
    agent: "qa" as const,
    correlation_id: brief.correlation_id,
    requires_approval: false,
    approval_status: "not_required" as const,
    evidence: verification.evidence,
    metadata: {
      task_id: brief.task_id,
      confidence: verification.confidence,
      regression_risk: verification.regression_risk,
    },
  };

  if (verification.verdict === "pass") {
    await appendEvent(paths, {
      ...base,
      type: "task_complete",
      priority: "P2",
      title: `QA verification pass: ${brief.title}`,
      body: verification.summary,
      metadata: { ...base.metadata, verification_result: "verification_pass" },
    });
    await appendEvent(paths, {
      ...base,
      event_id: randomUUID(),
      type: "info",
      priority: "P3",
      title: `verification_pass: ${brief.task_id}`,
      body: verification.summary,
      metadata: { ...base.metadata, verification_result: "verification_pass" },
    });
  } else if (verification.verdict === "blocked") {
    await appendEvent(paths, {
      ...base,
      type: "blocker",
      priority: "P1",
      title: `QA blocked: ${brief.title}`,
      body: verification.remaining_blockers.join("; ") || verification.summary,
      metadata: { ...base.metadata, verification_result: "verification_fail" },
    });
  } else {
    await appendEvent(paths, {
      ...base,
      type: "failure",
      priority: "P1",
      title: `QA verification fail: ${brief.title}`,
      body: verification.summary,
      metadata: {
        ...base.metadata,
        verification_result: "verification_fail",
        recommended_fixes: verification.recommended_fixes,
      },
    });
    await appendEvent(paths, {
      ...base,
      event_id: randomUUID(),
      type: "info",
      priority: "P2",
      title: `verification_fail: ${brief.task_id}`,
      body: verification.recommended_fixes.join("\n") || verification.summary,
      metadata: { ...base.metadata, verification_result: "verification_fail" },
    });
  }
}
