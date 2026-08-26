/**
 * Pipeline orchestrator — one founder request → one autonomous production run.
 * Integrates existing SAIOS components only; never duplicates intelligence systems.
 */
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import {
  createInitialState,
  firstIncompleteStage,
  loadPipelineState,
  markStageComplete,
  markStageFailed,
  markStageStart,
  type FounderDecision,
  type PipelineRunState,
  type PipelineStage,
  savePipelineState,
} from "./PipelineState.js";
import {
  allocateRunId,
  createRunFolder,
  findRunById,
  type RunFolderLayout,
} from "./RunManager.js";
import { buildRecoveryPlan, prepareRetry, type RecoveryPlan } from "./RunRecovery.js";
import {
  executeBatchPlan,
  executeCursorExecution,
  executeCursorResearch,
  executeFounderApproval,
  executeFounderObjective,
  executeLearning,
  executeLocalReview,
  executeProduction,
  executeQa,
  executeQueueEnqueue,
  executeRevisionRequeue,
  executeRuntimeDispatch,
  type ExecutorContext,
  type StageResult,
} from "./PipelineExecutor.js";
import type { CursorExecutor } from "../directors/resume-production/CursorResearchCoordinator.js";
import {
  buildPipelineReport,
  renderRunSummary,
  writePipelineReport,
  type PipelineReport,
} from "./PipelineReporter.js";
import { writeRunSummary } from "./RunArtifacts.js";
import {
  ENGINES,
  acquireExecutionLock,
  enforceEngineAccess,
} from "../../architecture/runtime-guard.js";

export const RESUME_AUTONOMOUS_PIPELINE = {
  pipeline_type: "resume-autonomous-production",
  version: "1.0.0",
  display_name: "Resume Autonomous Production Pipeline",
  description:
    "End-to-end integration: Founder objective → Batch Director → Queue → Runtime → Production → QA → Review → Approval → Learning.",
  integration_only: true,
} as const;

export type RunPipelineOptions = {
  objective: string;
  priority?: string;
  run_id?: string;
  cursor_executor: CursorExecutor;
  mcp_firecrawl_available?: boolean;
  mock_founder_decision?: FounderDecision;
  learning_persist?: boolean;
  queue_jobs_dir?: string;
  registry_dir?: string;
  resume_run_id?: string;
};

export type PipelineRunResult = {
  pass: boolean;
  run_id: string;
  run_dir: string;
  state: PipelineRunState;
  report: PipelineReport;
  awaiting_founder: boolean;
};

type StageHandler = (ctx: ExecutorContext, carry: CarryState) => Promise<StageResult>;

type CarryState = {
  qa_dir?: string;
  qa_pass?: boolean;
};

const STAGE_HANDLERS: Record<PipelineStage, StageHandler> = {
  founder_objective: async (ctx) => executeFounderObjective(ctx),
  batch_plan: async (ctx) => executeBatchPlan(ctx),
  queue_enqueue: async (ctx) => executeQueueEnqueue(ctx),
  runtime_dispatch: async (ctx) => executeRuntimeDispatch(ctx),
  cursor_research: async (ctx) => executeCursorResearch(ctx),
  cursor_execution: async (ctx) => executeCursorExecution(ctx),
  production: async (ctx) => executeProduction(ctx),
  qa: async (ctx) => executeQa(ctx),
  local_review: async (ctx, carry) => executeLocalReview(ctx, carry.qa_pass ?? true),
  founder_approval: async (ctx, carry) =>
    executeFounderApproval(ctx, carry.qa_dir ?? join(ctx.layout.qa, "_staging")),
  learning: async (ctx) => executeLearning(ctx),
  batch_completion: async (ctx) => ({ state: ctx.state }),
};

export async function runPipeline(options: RunPipelineOptions): Promise<PipelineRunResult> {
  enforceEngineAccess(ENGINES.LEGACY_PIPELINE);
  const releaseLock = acquireExecutionLock(ENGINES.LEGACY_PIPELINE.id);
  try {
    return await runPipelineInner(options);
  } finally {
    releaseLock();
  }
}

async function runPipelineInner(options: RunPipelineOptions): Promise<PipelineRunResult> {
  const run_id = options.run_id ?? allocateRunId();
  let layout: RunFolderLayout;
  let state: PipelineRunState;

  if (options.resume_run_id) {
    const recovery = loadRunForRecovery(options.resume_run_id);
    if (!recovery?.can_resume) {
      throw new Error(recovery?.reason ?? `Cannot resume run ${options.resume_run_id}`);
    }
    layout = recovery.layout;
    state = prepareRetry(recovery.state);
  } else {
    layout = createRunFolder(run_id);
    state = createInitialState({
      run_id,
      run_dir: layout.run_dir,
      objective: options.objective,
      priority: options.priority ?? "ats",
    });
    savePipelineState(state);
  }

  const baseCtx: Omit<ExecutorContext, "state"> = {
    layout,
    cursor_executor: options.cursor_executor,
    mcp_firecrawl_available: options.mcp_firecrawl_available,
    mock_founder_decision: options.mock_founder_decision,
    learning_persist: options.learning_persist,
    queue_jobs_dir: options.queue_jobs_dir,
    registry_dir: options.registry_dir,
  };

  const carry: CarryState = {};
  let startStage = options.resume_run_id
    ? firstIncompleteStage(state)
    : ("founder_objective" as PipelineStage);

  const stagesToRun = getStagesFrom(startStage);

  for (const stage of stagesToRun) {
    const stageStart = Date.now();
    state = markStageStart(state, stage);
    savePipelineState(state);

    try {
      const ctx: ExecutorContext = { ...baseCtx, state };
      const handler = STAGE_HANDLERS[stage];
      const result = await handler(ctx, carry);
      state = result.state;
      if (result.qa_dir) carry.qa_dir = result.qa_dir;
      if (result.qa_pass !== undefined) carry.qa_pass = result.qa_pass;

      state = markStageComplete(state, stage, Date.now() - stageStart);
      savePipelineState(state);

      if (stage === "founder_approval" && !options.mock_founder_decision && !state.founder_decision) {
        state = { ...state, final_status: "awaiting_founder", current_stage: "founder_approval" };
        savePipelineState(state);
        const report = writePipelineReport(layout, state);
        writeRunSummary(layout, renderRunSummary(state, report));
        return {
          pass: true,
          run_id,
          run_dir: layout.run_dir,
          state,
          report,
          awaiting_founder: true,
        };
      }

      if (stage === "learning" && state.founder_decision === "REVISE") {
        const rev = await executeRevisionRequeue({ ...baseCtx, state });
        state = rev.state;
        savePipelineState(state);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      state = markStageFailed(state, stage, message);
      savePipelineState(state);
      const report = buildPipelineReport(state);
      writeRunSummary(layout, renderRunSummary(state, report));
      return {
        pass: false,
        run_id,
        run_dir: layout.run_dir,
        state,
        report,
        awaiting_founder: false,
      };
    }
  }

  state = { ...state, final_status: "completed", current_stage: "completed" };
  savePipelineState(state);
  const report = writePipelineReport(layout, state);
  writeRunSummary(layout, renderRunSummary(state, report));

  return {
    pass: state.final_status === "completed",
    run_id,
    run_dir: layout.run_dir,
    state,
    report,
    awaiting_founder: false,
  };
}

export function loadRunForRecovery(run_id: string): RecoveryPlan | null {
  const layout = findRunById(run_id);
  if (!layout) return null;
  const state = loadPipelineState(layout.run_dir);
  if (!state) return null;
  return buildRecoveryPlan(state, layout);
}

function getStagesFrom(start: PipelineStage): PipelineStage[] {
  const all: PipelineStage[] = [
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
  ];
  const idx = all.indexOf(start);
  return idx >= 0 ? all.slice(idx) : all;
}

export async function resumePipeline(
  run_id: string,
  options: Omit<RunPipelineOptions, "objective" | "run_id"> & {
    mock_founder_decision?: FounderDecision;
  },
): Promise<PipelineRunResult> {
  const existing = loadPipelineState(findRunById(run_id)!.run_dir);
  if (!existing) throw new Error(`Run not found: ${run_id}`);

  return runPipeline({
    ...options,
    objective: existing.objective,
    priority: existing.priority,
    run_id: existing.run_id,
    resume_run_id: run_id,
    mock_founder_decision: options.mock_founder_decision ?? existing.founder_decision ?? undefined,
  });
}

export function ensureVerifyDirs(run_dir: string): { jobsDir: string; registryDir: string } {
  const jobsDir = join(run_dir, "_queue");
  const registryDir = join(run_dir, "_registry");
  mkdirSync(jobsDir, { recursive: true });
  mkdirSync(registryDir, { recursive: true });
  return { jobsDir, registryDir };
}
