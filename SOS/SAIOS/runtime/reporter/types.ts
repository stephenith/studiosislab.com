/**
 * SAIOS Reporter module — types
 */

import type { IsoTimestamp, JobId } from "../shared/types.js";

export type ProgressReport = {
  kind: "progress";
  job_id: JobId;
  summary: string;
  percent?: number;
  created_at: IsoTimestamp;
};

export type CompletionReport = {
  kind: "completion";
  job_id: JobId;
  summary: string;
  report_path?: string;
  created_at: IsoTimestamp;
};

export type FailureReport = {
  kind: "failure";
  job_id: JobId;
  summary: string;
  error: string;
  created_at: IsoTimestamp;
};

export type SaiosReport = ProgressReport | CompletionReport | FailureReport;

export interface ReporterService {
  createProgressReport(jobId: JobId, summary: string, percent?: number): Promise<ProgressReport>;
  createCompletionReport(jobId: JobId, summary: string, reportPath?: string): Promise<CompletionReport>;
  createFailureReport(jobId: JobId, summary: string, error: string): Promise<FailureReport>;
}
