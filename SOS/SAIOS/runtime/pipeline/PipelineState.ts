/**
 * Pipeline state — persisted per run for recovery and monitoring.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { BatchPlan } from "../directors/resume-production/types.js";
import type { JobId } from "../shared/types.js";

export const PIPELINE_STAGES = [
  "founder_objective",
  "batch_plan",
  "queue_enqueue",
  "runtime_dispatch",
  "cursor_research",
  "cursor_execution",
  "production",
  "qa",
  "local_review",
  "founder_approval",
  "learning",
  "batch_completion",
] as const;

export type PipelineStage = (typeof PIPELINE_STAGES)[number];

export type FounderDecision = "APPROVE" | "REJECT" | "REVISE" | null;

export type StageTiming = {
  stage: PipelineStage;
  started_at: string;
  completed_at: string;
  duration_ms: number;
};

export type PipelineRunState = {
  run_id: string;
  run_dir: string;
  created_at: string;
  updated_at: string;
  objective: string;
  priority: string;
  current_stage: PipelineStage | "completed" | "failed" | "awaiting_founder";
  completed_stages: PipelineStage[];
  failed_stage: PipelineStage | null;
  retry_count: number;
  max_retries: number;
  batch_id: string | null;
  batch_plan: BatchPlan | null;
  queue_job_id: JobId | null;
  worker_id: string | null;
  prototype_id: string | null;
  founder_decision: FounderDecision;
  cursor_invocations: number;
  cursor_failures: number;
  stage_timings: StageTiming[];
  error: string | null;
  final_status: "running" | "awaiting_founder" | "completed" | "failed";
};

export const MAX_PIPELINE_RETRIES = 2;

export function createInitialState(input: {
  run_id: string;
  run_dir: string;
  objective: string;
  priority: string;
}): PipelineRunState {
  const now = new Date().toISOString();
  return {
    run_id: input.run_id,
    run_dir: input.run_dir,
    created_at: now,
    updated_at: now,
    objective: input.objective,
    priority: input.priority,
    current_stage: "founder_objective",
    completed_stages: [],
    failed_stage: null,
    retry_count: 0,
    max_retries: MAX_PIPELINE_RETRIES,
    batch_id: null,
    batch_plan: null,
    queue_job_id: null,
    worker_id: null,
    prototype_id: null,
    founder_decision: null,
    cursor_invocations: 0,
    cursor_failures: 0,
    stage_timings: [],
    error: null,
    final_status: "running",
  };
}

export function stateFilePath(run_dir: string): string {
  return join(run_dir, "pipeline-state.json");
}

export function savePipelineState(state: PipelineRunState): void {
  mkdirSync(state.run_dir, { recursive: true });
  state.updated_at = new Date().toISOString();
  writeFileSync(stateFilePath(state.run_dir), JSON.stringify(state, null, 2));
}

export function loadPipelineState(run_dir: string): PipelineRunState | null {
  const path = stateFilePath(run_dir);
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, "utf8")) as PipelineRunState;
}

export function markStageStart(state: PipelineRunState, stage: PipelineStage): PipelineRunState {
  return { ...state, current_stage: stage, updated_at: new Date().toISOString() };
}

export function markStageComplete(
  state: PipelineRunState,
  stage: PipelineStage,
  duration_ms: number,
): PipelineRunState {
  const timing: StageTiming = {
    stage,
    started_at: new Date(Date.now() - duration_ms).toISOString(),
    completed_at: new Date().toISOString(),
    duration_ms,
  };
  const completed_stages = state.completed_stages.includes(stage)
    ? state.completed_stages
    : [...state.completed_stages, stage];
  return {
    ...state,
    completed_stages,
    stage_timings: [...state.stage_timings, timing],
    updated_at: new Date().toISOString(),
  };
}

export function markStageFailed(
  state: PipelineRunState,
  stage: PipelineStage,
  error: string,
): PipelineRunState {
  return {
    ...state,
    failed_stage: stage,
    current_stage: stage,
    error,
    final_status: "failed",
    updated_at: new Date().toISOString(),
  };
}

export function nextStageAfter(stage: PipelineStage): PipelineStage | null {
  const idx = PIPELINE_STAGES.indexOf(stage);
  if (idx < 0 || idx >= PIPELINE_STAGES.length - 1) return null;
  return PIPELINE_STAGES[idx + 1]!;
}

export function firstIncompleteStage(state: PipelineRunState): PipelineStage {
  for (const stage of PIPELINE_STAGES) {
    if (!state.completed_stages.includes(stage)) return stage;
  }
  return "batch_completion";
}
