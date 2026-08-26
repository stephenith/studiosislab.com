/**
 * Queue integration — wraps existing SAIOS QueueManager.
 */
import { join } from "node:path";
import { QueueManager } from "../queue/QueueManager.js";
import { SCHEDULER_ROOT } from "./SchedulerConfig.js";
import type { ProductionCategory, ProductionGoal, SchedulerJobRecord } from "./types.js";

export function createSchedulerQueue(): QueueManager {
  const jobsDir = join(SCHEDULER_ROOT, "queue", "jobs");
  const eventsFile = join(SCHEDULER_ROOT, "queue", "events.jsonl");
  return new QueueManager({ jobsDir, eventsFile });
}

export async function enqueueProductionJob(
  queue: QueueManager,
  input: { goal: ProductionGoal; objective: string; scheduler_job_id: string },
): Promise<SchedulerJobRecord> {
  const job = await queue.createJob({
    title: input.goal.name,
    description: input.objective,
    priority: input.goal.priority,
    creator: "autonomous-scheduler",
    metadata: {
      goal_id: input.goal.id,
      category: input.goal.category,
      scheduler_job_id: input.scheduler_job_id,
      awaiting_founder_gate: true,
      auto_publish: false,
    },
  });

  return {
    job_id: job.id,
    goal_id: input.goal.id,
    category: input.goal.category,
    objective: input.objective,
    unified_run_id: null,
    status: "queued",
    created_at: job.created_at,
    updated_at: job.updated_at,
    retry_count: 0,
    awaiting_founder: false,
    error: null,
  };
}

export async function markJobRunning(queue: QueueManager, jobId: string): Promise<void> {
  const job = await queue.loadJob(jobId);
  if (!job) return;
  if (job.status === "QUEUED") {
    await queue.updateStatus(jobId, { status: "PLANNING", note: "scheduler planning" });
    await queue.updateStatus(jobId, { status: "RUNNING", note: "unified production started" });
  }
}

export async function markJobWaitingFounder(queue: QueueManager, jobId: string, runId: string): Promise<void> {
  await queue.updateStatus(jobId, {
    status: "WAITING_QA",
    note: `awaiting founder approval — run ${runId}`,
  });
}

export async function markJobFailed(queue: QueueManager, jobId: string, reason: string): Promise<void> {
  const job = await queue.loadJob(jobId);
  if (!job) return;
  if (job.status === "QUEUED" || job.status === "PLANNING") {
    await queue.cancelJob(jobId, reason);
    return;
  }
  await queue.failJob(jobId, reason);
}

export async function pauseJob(queue: QueueManager, jobId: string): Promise<void> {
  await queue.cancelJob(jobId, "paused by scheduler");
}

export async function listQueuedSchedulerJobs(queue: QueueManager): Promise<SchedulerJobRecord[]> {
  const jobs = await queue.listQueuedJobs();
  return jobs.map((j) => ({
    job_id: j.id,
    goal_id: String(j.metadata.goal_id ?? ""),
    category: (j.metadata.category as ProductionCategory) ?? "ats",
    objective: j.description,
    unified_run_id: (j.metadata.unified_run_id as string) ?? null,
    status: "queued" as const,
    created_at: j.created_at,
    updated_at: j.updated_at,
    retry_count: Number(j.metadata.retry_count ?? 0),
    awaiting_founder: false,
    error: null,
  }));
}
