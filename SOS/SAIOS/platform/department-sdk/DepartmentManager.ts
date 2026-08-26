/**
 * DepartmentManager — allocation & progress ownership (Agent #180).
 * Never executes work.
 */
import type { DepartmentManagerContract } from "./DepartmentTypes.js";

export function defineManager(input: {
  manager_id: string;
  manager_name: string;
  version?: string;
  worker_ids?: string[];
  description: string;
}): DepartmentManagerContract {
  return {
    manager_id: input.manager_id,
    manager_name: input.manager_name,
    version: input.version ?? "1.0.0",
    owns: [
      "worker_allocation",
      "worker_grouping",
      "batch_ownership",
      "progress_reporting",
      "retry_ownership",
    ],
    worker_ids: input.worker_ids ?? [],
    description: input.description,
    may_execute: false,
    may_spawn_workers: false,
  };
}

export class DepartmentManager {
  readonly contract: DepartmentManagerContract;

  constructor(contract: DepartmentManagerContract) {
    this.contract = contract;
  }

  get id(): string {
    return this.contract.manager_id;
  }

  /** V1: never executes. */
  canExecute(): false {
    return false;
  }
}
