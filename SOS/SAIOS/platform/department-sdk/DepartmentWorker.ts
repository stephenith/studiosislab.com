/**
 * DepartmentWorker — one deterministic responsibility (Agent #180).
 * Never executes, reasons, calls providers, or publishes.
 */
import type { DepartmentWorkerContract } from "./DepartmentTypes.js";

export function defineWorker(input: {
  worker_id: string;
  worker_type: string;
  version?: string;
  capabilities?: string[];
  inputs?: string[];
  outputs?: string[];
  dependencies?: string[];
  description: string;
}): DepartmentWorkerContract {
  return {
    worker_id: input.worker_id,
    worker_type: input.worker_type,
    version: input.version ?? "1.0.0",
    health: "declared",
    capabilities: input.capabilities ?? [],
    inputs: input.inputs ?? [],
    outputs: input.outputs ?? [],
    dependencies: input.dependencies ?? [],
    description: input.description,
    may_reason_directly: false,
    may_call_providers: false,
    may_publish: false,
    may_execute: false,
  };
}

export class DepartmentWorker {
  readonly contract: DepartmentWorkerContract;

  constructor(contract: DepartmentWorkerContract) {
    this.contract = contract;
  }

  get id(): string {
    return this.contract.worker_id;
  }

  /** V1: never executes. */
  canExecute(): false {
    return false;
  }
}
