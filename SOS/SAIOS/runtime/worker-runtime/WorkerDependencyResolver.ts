/**
 * WorkerDependencyResolver — dependency metadata only (Agent #182).
 * No scheduling.
 */
import type { WorkerDependencyEdge } from "./WorkerRuntimeTypes.js";

export type DependencyModel = {
  parent_workers: string[];
  child_workers: string[];
  blocking_workers: string[];
  parallel_workers: string[];
  optional_workers: string[];
  scheduled: false;
};

export class WorkerDependencyResolver {
  resolve(edges: WorkerDependencyEdge[]): DependencyModel {
    const pick = (kind: WorkerDependencyEdge["kind"]) =>
      edges.filter((e) => e.kind === kind).map((e) => e.worker_id);
    return {
      parent_workers: pick("parent"),
      child_workers: pick("child"),
      blocking_workers: pick("blocking"),
      parallel_workers: pick("parallel"),
      optional_workers: pick("optional"),
      scheduled: false,
    };
  }

  /** V1: never schedules. */
  canSchedule(): false {
    return false;
  }
}

export function createWorkerDependencyResolver(): WorkerDependencyResolver {
  return new WorkerDependencyResolver();
}
