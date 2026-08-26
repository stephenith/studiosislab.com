/**
 * Autonomous Resume Factory Scheduler — main director.
 */
import { randomUUID } from "node:crypto";
import {
  buildObjective,
  loadConfig,
  saveConfig,
  CONFIG_PATH,
} from "./SchedulerConfig.js";
import {
  createSchedulerState,
  loadSchedulerState,
  saveSchedulerState,
  markInterrupted,
  markResumed,
} from "./SchedulerState.js";
import {
  createSchedulerQueue,
  enqueueProductionJob,
  listQueuedSchedulerJobs,
  markJobFailed,
  markJobRunning,
  markJobWaitingFounder,
} from "./QueueIntegration.js";
import {
  defaultProductionExecutor,
  createMockProductionExecutor,
  validateFounderGate,
  categoryToIndustry,
} from "./ProductionExecutor.js";
import { selectGoalsForTick, shouldSkipGoal } from "./SmartProduction.js";
import { isGoalDue } from "./SchedulePlanner.js";
import { canCreateJob, recordJobCreated, recordJobCompleted } from "./WorkloadManager.js";
import { appendJobHistory, appendSchedulerMemory } from "./SchedulerMemory.js";
import { persistSchedulerReports } from "./ReportBuilder.js";
import type {
  ProductionExecutor,
  SchedulerOptions,
  SchedulerRunState,
  SchedulerStartResult,
  SchedulerTickResult,
} from "./types.js";

export const AUTONOMOUS_SCHEDULER = {
  module: "autonomous-resume-factory-scheduler",
  version: "1.0.0",
  role: "operational_controller_only",
  description:
    "24×7 operational controller — decides WHEN, WHAT, HOW MANY to produce. Never generates resumes itself.",
  prohibitions: [
    "no_resume_generation",
    "no_auto_publish",
    "no_founder_bypass",
    "no_src_modifications",
  ],
} as const;

let activeExecutor: ProductionExecutor = defaultProductionExecutor;
let activeState: SchedulerRunState | null = null;

export function getActiveSchedulerState(): SchedulerRunState | null {
  return activeState ?? loadSchedulerState();
}

export async function startScheduler(options: SchedulerOptions = {}): Promise<SchedulerStartResult> {
  const config = saveConfig({ ...loadConfig(), ...options.config });
  activeExecutor = options.production_executor ?? (options.dry_run ? createMockProductionExecutor() : defaultProductionExecutor);

  activeState = loadSchedulerState() ?? createSchedulerState();
  if (activeState.status === "interrupted") {
    activeState = markResumed(activeState);
  } else {
    activeState.status = "running";
  }
  saveSchedulerState(activeState, options.persist !== false);
  persistSchedulerReports({ state: activeState, config, persist: options.persist !== false });

  return {
    pass: true,
    scheduler_id: activeState.scheduler_id,
    status: activeState.status,
    config_path: CONFIG_PATH,
  };
}

export async function resumeScheduler(options: SchedulerOptions = {}): Promise<SchedulerStartResult> {
  const existing = loadSchedulerState();
  if (!existing) return startScheduler(options);
  activeState = markResumed(existing);
  saveSchedulerState(activeState, options.persist !== false);
  return startScheduler({ ...options, config: loadConfig() });
}

export function stopScheduler(): void {
  if (activeState) {
    activeState.status = "stopped";
    saveSchedulerState(activeState);
  }
}

export function interruptScheduler(): void {
  if (activeState) {
    activeState = markInterrupted(activeState);
    saveSchedulerState(activeState);
  }
}

export async function tickScheduler(options: SchedulerOptions = {}): Promise<SchedulerTickResult> {
  const config = options.config
    ? saveConfig({ ...loadConfig(), ...options.config }, options.persist !== false)
    : loadConfig();
  const state = activeState ?? loadSchedulerState() ?? createSchedulerState();
  activeState = state;
  activeExecutor = options.production_executor ?? activeExecutor;

  const queue = createSchedulerQueue();
  const alerts: string[] = [];
  let jobs_created = 0;
  let jobs_processed = 0;
  let jobs_waiting_founder = 0;

  const dueGoals = selectGoalsForTick(config.goals).filter((g) =>
    isGoalDue(g, state.last_goal_runs[g.id]),
  );

  for (const goal of dueGoals) {
    const skip = shouldSkipGoal(goal);
    if (skip.skip) {
      alerts.push(skip.reason ?? `Skipped ${goal.id}`);
      continue;
    }

    const workload = canCreateJob(state, config.workload);
    if (!workload.allowed) {
      alerts.push(workload.reason ?? "Workload limit");
      break;
    }

    for (let i = 0; i < goal.max_per_run; i++) {
      const scheduler_job_id = `sched-${randomUUID().slice(0, 8)}`;
      const objective = buildObjective(goal, categoryToIndustry(goal.category));
      const record = await enqueueProductionJob(queue, { goal, objective, scheduler_job_id });
      appendJobHistory({
        recorded_at: new Date().toISOString(),
        job_id: record.job_id,
        goal_id: goal.id,
        category: goal.category,
        unified_run_id: null,
        status: "queued",
        awaiting_founder: false,
      }, options.persist !== false);

      Object.assign(state, recordJobCreated(state));
      jobs_created++;
    }

    state.last_goal_runs[goal.id] = new Date().toISOString();
  }

  const queued = await listQueuedSchedulerJobs(queue);
  const toProcess = queued.slice(0, config.workload.max_concurrent_runs - state.active_run_ids.length);

  for (const job of toProcess) {
    if (state.active_run_ids.length >= config.workload.max_concurrent_runs) break;

    const start = Date.now();
    await markJobRunning(queue, job.job_id);
    state.active_run_ids.push(job.job_id);

    try {
      const result = await activeExecutor({
        objective: job.objective,
        category: job.category,
        job_id: job.job_id,
        seed: Date.now() % 10000,
      });

      validateFounderGate(result);

      if (result.awaiting_founder) {
        await markJobWaitingFounder(queue, job.job_id, result.run_id);
        jobs_waiting_founder++;
      }

      appendJobHistory({
        recorded_at: new Date().toISOString(),
        job_id: job.job_id,
        goal_id: job.goal_id,
        category: job.category,
        unified_run_id: result.run_id,
        status: result.awaiting_founder ? "waiting_founder" : "completed",
        awaiting_founder: result.awaiting_founder,
      }, options.persist !== false);

      appendSchedulerMemory({
        recorded_at: new Date().toISOString(),
        category: job.category,
        job_id: job.job_id,
        unified_run_id: result.run_id,
        status: result.status,
        duration_ms: Date.now() - start,
        production_speed_trend: result.pass ? "on_target" : "degraded",
        failure_rate_note: result.pass ? "success" : "failed",
      }, options.persist !== false);

      recordJobCompleted(state, result.pass);
      jobs_processed++;
    } catch (err) {
      await markJobFailed(queue, job.job_id, String(err));
      recordJobCompleted(state, false);
      alerts.push(`Job ${job.job_id} failed: ${String(err)}`);
    } finally {
      state.active_run_ids = state.active_run_ids.filter((id) => id !== job.job_id);
    }
  }

  state.last_tick_at = new Date().toISOString();
  saveSchedulerState(state, options.persist !== false);
  persistSchedulerReports({ state, config, persist: options.persist !== false });

  return { jobs_created, jobs_processed, jobs_waiting_founder, alerts };
}
