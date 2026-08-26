import type { QueueManager } from "./queue/QueueManager.js";
import type { RegistryManager } from "./registry/RegistryManager.js";
import type { RuntimeHeartbeatSnapshot, RuntimeStatus } from "./runtime-types.js";

export class RuntimeHeartbeat {
  private readonly startedAt: string;
  private status: RuntimeStatus = "starting";
  private cycleCount = 0;
  private lastCycleAt: string | null = null;

  constructor(startedAt?: string) {
    this.startedAt = startedAt ?? new Date().toISOString();
  }

  setStatus(status: RuntimeStatus): void {
    this.status = status;
  }

  recordCycle(): void {
    this.cycleCount++;
    this.lastCycleAt = new Date().toISOString();
  }

  async snapshot(queue: QueueManager, registry: RegistryManager): Promise<RuntimeHeartbeatSnapshot> {
    const jobs = await queue.listJobs();
    const workers = await registry.listWorkers();

    const jobs_completed = jobs.filter((j) => j.status === "COMPLETED").length;
    const jobs_running = jobs.filter(
      (j) => j.status === "RUNNING" || j.status === "PLANNING" || j.status === "WAITING_QA",
    ).length;
    const jobs_queued = jobs.filter((j) => j.status === "QUEUED").length;

    const workers_online = workers.filter(
      (w) => w.status === "IDLE" || w.status === "BUSY" || w.status === "PAUSED",
    ).length;
    const workers_busy = workers.filter((w) => w.status === "BUSY").length;

    const uptime_ms = Date.now() - new Date(this.startedAt).getTime();

    return {
      status: this.status,
      started_at: this.startedAt,
      uptime_ms,
      jobs_completed,
      jobs_running,
      jobs_queued,
      workers_online,
      workers_busy,
      last_cycle_at: this.lastCycleAt,
      cycle_count: this.cycleCount,
    };
  }
}
