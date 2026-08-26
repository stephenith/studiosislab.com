/**
 * Unified production state — persisted per run for recovery and monitoring.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { StageTiming, UnifiedRunState, UnifiedStage } from "./types.js";
import { UNIFIED_STAGES } from "./types.js";

export const MAX_STAGE_RETRIES = 2;

export function createInitialRunState(input: {
  run_id: string;
  run_dir: string;
  objective: string;
}): UnifiedRunState {
  const now = new Date().toISOString();
  return {
    run_id: input.run_id,
    run_dir: input.run_dir,
    objective: input.objective,
    created_at: now,
    updated_at: now,
    current_stage: "queued",
    completed_stages: [],
    failed_stage: null,
    status: "running",
    retry_count: 0,
    max_retries: MAX_STAGE_RETRIES,
    stage_timings: [],
    artifacts: [],
    prototype_id: null,
    prototype_dir: null,
    composition_id: null,
    catalog_id: null,
    error: null,
    cancelled: false,
    quality: null,
  };
}

export function runStatePath(run_dir: string): string {
  return join(run_dir, "run.json");
}

export function saveRunState(state: UnifiedRunState): void {
  mkdirSync(state.run_dir, { recursive: true });
  state.updated_at = new Date().toISOString();
  writeFileSync(runStatePath(state.run_dir), JSON.stringify(state, null, 2));
}

export function loadRunState(run_dir: string): UnifiedRunState | null {
  const path = runStatePath(run_dir);
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, "utf8")) as UnifiedRunState;
}

export function markStageStart(state: UnifiedRunState, stage: UnifiedStage): UnifiedRunState {
  return { ...state, current_stage: stage, updated_at: new Date().toISOString() };
}

export function markStageComplete(
  state: UnifiedRunState,
  stage: UnifiedStage,
  duration_ms: number,
  pass: boolean,
  retry_count = 0,
): UnifiedRunState {
  const timing: StageTiming = {
    stage,
    started_at: new Date(Date.now() - duration_ms).toISOString(),
    completed_at: new Date().toISOString(),
    duration_ms,
    pass,
    retry_count,
  };
  const completed = state.completed_stages.includes(stage)
    ? state.completed_stages
    : [...state.completed_stages, stage];
  return {
    ...state,
    completed_stages: completed,
    stage_timings: [...state.stage_timings.filter((t) => t.stage !== stage), timing],
    updated_at: new Date().toISOString(),
  };
}

export function markStageFailed(state: UnifiedRunState, stage: UnifiedStage, error: string): UnifiedRunState {
  return {
    ...state,
    failed_stage: stage,
    status: "failed",
    current_stage: "failed",
    error,
    updated_at: new Date().toISOString(),
  };
}

export function firstIncompleteStage(state: UnifiedRunState): UnifiedStage | null {
  for (const stage of UNIFIED_STAGES) {
    if (!state.completed_stages.includes(stage)) return stage;
  }
  return null;
}

export function stageIndex(stage: UnifiedStage): number {
  return UNIFIED_STAGES.indexOf(stage);
}

export function shouldRunStage(state: UnifiedRunState, stage: UnifiedStage, start_from?: UnifiedStage): boolean {
  if (state.cancelled) return false;
  if (start_from && stageIndex(stage) < stageIndex(start_from)) return false;
  return !state.completed_stages.includes(stage);
}
