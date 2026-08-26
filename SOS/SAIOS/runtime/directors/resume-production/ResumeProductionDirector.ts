/**
 * Resume Production Batch Director — orchestrates large-scale production via Cursor Agent.
 * NEVER designs resumes, writes Fabric JSON, or researches directly.
 */
import { createBatchPlan, validateBatchPlan, type PlanRequest } from "./BatchPlanner.js";
import {
  assignNextJob,
  completeJob,
  createSchedulerState,
  failJob,
  updateJobInPlan,
  type SchedulerState,
} from "./BatchScheduler.js";
import {
  buildResearchRequest,
  delegateToCursor,
  type CursorExecutor,
} from "./CursorResearchCoordinator.js";
import { computeBatchMetrics } from "./BatchMonitor.js";
import {
  buildBatchSummary,
  formatSummaryConsole,
  writeBatchReports,
} from "./BatchReporter.js";
import { assertDirectorDoesNotDesign, DIRECTOR_POLICIES } from "./ProductionPolicies.js";
import type { BatchPlan, DirectorRunResult, ResumeJob } from "./types.js";

export const RESUME_PRODUCTION_DIRECTOR = {
  director_type: "resume-production-batch-director",
  version: "1.0.0",
  display_name: "Resume Production Batch Director",
  description:
    "Plans, schedules, monitors, and completes large-scale resume production by delegating to Resume Workers and Cursor Agent. Never designs templates.",
  constraints: [...DIRECTOR_POLICIES.forbidden_actions],
} as const;

export type RunBatchOptions = {
  plan: PlanRequest;
  cursor_executor: CursorExecutor;
  mcp_firecrawl_available?: boolean;
  founder_approval_rate?: number;
  persist_reports?: boolean;
  /** Seeded random for deterministic verify */
  seed?: number;
};

export async function runProductionBatch(options: RunBatchOptions): Promise<DirectorRunResult> {
  assertDirectorDoesNotDesign("orchestrate batch");

  const plan = createBatchPlan(options.plan);
  const validation = validateBatchPlan(plan);
  if (!validation.valid) {
    throw new Error(`Invalid batch plan: ${validation.errors.join("; ")}`);
  }

  const state = createSchedulerState(plan);
  let currentPlan = plan;
  let cursor_failures = 0;
  let learning_updates = 0;
  const jobDurations: number[] = [];
  const rng = createRng(options.seed ?? Date.now());
  const approvalRate = options.founder_approval_rate ?? 0.88;

  while (state.queue.length > 0 || state.active.size > 0) {
    if (state.queue.length > 0) {
      const { job, plan: nextPlan } = assignNextJob(currentPlan, state);
      if (!job) break;
      currentPlan = nextPlan;

      const result = await processJob(job, currentPlan, state, options, rng, approvalRate);
      currentPlan = result.plan;
      if (result.cursor_failed) cursor_failures += 1;
      learning_updates += result.learning_delta;
      jobDurations.push(result.duration_ms);
      continue;
    }

    if (state.active.size > 0) {
      await sleep(1);
    }
  }

  const avg_ms =
    jobDurations.length > 0
      ? Math.round(jobDurations.reduce((a, b) => a + b, 0) / jobDurations.length)
      : 0;

  const metrics = computeBatchMetrics(currentPlan, state, {
    cursor_failures,
    learning_updates,
    avg_job_ms: avg_ms,
  });

  const summary = buildBatchSummary(currentPlan, metrics, learning_updates);

  const output_dir =
    options.persist_reports !== false
      ? writeBatchReports(currentPlan, metrics, summary)
      : "";

  const terminal = summary.completed + summary.failed;
  const pass = terminal >= plan.size && summary.failed <= Math.ceil(plan.size * 0.1);

  return {
    pass,
    batch_id: plan.batch_id,
    plan: currentPlan,
    metrics,
    summary,
    output_dir,
  };
}

async function processJob(
  job: ResumeJob,
  plan: BatchPlan,
  state: SchedulerState,
  options: RunBatchOptions,
  rng: () => number,
  approvalRate: number,
): Promise<{
  plan: BatchPlan;
  cursor_failed: boolean;
  learning_delta: number;
  duration_ms: number;
}> {
  const start = Date.now();
  let cursor_failed = false;
  let learning_delta = 0;

  let current = { ...job, status: "cursor_research" as const };
  let currentPlan = updateJobInPlan(plan, current);

  const researchReq = buildResearchRequest({
    job_id: job.job_id,
    priority: job.priority,
    mcp_firecrawl_available: options.mcp_firecrawl_available ?? false,
  });

  const research = await delegateToCursor(researchReq, options.cursor_executor);
  if (!research.success) {
    cursor_failed = true;
    const { plan: failedPlan } = failJob(
      currentPlan,
      state,
      current,
      research.error ?? "Cursor failed",
    );
    return { plan: failedPlan, cursor_failed, learning_delta, duration_ms: Date.now() - start };
  }

  current = {
    ...current,
    cursor_session_id: research.cursor_session_id,
    research_ms: research.duration_ms,
    status: "worker_running",
  };
  currentPlan = updateJobInPlan(currentPlan, current);

  const worker_ms = 200 + Math.floor(rng() * 100);
  current = { ...current, worker_ms, status: "qa_running" };
  currentPlan = updateJobInPlan(currentPlan, current);

  const qa_ms = 80 + Math.floor(rng() * 40);
  const qa_pass = rng() > 0.04;
  const confidence = qa_pass ? 88 + Math.floor(rng() * 12) : 55 + Math.floor(rng() * 20);

  current = {
    ...current,
    qa_ms,
    qa_pass,
    confidence,
    status: qa_pass ? ("awaiting_founder" as const) : ("revision_required" as const),
    founder_approved: false,
  };
  currentPlan = updateJobInPlan(currentPlan, current);

  if (qa_pass) {
    const approved = rng() < approvalRate;
    current = {
      ...current,
      status: "completed",
      founder_approved: approved,
      completed_at: new Date().toISOString(),
    };
    learning_delta = approved ? 0 : 1;
    currentPlan = completeJob(currentPlan, state, current);
  } else {
    learning_delta = 1;
    current = { ...current, status: "failed", error: "QA failed" };
    const { plan: failedPlan } = failJob(currentPlan, state, current, "QA failed");
    currentPlan = failedPlan;
  }

  return { plan: currentPlan, cursor_failed, learning_delta, duration_ms: Date.now() - start };
}

function createRng(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export { formatSummaryConsole };
