import type { JobId } from "../../shared/types.js";
import type { QueueManager } from "../../queue/QueueManager.js";
import type { RegistryManager } from "../../registry/RegistryManager.js";
import { comparePriority } from "../../queue/QueueManager.js";
import { assertAllowedDirectorAction, getWorkerTypeById } from "./EngineeringPolicies.js";
import type {
  DelegationResult,
  EngineeringPlan,
  JobAssignment,
  WorkerRequestResult,
} from "./types.js";

async function dependenciesSatisfied(
  depKeys: string[],
  keyToJobId: Map<string, JobId>,
  queue: QueueManager,
): Promise<boolean> {
  for (const key of depKeys) {
    const jobId = keyToJobId.get(key);
    if (!jobId) return false;
    const job = await queue.loadJob(jobId);
    if (!job || job.status !== "COMPLETED") return false;
  }
  return true;
}

/**
 * Requests workers from Registry and assigns jobs through Queue.
 * Never executes work directly.
 */
export class EngineeringDelegator {
  private readonly queue: QueueManager;
  private readonly registry: RegistryManager;

  constructor(queue: QueueManager, registry: RegistryManager) {
    this.queue = queue;
    this.registry = registry;
  }

  async requestWorkers(plan: EngineeringPlan): Promise<WorkerRequestResult[]> {
    assertAllowedDirectorAction("orchestrate_workers");
    const results: WorkerRequestResult[] = [];

    for (const typeId of plan.worker_types) {
      const def = getWorkerTypeById(typeId);
      if (!def) continue;

      const existing = await this.registry.listByCapability(def.capability);
      const idle = existing.find((w) => w.status === "IDLE" && w.type === typeId);

      if (idle) {
        results.push({
          worker_type: typeId,
          worker_id: idle.id,
          requested: true,
          registered: false,
        });
        continue;
      }

      const worker = await this.registry.registerWorker({
        name: def.name,
        type: typeId,
        version: "1.0.0",
        capabilities: [def.capability],
        host: "engineering-director",
        runtime: "saios-engineering-v1",
        metadata: { director: "engineering", definition_only: true },
      });
      await this.registry.heartbeat(worker.id);
      results.push({
        worker_type: typeId,
        worker_id: worker.id,
        requested: true,
        registered: true,
      });
    }

    return results;
  }

  async submitJobs(plan: EngineeringPlan): Promise<JobId[]> {
    assertAllowedDirectorAction("submit_jobs");
    const keyToJobId = new Map<string, JobId>();
    const jobIds: JobId[] = [];

    const sorted = [...plan.tasks].sort((a, b) => a.step - b.step);

    for (const task of sorted) {
      const dependencies = (task.depends_on ?? [])
        .map((key) => keyToJobId.get(key))
        .filter((id): id is JobId => Boolean(id));

      const job = await this.queue.createJob({
        id: `JOB-${plan.id.replace(/^ENG-PLAN-/, "")}-${task.temp_key}`.replace(/[^a-zA-Z0-9_-]/g, "-"),
        title: task.title,
        description: task.description,
        priority: task.priority,
        creator: "engineering-director",
        dependencies,
        metadata: {
          engineering_plan_id: plan.id,
          temp_key: task.temp_key,
          worker_type: task.worker_type,
          required_capability: task.capability,
          step: task.step,
          director: "engineering",
        },
      });

      keyToJobId.set(task.temp_key, job.id);
      jobIds.push(job.id);
    }

    return jobIds;
  }

  async assignJobs(plan: EngineeringPlan, jobIds: JobId[]): Promise<JobAssignment[]> {
    assertAllowedDirectorAction("assign_jobs");
    const assignments: JobAssignment[] = [];
    const jobs = await Promise.all(jobIds.map((id) => this.queue.loadJob(id)));
    const validJobs = jobs.filter(Boolean) as NonNullable<(typeof jobs)[number]>[];

    const keyToJobId = new Map<string, JobId>();
    for (const job of validJobs) {
      const key = job.metadata?.temp_key;
      if (typeof key === "string") keyToJobId.set(key, job.id);
    }

    const sorted = [...validJobs].sort((a, b) => {
      const pri = comparePriority(a.priority, b.priority);
      if (pri !== 0) return pri;
      const stepA = typeof a.metadata?.step === "number" ? a.metadata.step : 0;
      const stepB = typeof b.metadata?.step === "number" ? b.metadata.step : 0;
      return stepA - stepB;
    });

    const assignedWorkers = new Set<string>();

    for (const job of sorted) {
      if (job.assigned_worker || job.status !== "QUEUED") continue;

      const depKeys = plan.tasks.find((t) => t.temp_key === job.metadata?.temp_key)?.depends_on ?? [];
      const depsOk = await dependenciesSatisfied(depKeys, keyToJobId, this.queue);
      if (!depsOk) continue;

      const workerType = String(job.metadata?.worker_type ?? "");
      const def = getWorkerTypeById(workerType);
      if (!def) continue;

      const pool = (await this.registry.listByCapability(def.capability)).filter(
        (w) => w.status === "IDLE" && w.type === workerType && !assignedWorkers.has(w.id),
      );
      if (pool.length === 0) continue;

      const worker = pool[0]!;
      assignedWorkers.add(worker.id);
      await this.queue.assignWorker(job.id, worker.id);
      await this.registry.assignJob(worker.id, job.id);

      assignments.push({
        task_key: String(job.metadata?.temp_key ?? job.id),
        job_id: job.id,
        worker_id: worker.id,
        worker_type: workerType,
      });
    }

    return assignments;
  }

  async delegate(plan: EngineeringPlan): Promise<DelegationResult> {
    const worker_requests = await this.requestWorkers(plan);
    const job_ids = await this.submitJobs(plan);
    const assignments = await this.assignJobs(plan, job_ids);

    return {
      plan_id: plan.id,
      worker_requests,
      job_ids,
      assignments,
    };
  }
}
