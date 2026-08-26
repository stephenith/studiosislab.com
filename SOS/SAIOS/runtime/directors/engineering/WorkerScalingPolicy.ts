import type { FactoryWorker } from "../../workers/WorkerDefinition.js";
import type { CapacityEstimate } from "./CapacityPlanner.js";
import type { WorkloadSnapshot } from "./WorkloadAnalyzer.js";

export type ScalingActionType = "create" | "retire" | "pause" | "resume";

export type ScalingAction = {
  type: ScalingActionType;
  worker_id?: string;
  worker_type?: string;
  reason: string;
};

export type WorkerScalingPolicyConfig = {
  max_temporary_workers: number;
  min_permanent_workers: number;
  failure_retire_threshold: number;
  surplus_pause_threshold: number;
  create_batch_size: number;
};

export const DEFAULT_SCALING_POLICY: WorkerScalingPolicyConfig = {
  max_temporary_workers: 50,
  min_permanent_workers: 1,
  failure_retire_threshold: 3,
  surplus_pause_threshold: 2,
  create_batch_size: 5,
};

function isTemporaryWorker(worker: FactoryWorker): boolean {
  return worker.metadata?.temporary === true || worker.metadata?.workforce_tier === "temporary";
}

function isBacklogScaledWorker(worker: FactoryWorker): boolean {
  return isTemporaryWorker(worker) && worker.metadata?.scaled_for_backlog === true;
}

function failureCount(worker: FactoryWorker): number {
  const count = worker.metadata?.failure_count;
  return typeof count === "number" ? count : 0;
}

/**
 * Scaling rules for dynamic workforce management.
 */
export class WorkerScalingPolicy {
  private readonly config: WorkerScalingPolicyConfig;

  constructor(config: Partial<WorkerScalingPolicyConfig> = {}) {
    this.config = { ...DEFAULT_SCALING_POLICY, ...config };
  }

  plan(snapshot: WorkloadSnapshot, capacity: CapacityEstimate): ScalingAction[] {
    const actions: ScalingAction[] = [];
    const activeWorkers = snapshot.workers.filter((w) => w.status !== "RETIRED");

    // Queue depth exceeds idle capacity → create temporary workers
    if (snapshot.queue_depth > snapshot.idle_workers && capacity.deficit > 0) {
      const existingTemporary = activeWorkers.filter((w) => isTemporaryWorker(w)).length;
      const room = Math.max(0, this.config.max_temporary_workers - existingTemporary);
      const toCreate = Math.min(
        capacity.deficit,
        this.config.create_batch_size,
        room,
        snapshot.queue_depth - snapshot.idle_workers,
      );
      for (let i = 0; i < toCreate; i++) {
        actions.push({
          type: "create",
          worker_type: capacity.recommended_worker_type,
          reason: `queue_depth(${snapshot.queue_depth}) > idle_workers(${snapshot.idle_workers})`,
        });
      }
    }

    // Repeated failures → retire
    for (const worker of activeWorkers) {
      if (failureCount(worker) >= this.config.failure_retire_threshold) {
        actions.push({
          type: "retire",
          worker_id: worker.worker_id,
          reason: `failure_count(${failureCount(worker)}) >= threshold(${this.config.failure_retire_threshold})`,
        });
      }
    }

    // Backlog with paused workers → resume
    if (snapshot.queue_depth > 0 && snapshot.paused_workers > 0 && snapshot.idle_workers < snapshot.queue_depth) {
      const paused = activeWorkers.filter((w) => w.status === "PAUSED");
      const resumeCount = Math.min(
        paused.length,
        snapshot.queue_depth - snapshot.idle_workers,
      );
      for (let i = 0; i < resumeCount; i++) {
        actions.push({
          type: "resume",
          worker_id: paused[i]!.worker_id,
          reason: `backlog(${snapshot.queue_depth}) needs paused worker resumed`,
        });
      }
    }

    // Empty queue → retire backlog-scaled temporary workers
    if (snapshot.queue_depth === 0 && snapshot.total_active_jobs === 0) {
      const scaledIdle = activeWorkers.filter(
        (w) =>
          isBacklogScaledWorker(w) &&
          w.status === "READY" &&
          !w.current_job,
      );
      for (const worker of scaledIdle) {
        actions.push({
          type: "retire",
          worker_id: worker.worker_id,
          reason: "queue empty — retire backlog-scaled temporary worker",
        });
      }
    }

    // Surplus idle temporary workers while queue is low → pause before retirement
    if (
      snapshot.queue_depth === 0 &&
      capacity.surplus >= this.config.surplus_pause_threshold
    ) {
      const idleTemporary = activeWorkers.filter(
        (w) =>
          isTemporaryWorker(w) &&
          !isBacklogScaledWorker(w) &&
          w.status === "READY" &&
          !w.current_job &&
          !actions.some((a) => a.type === "retire" && a.worker_id === w.worker_id),
      );
      const pauseCount = Math.min(
        idleTemporary.length,
        capacity.surplus - this.config.surplus_pause_threshold + 1,
      );
      for (let i = 0; i < pauseCount; i++) {
        actions.push({
          type: "pause",
          worker_id: idleTemporary[i]!.worker_id,
          reason: `surplus idle capacity (${capacity.surplus}) exceeds pause threshold`,
        });
      }
    }

    return actions;
  }
}
