/**
 * Queue monitor — aggregated queue view.
 */
import { loadJobHistory, loadQueueJobs } from "./DataAggregator.js";

export function buildQueueMonitor() {
  const jobs = loadQueueJobs();
  const history = loadJobHistory()?.entries ?? [];

  const byStatus = (status: string) =>
    jobs.filter((j) => String(j.status).toUpperCase() === status.toUpperCase());

  const waitingFounder = history.filter((e) => e.awaiting_founder === true || e.status === "waiting_founder");

  return {
    updated_at: new Date().toISOString(),
    queued: byStatus("QUEUED").map(mapJob),
    running: jobs.filter((j) => ["RUNNING", "PLANNING"].includes(String(j.status))).map(mapJob),
    completed: byStatus("COMPLETED").map(mapJob),
    failed: byStatus("FAILED").map(mapJob),
    waiting_founder: waitingFounder.map((e) => ({
      job_id: e.job_id,
      category: e.category,
      unified_run_id: e.unified_run_id,
      status: e.status,
    })),
    cancelled: byStatus("CANCELLED").map(mapJob),
    totals: {
      queued: byStatus("QUEUED").length,
      running: jobs.filter((j) => j.status === "RUNNING").length,
      completed: byStatus("COMPLETED").length,
      failed: byStatus("FAILED").length,
      waiting_founder: waitingFounder.length,
      cancelled: byStatus("CANCELLED").length,
    },
  };
}

function mapJob(j: Record<string, unknown>) {
  const created = j.created_at ? new Date(String(j.created_at)).getTime() : 0;
  const completed = j.completed_at ? new Date(String(j.completed_at)).getTime() : Date.now();
  return {
    job_id: j.id,
    title: j.title,
    status: j.status,
    priority: j.priority,
    retry_count: (j.metadata as Record<string, unknown>)?.retry_count ?? 0,
    execution_time_ms: completed - created,
    objective: j.description,
  };
}
