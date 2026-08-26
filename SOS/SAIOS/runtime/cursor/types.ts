/**
 * SAIOS Cursor Runner module — types (v1 production)
 */

import type { IsoTimestamp, JobId, WorkerId } from "../shared/types.js";
import type { SaiosJob } from "../queue/types.js";

export type CursorProcessResult = {
  launched: boolean;
  exit_code: number | null;
  stdout: string;
  stderr: string;
  duration_ms: number;
  cursor_bin: string | null;
  cursor_agent_version: string | null;
  error: string | null;
};

export type CursorParsedResult = {
  ok: boolean;
  exit_code: number | null;
  stdout: string;
  stderr: string;
  duration_ms: number;
  output_preview: string;
  files_mentioned: string[];
  error: string | null;
};

export type CursorRunRequest = {
  job: SaiosJob;
  prompt: string;
  workspace_root: string;
  force?: boolean;
  timeout_ms?: number;
};

export type CursorRunOutcome = {
  job_id: JobId;
  worker_id: WorkerId | null;
  launched: boolean;
  ok: boolean;
  exit_code: number | null;
  stdout: string;
  stderr: string;
  duration_ms: number;
  output_preview: string;
  report_path: string;
  error: string | null;
  finished_at: IsoTimestamp;
};

export type CursorJobExecutionResult = {
  job: SaiosJob;
  outcome: CursorRunOutcome;
  report_written: boolean;
};

export const CURSOR_VERIFY_PROMPT = `Create a markdown file inside
SOS/07_LOGS/saios/test-output/
named hello.md

Contents:

# Hello

SAIOS Cursor Runner verification.`;

export const CURSOR_VERIFY_HELLO_PATH = "SOS/07_LOGS/saios/test-output/hello.md";

export const CURSOR_VERIFY_HELLO_CONTENT = `# Hello

SAIOS Cursor Runner verification.`;
