/**
 * DepartmentDirector — planning & coordination (Agent #180).
 * Never executes, spawns workers, calls providers, or publishes.
 */
import type { DepartmentDirectorContract } from "./DepartmentTypes.js";

export function defineDirector(input: {
  director_id: string;
  director_name: string;
  version?: string;
  manager_ids?: string[];
  description: string;
}): DepartmentDirectorContract {
  return {
    director_id: input.director_id,
    director_name: input.director_name,
    version: input.version ?? "1.0.0",
    owns: [
      "planning",
      "coordination",
      "assignment",
      "monitoring",
      "reporting",
    ],
    manager_ids: input.manager_ids ?? [],
    description: input.description,
    may_execute: false,
    may_spawn_workers: false,
    may_call_providers: false,
    may_publish: false,
  };
}

export class DepartmentDirector {
  readonly contract: DepartmentDirectorContract;

  constructor(contract: DepartmentDirectorContract) {
    this.contract = contract;
  }

  get id(): string {
    return this.contract.director_id;
  }

  /** V1: never executes. */
  canExecute(): false {
    return false;
  }
}
