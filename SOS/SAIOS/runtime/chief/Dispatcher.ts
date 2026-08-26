import { comparePriority } from "../queue/QueueManager.js";
import type { RegistryManager } from "../registry/RegistryManager.js";
import type { SaiosJob } from "../queue/types.js";
import type { SaiosWorker } from "../registry/types.js";
import type { ExecutionPlan, WorkerAssignment } from "./types.js";

function workerPriorityScore(worker: SaiosWorker): number {
  const meta = worker.metadata?.priority as string | undefined;
  if (meta === "P0") return 0;
  if (meta === "P1") return 1;
  if (meta === "P2") return 2;
  if (meta === "P3") return 3;
  return 4;
}

function sortWorkersDeterministic(workers: SaiosWorker[]): SaiosWorker[] {
  return [...workers].sort((a, b) => {
    const pri = workerPriorityScore(a) - workerPriorityScore(b);
    if (pri !== 0) return pri;
    return a.id.localeCompare(b.id);
  });
}

function requiredCapability(job: SaiosJob): string {
  const cap = job.metadata?.required_capability;
  return typeof cap === "string" ? cap : "implement";
}

function dependenciesSatisfied(job: SaiosJob, jobsById: Map<string, SaiosJob>): boolean {
  for (const depId of job.dependencies) {
    const dep = jobsById.get(depId);
    if (!dep || dep.status !== "COMPLETED") return false;
  }
  return true;
}

function selectAssignmentsFromCandidates(
  candidates: SaiosJob[],
  idle: SaiosWorker[],
): WorkerAssignment[] {
  const available = new Map<string, SaiosWorker[]>();

  for (const worker of idle) {
    for (const cap of worker.capabilities) {
      const list = available.get(cap) ?? [];
      list.push(worker);
      available.set(cap, list);
    }
  }

  for (const [cap, list] of available) {
    available.set(cap, sortWorkersDeterministic(list));
  }

  const assignments: WorkerAssignment[] = [];
  const assignedWorkerIds = new Set<string>();

  for (const job of candidates) {
    const cap = requiredCapability(job);
    const pool = (available.get(cap) ?? []).filter((w) => !assignedWorkerIds.has(w.id));
    if (pool.length === 0) continue;

    const worker = pool[0]!;
    assignedWorkerIds.add(worker.id);
    assignments.push({
      job_id: job.id,
      worker_id: worker.id,
      required_capability: cap,
      priority: job.priority,
      step: typeof job.metadata?.step === "number" ? job.metadata.step : 0,
    });
  }

  return assignments;
}

export class Dispatcher {
  private readonly registry: RegistryManager;

  constructor(registry: RegistryManager) {
    this.registry = registry;
  }

  /**
   * Choose workers ONLY from RegistryManager.listIdleWorkers().
   * Match capabilities, priority, and availability (idle pool).
   */
  async selectWorkers(plan: ExecutionPlan, jobs: SaiosJob[]): Promise<WorkerAssignment[]> {
    const idle = await this.registry.listIdleWorkers();
    const planJobIds = new Set(
      jobs.filter((j) => j.metadata?.plan_id === plan.id).map((j) => j.id),
    );
    const jobsById = new Map(jobs.map((j) => [j.id, j]));
    const candidates = jobs
      .filter(
        (j) =>
          planJobIds.has(j.id) &&
          !j.assigned_worker &&
          j.status === "QUEUED" &&
          dependenciesSatisfied(j, jobsById),
      )
      .sort((a, b) => {
        const pri = comparePriority(a.priority, b.priority);
        if (pri !== 0) return pri;
        const stepA = typeof a.metadata?.step === "number" ? a.metadata.step : 0;
        const stepB = typeof b.metadata?.step === "number" ? b.metadata.step : 0;
        return stepA - stepB;
      });

    return selectAssignmentsFromCandidates(candidates, idle);
  }

  /**
   * Select workers for any queued, unassigned jobs (runtime loop scheduling).
   */
  async selectWorkersForJobs(jobs: SaiosJob[]): Promise<WorkerAssignment[]> {
    const idle = await this.registry.listIdleWorkers();
    const jobsById = new Map(jobs.map((j) => [j.id, j]));
    const candidates = jobs
      .filter(
        (j) =>
          !j.assigned_worker &&
          j.status === "QUEUED" &&
          dependenciesSatisfied(j, jobsById),
      )
      .sort((a, b) => {
        const pri = comparePriority(a.priority, b.priority);
        if (pri !== 0) return pri;
        const stepA = typeof a.metadata?.step === "number" ? a.metadata.step : 0;
        const stepB = typeof b.metadata?.step === "number" ? b.metadata.step : 0;
        return stepA - stepB;
      });

    return selectAssignmentsFromCandidates(candidates, idle);
  }
}
