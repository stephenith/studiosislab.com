import type { QueueManager } from "../../queue/QueueManager.js";
import type { RegistryManager } from "../../registry/RegistryManager.js";
import type { Priority } from "../../shared/types.js";
import type { FactoryWorker } from "../../workers/WorkerDefinition.js";
import { registryStatusToFactory } from "../../workers/WorkerLifecycle.js";

export type WorkloadSnapshot = {
  evaluated_at: string;
  queue_depth: number;
  planning_jobs: number;
  running_jobs: number;
  total_active_jobs: number;
  idle_workers: number;
  busy_workers: number;
  paused_workers: number;
  failed_workers: number;
  temporary_workers: number;
  permanent_workers: number;
  total_workers: number;
  average_execution_ms: number;
  throughput_jobs_per_minute: number;
  priority_breakdown: Record<Priority, number>;
  capability_demand: Record<string, number>;
  workers: FactoryWorker[];
};

function isTemporaryWorker(worker: FactoryWorker): boolean {
  return worker.metadata?.temporary === true || worker.metadata?.workforce_tier === "temporary";
}

function priorityWeight(priority: Priority): number {
  switch (priority) {
    case "P0":
      return 4;
    case "P1":
      return 3;
    case "P2":
      return 2;
    case "P3":
      return 1;
    default:
      return 1;
  }
}

/**
 * Monitors queue depth, worker utilization, execution metrics, and failures.
 */
export class WorkloadAnalyzer {
  private readonly queue: QueueManager;
  private readonly registry: RegistryManager;

  constructor(queue: QueueManager, registry: RegistryManager) {
    this.queue = queue;
    this.registry = registry;
  }

  async snapshot(): Promise<WorkloadSnapshot> {
    const evaluatedAt = new Date().toISOString();
    const queued = await this.queue.listQueuedJobs();
    const planning = (await this.queue.listJobs({ status: "PLANNING" })).length;
    const running = (await this.queue.listRunningJobs()).length;
    const allJobs = await this.queue.listJobs();

    const registryWorkers = await this.registry.listWorkers();
    const workers: FactoryWorker[] = registryWorkers.map((w) => ({
      worker_id: w.id,
      worker_type: w.type,
      display_name: w.name,
      status: registryStatusToFactory(w.status),
      capabilities: [...w.capabilities],
      priority: (w.metadata?.priority as FactoryWorker["priority"] | undefined) ?? "P2",
      parent_director:
        typeof w.metadata?.parent_director === "string" ? w.metadata.parent_director : null,
      created_at: w.created_at,
      updated_at: w.updated_at,
      heartbeat: w.last_heartbeat,
      current_job: w.current_job,
      metadata: { ...w.metadata },
    }));

    const idleWorkers = workers.filter((w) => w.status === "READY").length;
    const busyWorkers = workers.filter((w) => w.status === "BUSY").length;
    const pausedWorkers = workers.filter((w) => w.status === "PAUSED").length;
    const failedWorkers = workers.filter((w) => w.status === "FAILED").length;
    const temporaryWorkers = workers.filter((w) => isTemporaryWorker(w) && w.status !== "RETIRED").length;
    const permanentWorkers = workers.filter((w) => !isTemporaryWorker(w) && w.status !== "RETIRED").length;

    const priorityBreakdown: Record<Priority, number> = { P0: 0, P1: 0, P2: 0, P3: 0 };
    const capabilityDemand: Record<string, number> = {};

    for (const job of queued) {
      priorityBreakdown[job.priority] = (priorityBreakdown[job.priority] ?? 0) + 1;
      const cap =
        typeof job.metadata?.required_capability === "string"
          ? job.metadata.required_capability
          : typeof job.metadata?.worker_type === "string"
            ? job.metadata.worker_type.replace(/-worker$/, "")
            : "general";
      capabilityDemand[cap] = (capabilityDemand[cap] ?? 0) + priorityWeight(job.priority);
    }

    const completed = allJobs.filter(
      (j) => j.status === "COMPLETED" && j.started_at && j.completed_at,
    );
    let averageExecutionMs = 0;
    if (completed.length > 0) {
      const totalMs = completed.reduce((sum, job) => {
        const duration =
          typeof job.metadata?.execution_duration_ms === "number"
            ? job.metadata.execution_duration_ms
            : new Date(job.completed_at!).getTime() - new Date(job.started_at!).getTime();
        return sum + Math.max(0, duration);
      }, 0);
      averageExecutionMs = Math.round(totalMs / completed.length);
    } else if (typeof workers[0]?.metadata?.default_execution_ms === "number") {
      averageExecutionMs = workers[0].metadata.default_execution_ms as number;
    } else {
      averageExecutionMs = 30_000;
    }

    const recentCompleted = completed.filter((j) => {
      if (!j.completed_at) return false;
      const ageMs = Date.now() - new Date(j.completed_at).getTime();
      return ageMs <= 10 * 60 * 1000;
    });
    const throughputJobsPerMinute =
      recentCompleted.length > 0
        ? Math.round((recentCompleted.length / 10) * 60 * 100) / 100
        : averageExecutionMs > 0
          ? Math.round((60_000 / averageExecutionMs) * 100) / 100
          : 0;

    return {
      evaluated_at: evaluatedAt,
      queue_depth: queued.length,
      planning_jobs: planning,
      running_jobs: running,
      total_active_jobs: queued.length + planning + running,
      idle_workers: idleWorkers,
      busy_workers: busyWorkers,
      paused_workers: pausedWorkers,
      failed_workers: failedWorkers,
      temporary_workers: temporaryWorkers,
      permanent_workers: permanentWorkers,
      total_workers: workers.filter((w) => w.status !== "RETIRED").length,
      average_execution_ms: averageExecutionMs,
      throughput_jobs_per_minute: throughputJobsPerMinute,
      priority_breakdown: priorityBreakdown,
      capability_demand: capabilityDemand,
      workers,
    };
  }
}
