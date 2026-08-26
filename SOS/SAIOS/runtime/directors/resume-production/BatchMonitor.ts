/**
 * Batch monitor — track active, completed, failed, ETA, queue.
 */
import type { BatchMetrics, BatchPlan, ResumeJob } from "./types.js";
import type { SchedulerState } from "./BatchScheduler.js";

export function computeBatchMetrics(
  plan: BatchPlan,
  state: SchedulerState,
  extras: {
    cursor_failures: number;
    learning_updates: number;
    avg_job_ms: number;
  },
): BatchMetrics {
  const completed = state.completed.length;
  const failed = state.failed.length;
  const active = state.active.size;
  const remaining = state.queue.length + active;
  const total = plan.size;
  const terminal = completed + failed;
  const success_rate = terminal > 0 ? Math.round((completed / terminal) * 1000) / 10 : 0;

  const approved = state.completed.filter((j) => j.founder_approved).length;
  const approval_rate =
    completed > 0 ? Math.round((approved / completed) * 1000) / 10 : 0;

  const research_time_ms = sumField(state.completed, "research_ms");
  const qa_time_ms = sumField(state.completed, "qa_ms");
  const eta_ms = remaining > 0 ? Math.round(extras.avg_job_ms * remaining) : 0;

  return {
    batch_id: plan.batch_id,
    current_batch_size: total,
    completed,
    remaining,
    failed,
    active,
    success_rate,
    average_time_ms: extras.avg_job_ms,
    cursor_failures: extras.cursor_failures,
    research_time_ms,
    qa_time_ms,
    approval_rate,
    learning_updates: extras.learning_updates,
    eta_ms,
    queue_depth: state.queue.length + active,
  };
}

function sumField(jobs: ResumeJob[], field: "research_ms" | "qa_ms" | "worker_ms"): number {
  return jobs.reduce((acc, j) => acc + (j[field] ?? 0), 0);
}

export function snapshotJobs(plan: BatchPlan): ResumeJob[] {
  return [...plan.jobs];
}
