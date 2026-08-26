import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { JobId, WorkerId } from "../../shared/types.js";
import type { CursorRunOutcome } from "../../cursor/types.js";
import { engineeringExecutionReportPath, resolveEngineeringPaths } from "./paths.js";

export type EngineeringExecutionStatus = "success" | "failed" | "cancelled";

export type EngineeringExecutionReport = {
  job_id: JobId;
  worker_id: WorkerId;
  cursor_run_id: string;
  started_at: string;
  completed_at: string;
  duration_ms: number;
  status: EngineeringExecutionStatus;
  files_changed: string[];
  summary: string;
  cursor_output: string;
  verification_requested: boolean;
  errors: string[];
  report_path: string;
};

function extractFilesChanged(stdout: string, stderr: string): string[] {
  const combined = `${stdout}\n${stderr}`;
  const paths = new Set<string>();
  const patterns = [
    /(?:created|wrote|updated|saved)\s+[`'"]?([^\s`'"]+\.(?:md|ts|tsx|js|json|txt))[`'"]?/gi,
    /(SOS\/07_LOGS\/saios\/directors\/engineering\/[^\s`'"]+)/gi,
  ];
  for (const pattern of patterns) {
    for (const match of combined.matchAll(pattern)) {
      const path = match[1]?.trim();
      if (path) paths.add(path);
    }
  }
  return [...paths];
}

export function buildEngineeringExecutionReport(input: {
  job_id: JobId;
  worker_id: WorkerId;
  cursor_run_id: string;
  started_at: string;
  outcome: CursorRunOutcome;
  verification_requested: boolean;
  output_dir: string;
}): EngineeringExecutionReport {
  const status: EngineeringExecutionStatus = input.outcome.ok ? "success" : "failed";
  const errors = input.outcome.error ? [input.outcome.error] : [];
  const files = extractFilesChanged(input.outcome.stdout, input.outcome.stderr);

  const summary =
    status === "success"
      ? `Engineering job ${input.job_id} completed via Cursor Agent in ${input.outcome.duration_ms}ms`
      : `Engineering job ${input.job_id} failed: ${input.outcome.error ?? "unknown error"}`;

  const relPath = `SOS/07_LOGS/saios/directors/engineering/execution-reports/${input.job_id.replace(/[^a-zA-Z0-9_-]/g, "_")}.json`;

  return {
    job_id: input.job_id,
    worker_id: input.worker_id,
    cursor_run_id: input.cursor_run_id,
    started_at: input.started_at,
    completed_at: input.outcome.finished_at,
    duration_ms: input.outcome.duration_ms,
    status,
    files_changed: files,
    summary,
    cursor_output: input.outcome.output_preview || input.outcome.stdout.slice(0, 2000),
    verification_requested: input.verification_requested,
    errors,
    report_path: relPath,
  };
}

export async function writeEngineeringExecutionReport(
  report: EngineeringExecutionReport,
  reportsDir?: string,
): Promise<string> {
  const dir = reportsDir ?? join(resolveEngineeringPaths().reportsDir, "execution-reports");
  await mkdir(dir, { recursive: true });
  const absPath = engineeringExecutionReportPath(dir, report.job_id);
  await writeFile(absPath, JSON.stringify(report, null, 2), "utf8");
  return absPath;
}
