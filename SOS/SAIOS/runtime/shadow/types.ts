/**
 * SAIOS Shadow Mode — types
 */

import type { IsoTimestamp, JobId, PlanId } from "../shared/types.js";
import type { FounderCommand } from "../chief/types.js";
import type { TelegramInboundLike } from "../integration/types.js";

export type LegacyShadowOutcome = {
  ok: boolean;
  runtime_action: string;
  work_order_id?: string;
  reply: string;
  duration_ms: number;
  error?: string | null;
};

export type SaiosShadowOutcome = {
  ok: boolean;
  accepted: boolean;
  plan_id?: PlanId;
  job_ids: JobId[];
  jobs_completed: number;
  jobs_failed: number;
  duration_ms: number;
  worker_assignments: number;
  errors: string[];
};

export type ShadowComparisonMetrics = {
  legacy_duration_ms: number;
  saios_duration_ms: number;
  legacy_ok: boolean;
  saios_ok: boolean;
  legacy_work_order_id?: string;
  saios_plan_id?: PlanId;
  saios_job_count: number;
  saios_jobs_completed: number;
  queue_behavior_match: boolean;
  worker_selection_noted: boolean;
  completion_match: boolean;
  errors: string[];
  notes: string[];
};

export type ShadowComparisonResult = {
  pass: boolean;
  metrics: ShadowComparisonMetrics;
  compared_at: IsoTimestamp;
};

export type ShadowCommandRecord = {
  index: number;
  inbound: TelegramInboundLike;
  founder_command: FounderCommand;
  legacy: LegacyShadowOutcome;
  saios: SaiosShadowOutcome | null;
  comparison: ShadowComparisonResult;
  processed_at: IsoTimestamp;
};

export type ShadowRunReport = {
  run_id: string;
  mode: "shadow";
  authoritative: "legacy";
  started_at: IsoTimestamp;
  finished_at: IsoTimestamp;
  command_count: number;
  legacy_success_count: number;
  saios_success_count: number;
  comparison_pass_count: number;
  pass: boolean;
  records: ShadowCommandRecord[];
};

export type LegacyShadowHandler = (
  text: string,
) => Promise<LegacyShadowOutcome>;
