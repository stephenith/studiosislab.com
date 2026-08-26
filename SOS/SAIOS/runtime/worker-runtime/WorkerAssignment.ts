/**
 * WorkerAssignment — metadata only (Agent #182).
 */
import { randomUUID } from "node:crypto";
import { sha256Canonical } from "../../platform/checksums/index.js";
import type { WorkerAssignmentContract } from "./WorkerRuntimeTypes.js";
import {
  WORKER_ASSIGNMENT_SCHEMA_VERSION,
  WORKER_RUNTIME_SAFETY_FLAGS,
} from "./WorkerRuntimeTypes.js";

export function computeAssignmentChecksum(
  record: Omit<WorkerAssignmentContract, "assignment_checksum"> & {
    assignment_checksum: string;
  },
): string {
  const { assignment_checksum: _a, ...rest } = record;
  return sha256Canonical(rest);
}

export function createWorkerAssignment(input: {
  worker_id: string;
  department_id: string;
  mission_id: string;
  director_id?: string | null;
  manager_id?: string | null;
  priority?: WorkerAssignmentContract["priority"];
  dependency_order?: number;
  estimated_start?: string | null;
  estimated_finish?: string | null;
  retry_policy_reference?: string | null;
  rollback_reference?: string | null;
  notes?: string[];
  fixture?: boolean;
  assignment_id?: string;
  created_at?: string;
}): WorkerAssignmentContract {
  const now = new Date().toISOString();
  const draft: WorkerAssignmentContract = {
    schema_version: WORKER_ASSIGNMENT_SCHEMA_VERSION,
    assignment_id:
      input.assignment_id ??
      `wa-${now.slice(0, 10).replace(/-/g, "")}-${randomUUID().slice(0, 8)}`,
    director_id: input.director_id ?? null,
    manager_id: input.manager_id ?? null,
    worker_id: input.worker_id,
    department_id: input.department_id,
    mission_id: input.mission_id,
    priority: input.priority ?? "normal",
    dependency_order: input.dependency_order ?? 0,
    estimated_start: input.estimated_start ?? null,
    estimated_finish: input.estimated_finish ?? null,
    retry_policy_reference: input.retry_policy_reference ?? null,
    rollback_reference: input.rollback_reference ?? null,
    assignment_checksum: "",
    safety_flags: WORKER_RUNTIME_SAFETY_FLAGS,
    created_at: input.created_at ?? now,
    updated_at: now,
    notes: input.notes ?? ["Assignment metadata only — Agent #182"],
    fixture: Boolean(input.fixture),
  };
  return {
    ...draft,
    assignment_checksum: computeAssignmentChecksum(draft),
  };
}

export class WorkerAssignment {
  readonly contract: WorkerAssignmentContract;

  constructor(contract: WorkerAssignmentContract) {
    this.contract = contract;
  }

  get id(): string {
    return this.contract.assignment_id;
  }
}
