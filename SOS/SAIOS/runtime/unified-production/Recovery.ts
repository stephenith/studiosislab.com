/**
 * Recovery — resume, restart, retry, cancel, rollback.
 */
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import {
  firstIncompleteStage,
  loadRunState,
  markStageFailed,
  saveRunState,
  stageIndex,
} from "./ProductionState.js";
import { runUnifiedProduction } from "./UnifiedProductionDirector.js";
import { UNIFIED_OUTPUT_ROOT } from "./ReportBuilder.js";
import type { UnifiedProductionOptions, UnifiedProductionResult, UnifiedStage } from "./types.js";
import { UNIFIED_STAGES } from "./types.js";

export function findRunDir(run_id: string): string {
  return join(UNIFIED_OUTPUT_ROOT, "runs", run_id);
}

export function loadRunForRecovery(run_id: string) {
  const run_dir = findRunDir(run_id);
  const state = loadRunState(run_dir);
  if (!state) throw new Error(`Run not found: ${run_id}`);
  return { run_dir, state };
}

export async function resumeRun(
  run_id: string,
  options: Partial<UnifiedProductionOptions> = {},
): Promise<UnifiedProductionResult> {
  const { state } = loadRunForRecovery(run_id);
  if (state.cancelled) throw new Error(`Run cancelled: ${run_id}`);
  if (state.status === "waiting_founder") return runUnifiedProduction({ ...options, resume_run_id: run_id, objective: state.objective });

  const next = firstIncompleteStage(state);
  if (!next) {
    return runUnifiedProduction({ ...options, resume_run_id: run_id, objective: state.objective });
  }

  return runUnifiedProduction({
    objective: state.objective,
    resume_run_id: run_id,
    start_from_stage: next,
    ...options,
  });
}

export async function restartStage(
  run_id: string,
  stage: UnifiedStage,
  options: Partial<UnifiedProductionOptions> = {},
): Promise<UnifiedProductionResult> {
  const { run_dir, state } = loadRunForRecovery(run_id);
  const rolled = rollbackStageState(state, stage);
  saveRunState(rolled);
  return runUnifiedProduction({
    objective: state.objective,
    resume_run_id: run_id,
    start_from_stage: stage,
    ...options,
  });
}

export async function retryFailedStage(
  run_id: string,
  options: Partial<UnifiedProductionOptions> = {},
): Promise<UnifiedProductionResult> {
  const { state } = loadRunForRecovery(run_id);
  if (!state.failed_stage) throw new Error(`No failed stage for run: ${run_id}`);

  const updated = {
    ...state,
    failed_stage: null,
    status: "running" as const,
    error: null,
    retry_count: state.retry_count + 1,
  };
  saveRunState(updated);

  return runUnifiedProduction({
    objective: state.objective,
    resume_run_id: run_id,
    start_from_stage: state.failed_stage,
    ...options,
  });
}

export function cancelRun(run_id: string): void {
  const { state } = loadRunForRecovery(run_id);
  saveRunState({
    ...state,
    cancelled: true,
    status: "cancelled",
    current_stage: "cancelled",
    updated_at: new Date().toISOString(),
  });
}

export function rollbackStage(state: import("./types.js").UnifiedRunState, stage: UnifiedStage) {
  saveRunState(rollbackStageState(state, stage));
}

function rollbackStageState(
  state: import("./types.js").UnifiedRunState,
  stage: UnifiedStage,
): import("./types.js").UnifiedRunState {
  const idx = stageIndex(stage);
  const keep = UNIFIED_STAGES.slice(0, idx);
  return {
    ...state,
    completed_stages: state.completed_stages.filter((s) => keep.includes(s)),
    stage_timings: state.stage_timings.filter((t) => keep.includes(t.stage)),
    artifacts: state.artifacts.filter((a) => keep.includes(a.stage)),
    failed_stage: null,
    status: "running",
    error: null,
    current_stage: stage,
  };
}

export function listRecoverableRuns(): string[] {
  const runsDir = join(UNIFIED_OUTPUT_ROOT, "runs");
  if (!existsSync(runsDir)) return [];
  return readdirSync(runsDir).filter((id) => existsSync(join(runsDir, id, "run.json")));
}
