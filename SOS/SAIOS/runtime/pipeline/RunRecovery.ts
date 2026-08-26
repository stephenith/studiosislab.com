/**
 * Run recovery — resume from last successful stage after Cursor or stage failure.
 */
import { existsSync } from "node:fs";
import {
  firstIncompleteStage,
  loadPipelineState,
  MAX_PIPELINE_RETRIES,
  type PipelineRunState,
  type PipelineStage,
  savePipelineState,
} from "./PipelineState.js";
import { findRunById, type RunFolderLayout } from "./RunManager.js";

export type RecoveryPlan = {
  can_resume: boolean;
  resume_from: PipelineStage;
  state: PipelineRunState;
  layout: RunFolderLayout;
  reason?: string;
};

export function loadRunForRecovery(run_id: string): RecoveryPlan | null {
  const layout = findRunById(run_id);
  if (!layout) return null;

  const state = loadPipelineState(layout.run_dir);
  if (!state) return null;

  return buildRecoveryPlan(state, layout);
}

export function buildRecoveryPlan(
  state: PipelineRunState,
  layout: RunFolderLayout,
): RecoveryPlan {
  if (state.final_status === "completed") {
    return {
      can_resume: false,
      resume_from: "batch_completion",
      state,
      layout,
      reason: "Run already completed",
    };
  }

  if (state.final_status === "awaiting_founder") {
    return {
      can_resume: true,
      resume_from: "founder_approval",
      state,
      layout,
      reason: "Awaiting founder decision",
    };
  }

  if (state.retry_count >= MAX_PIPELINE_RETRIES) {
    return {
      can_resume: false,
      resume_from: firstIncompleteStage(state),
      state,
      layout,
      reason: `Maximum retries (${MAX_PIPELINE_RETRIES}) exceeded`,
    };
  }

  const resume_from = state.failed_stage ?? firstIncompleteStage(state);

  return {
    can_resume: true,
    resume_from,
    state,
    layout,
    reason: state.failed_stage
      ? `Resume after failure at ${state.failed_stage}`
      : "Resume from first incomplete stage",
  };
}

export function prepareRetry(state: PipelineRunState): PipelineRunState {
  const next: PipelineRunState = {
    ...state,
    retry_count: state.retry_count + 1,
    failed_stage: null,
    error: null,
    final_status: "running",
    current_stage: state.failed_stage ?? firstIncompleteStage(state),
  };
  savePipelineState(next);
  return next;
}

export function runFolderExists(run_id: string): boolean {
  const layout = findRunById(run_id);
  return layout !== null && existsSync(layout.pipeline_state);
}
