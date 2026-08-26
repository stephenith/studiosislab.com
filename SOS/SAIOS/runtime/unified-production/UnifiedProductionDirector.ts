/**
 * Unified Resume Production Engine — single execution entry point.
 * Coordinates all SAIOS production components without duplicating logic.
 */
import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import {
  createInitialRunState,
  loadRunState,
  markStageComplete,
  markStageFailed,
  markStageStart,
  saveRunState,
  shouldRunStage,
} from "./ProductionState.js";
import { runStage } from "./StageRunner.js";
import {
  loadAllRunStates,
  persistGlobalDashboard,
  persistRunReports,
  UNIFIED_OUTPUT_ROOT,
} from "./ReportBuilder.js";
import { findRunDir, loadRunForRecovery } from "./Recovery.js";
import type { UnifiedProductionOptions, UnifiedProductionResult } from "./types.js";
import { UNIFIED_STAGES } from "./types.js";
import {
  ENGINES,
  acquireExecutionLock,
  enforceEngineAccess,
} from "../../architecture/runtime-guard.js";

export const UNIFIED_RESUME_PRODUCTION_ENGINE = {
  module: "unified-resume-production-engine",
  version: "1.0.0",
  role: "production_orchestration_only",
  description:
    "Single execution entry point coordinating Research, Benchmark, Design Brain, Composer, Generator, QA, Render, Critic, and Publication.",
  prohibitions: [
    "no_src_modifications",
    "no_duplicate_intelligence",
    "no_automatic_publication",
    "no_founder_auto_approval",
  ],
  architecture_status: "ARCHIVED",
  architecture_note:
    "Agent #160 runtime freeze — not the canonical execution engine. Prefer core/first-production-cycle.",
} as const;

export function allocateRunId(): string {
  const ymd = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  return `unified-${ymd}-${randomUUID().slice(0, 8)}`;
}

export async function runUnifiedProduction(
  options: UnifiedProductionOptions,
): Promise<UnifiedProductionResult> {
  enforceEngineAccess(ENGINES.ARCHIVED_UNIFIED_PRODUCTION);
  const releaseLock = acquireExecutionLock(ENGINES.ARCHIVED_UNIFIED_PRODUCTION.id);
  try {
    return await runUnifiedProductionInner(options);
  } finally {
    releaseLock();
  }
}

async function runUnifiedProductionInner(
  options: UnifiedProductionOptions,
): Promise<UnifiedProductionResult> {
  const mcp = options.mcp_firecrawl_available ?? true;
  const learning_persist = options.learning_persist !== false;
  const seed = options.seed ?? Date.now() % 10000;

  let state;
  let run_dir: string;

  if (options.resume_run_id) {
    const recovered = loadRunForRecovery(options.resume_run_id);
    state = recovered.state;
    run_dir = recovered.run_dir;
    if (state.cancelled) {
      throw new Error(`Run cancelled: ${options.resume_run_id}`);
    }
  } else {
    const run_id = options.run_id ?? allocateRunId();
    run_dir = join(UNIFIED_OUTPUT_ROOT, "runs", run_id);
    mkdirSync(run_dir, { recursive: true });
    state = createInitialRunState({ run_id, run_dir, objective: options.objective });
    saveRunState(state);
  }

  const ctx = { mcp_available: mcp, learning_persist, seed };

  for (const stage of UNIFIED_STAGES) {
    if (!shouldRunStage(state, stage, options.start_from_stage)) continue;

    state = markStageStart(state, stage);
    saveRunState(state);

    const start = Date.now();
    let attempt = 0;
    let result = await runStage(stage, state, ctx);

    while (!result.pass && attempt < state.max_retries) {
      attempt++;
      state = { ...state, retry_count: state.retry_count + 1 };
      result = await runStage(stage, state, ctx);
    }

    if (!result.pass) {
      state = markStageFailed(state, stage, result.error ?? "Stage failed");
      saveRunState(state);
      persistRunReports(state);
      persistGlobalDashboard(loadAllRunStates());

      return buildResult(false, state);
    }

    state = markStageComplete(result.state, stage, Date.now() - start, true, attempt);
    saveRunState(state);
  }

  persistRunReports(state);
  const dashboard_path = persistGlobalDashboard(loadAllRunStates());
  const reports = {
    master_report_path: join(state.run_dir, "master-production-report.json"),
    artifact_index_path: join(state.run_dir, "artifact-index.json"),
  };

  const pass = state.status === "waiting_founder" && state.completed_stages.length === UNIFIED_STAGES.length;

  return {
    pass,
    run_id: state.run_id,
    run_dir: state.run_dir,
    status: state.status,
    awaiting_founder: state.status === "waiting_founder",
    state,
    master_report_path: reports.master_report_path,
    dashboard_path,
    artifact_index_path: reports.artifact_index_path,
  };
}

function buildResult(pass: boolean, state: import("./types.js").UnifiedRunState): UnifiedProductionResult {
  const reports = persistRunReports(state);
  return {
    pass,
    run_id: state.run_id,
    run_dir: state.run_dir,
    status: state.status,
    awaiting_founder: false,
    state,
    master_report_path: reports.master_report_path,
    dashboard_path: join(UNIFIED_OUTPUT_ROOT, "dashboard.json"),
    artifact_index_path: reports.artifact_index_path,
  };
}

export { resumeRun, restartStage, retryFailedStage, cancelRun, rollbackStage } from "./Recovery.js";
