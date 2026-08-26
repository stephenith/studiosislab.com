/**
 * Batch scheduler — distribute jobs to Resume Workers → Cursor Agent.
 */
import type { BatchPlan, ResumeJob } from "./types.js";
import { DIRECTOR_POLICIES } from "./ProductionPolicies.js";

export type SchedulerState = {
  queue: string[];
  active: Map<string, ResumeJob>;
  completed: ResumeJob[];
  failed: ResumeJob[];
};

export function createSchedulerState(plan: BatchPlan): SchedulerState {
  return {
    queue: plan.jobs.map((j) => j.job_id),
    active: new Map(),
    completed: [],
    failed: [],
  };
}

export function assignNextJob(
  plan: BatchPlan,
  state: SchedulerState,
): { job: ResumeJob | null; plan: BatchPlan } {
  if (state.queue.length === 0) return { job: null, plan };

  const jobId = state.queue.shift()!;
  const jobIndex = plan.jobs.findIndex((j) => j.job_id === jobId);
  if (jobIndex < 0) return { job: null, plan };

  const job = { ...plan.jobs[jobIndex]!, status: "assigned" as const, started_at: new Date().toISOString() };
  const jobs = [...plan.jobs];
  jobs[jobIndex] = job;
  state.active.set(job.job_id, job);

  return { job, plan: { ...plan, jobs } };
}

export function updateJobInPlan(plan: BatchPlan, updated: ResumeJob): BatchPlan {
  const jobs = plan.jobs.map((j) => (j.job_id === updated.job_id ? updated : j));
  return { ...plan, jobs };
}

export function completeJob(
  plan: BatchPlan,
  state: SchedulerState,
  job: ResumeJob,
): BatchPlan {
  state.active.delete(job.job_id);
  const finished = { ...job, status: "completed" as const, completed_at: new Date().toISOString() };
  state.completed.push(finished);
  return updateJobInPlan(plan, finished);
}

export function failJob(
  plan: BatchPlan,
  state: SchedulerState,
  job: ResumeJob,
  error: string,
): { plan: BatchPlan; requeued: boolean } {
  state.active.delete(job.job_id);
  const retried = job.retry_count + 1;
  const canRetry = retried <= DIRECTOR_POLICIES.max_retries_per_job;

  if (canRetry) {
    const retryJob: ResumeJob = {
      ...job,
      retry_count: retried,
      status: "queued",
      error,
      started_at: undefined,
    };
    state.queue.push(job.job_id);
    return { plan: updateJobInPlan(plan, retryJob), requeued: true };
  }

  const failed = {
    ...job,
    retry_count: retried,
    status: "failed" as const,
    error,
    completed_at: new Date().toISOString(),
  };
  state.failed.push(failed);
  return { plan: updateJobInPlan(plan, failed), requeued: false };
}

export function getQueueDepth(state: SchedulerState): number {
  return state.queue.length + state.active.size;
}

export function getActiveCount(state: SchedulerState): number {
  return state.active.size;
}
