import type { QueueManager } from "../queue/QueueManager.js";
import type { PlanId } from "../shared/types.js";
import type { ProgressSnapshot } from "./types.js";

export class ProgressTracker {
  private readonly queue: QueueManager;

  constructor(queue: QueueManager) {
    this.queue = queue;
  }

  async snapshot(planId?: PlanId): Promise<ProgressSnapshot> {
    const all = await this.queue.listJobs();
    const jobs = planId ? all.filter((j) => j.metadata?.plan_id === planId) : all;

    let queued = 0;
    let running = 0;
    let completed = 0;
    let failed = 0;
    let blocked = 0;

    for (const job of jobs) {
      switch (job.status) {
        case "QUEUED":
          queued++;
          break;
        case "PLANNING":
        case "RUNNING":
          running++;
          break;
        case "WAITING_QA":
          blocked++;
          break;
        case "COMPLETED":
          completed++;
          break;
        case "FAILED":
        case "CANCELLED":
          failed++;
          break;
        default:
          break;
      }
    }

    const total = jobs.length;
    const overall_percent = total === 0 ? 0 : Math.round((completed / total) * 100);

    return {
      plan_id: planId ?? null,
      overall_percent,
      total_jobs: total,
      queued,
      running,
      completed,
      failed,
      blocked,
      updated_at: new Date().toISOString(),
    };
  }
}
