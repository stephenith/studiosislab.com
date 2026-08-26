import { existsSync } from "node:fs";
import { join } from "node:path";
import type { QueueManager } from "./queue/QueueManager.js";
import type { RegistryManager } from "./registry/RegistryManager.js";
import { resolveCursorPaths } from "./cursor/paths.js";

export type SupervisorIssue = {
  kind: "worker_failure" | "cursor_failure" | "queue_corruption" | "missing_report";
  message: string;
  job_id?: string;
  worker_id?: string;
};

export type SupervisorResult = {
  issues: SupervisorIssue[];
  retried_job_ids: string[];
};

export class RuntimeSupervisor {
  private readonly queue: QueueManager;
  private readonly registry: RegistryManager;
  private readonly reportsDir: string;

  constructor(
    queue: QueueManager,
    registry: RegistryManager,
    options?: { reportsDir?: string },
  ) {
    this.queue = queue;
    this.registry = registry;
    this.reportsDir = options?.reportsDir ?? resolveCursorPaths().reportsDir;
  }

  async inspect(): Promise<SupervisorResult> {
    const issues: SupervisorIssue[] = [];
    const retried: string[] = [];

    const jobs = await this.queue.listJobs();
    const workers = await this.registry.listWorkers();

    for (const worker of workers) {
      if (["ERROR", "OFFLINE", "RETIRED"].includes(worker.status) && worker.current_job) {
        issues.push({
          kind: "worker_failure",
          message: `Worker ${worker.id} in ${worker.status} still holds job ${worker.current_job}`,
          worker_id: worker.id,
          job_id: worker.current_job,
        });

        const job = await this.queue.loadJob(worker.current_job);
        if (job && job.status === "RUNNING") {
          try {
            await this.queue.failJob(worker.current_job, `worker ${worker.status}`);
            retried.push(worker.current_job);
          } catch {
            // terminal or invalid transition
          }
        }
      }
    }

    for (const job of jobs) {
      if (job.status === "FAILED") {
        issues.push({
          kind: "cursor_failure",
          message: job.metadata?.last_note
            ? String(job.metadata.last_note)
            : `Job ${job.id} failed`,
          job_id: job.id,
        });
      }

      if (job.status === "WAITING_QA" && !job.report_path) {
        issues.push({
          kind: "missing_report",
          message: `Job ${job.id} in WAITING_QA without report_path`,
          job_id: job.id,
        });
      }

      if (job.report_path && job.status !== "COMPLETED" && job.status !== "FAILED") {
        const abs = join(resolveCursorPaths().repoRoot, job.report_path);
        const safe = join(this.reportsDir, `${job.id.replace(/[^a-zA-Z0-9_-]/g, "_")}.json`);
        if (!existsSync(abs) && !existsSync(safe)) {
          issues.push({
            kind: "missing_report",
            message: `Report file missing for job ${job.id}`,
            job_id: job.id,
          });
        }
      }

      for (const depId of job.dependencies) {
        const dep = await this.queue.loadJob(depId);
        if (!dep) {
          issues.push({
            kind: "queue_corruption",
            message: `Job ${job.id} references missing dependency ${depId}`,
            job_id: job.id,
          });
        }
      }
    }

    return { issues, retried_job_ids: retried };
  }

  async releaseStaleBusyWorkers(): Promise<void> {
    const workers = await this.registry.listWorkers();
    for (const worker of workers) {
      if (worker.status !== "BUSY" || !worker.current_job) continue;
      const job = await this.queue.loadJob(worker.current_job);
      if (!job || job.status === "COMPLETED" || job.status === "FAILED" || job.status === "CANCELLED") {
        try {
          await this.registry.releaseJob(worker.id, "stale busy worker cleanup");
        } catch {
          // ignore
        }
      }
    }
  }
}
