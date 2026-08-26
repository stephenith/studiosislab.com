/**
 * WorkerSession — metadata only (Agent #182).
 * Owned by Execution Controller (future). Never activated.
 */
import { randomUUID } from "node:crypto";
import type { WorkerSessionContract } from "./WorkerRuntimeTypes.js";
import {
  WORKER_RUNTIME_SAFETY_FLAGS,
  WORKER_SESSION_SCHEMA_VERSION,
} from "./WorkerRuntimeTypes.js";

export function createWorkerSession(input: {
  department_id: string;
  worker_id: string;
  mission_id: string;
  assignment_id?: string | null;
  runtime_plan_id?: string | null;
  runtime_release_id?: string | null;
  system_readiness_id?: string | null;
  execution_controller_id?: string | null;
  worker_runtime_id?: string | null;
  notes?: string[];
  fixture?: boolean;
  session_id?: string;
  created_at?: string;
}): WorkerSessionContract {
  const now = new Date().toISOString();
  return {
    schema_version: WORKER_SESSION_SCHEMA_VERSION,
    session_id:
      input.session_id ??
      `ws-${now.slice(0, 10).replace(/-/g, "")}-${randomUUID().slice(0, 8)}`,
    assignment_id: input.assignment_id ?? null,
    department_id: input.department_id,
    worker_id: input.worker_id,
    mission_id: input.mission_id,
    runtime_plan_id: input.runtime_plan_id ?? null,
    runtime_release_id: input.runtime_release_id ?? null,
    system_readiness_id: input.system_readiness_id ?? null,
    execution_controller_id: input.execution_controller_id ?? null,
    worker_runtime_id: input.worker_runtime_id ?? null,
    activated: false,
    safety_flags: WORKER_RUNTIME_SAFETY_FLAGS,
    created_at: input.created_at ?? now,
    updated_at: now,
    notes: input.notes ?? [
      "Worker session metadata · Execution Controller owns sessions (future) · not activated",
    ],
    fixture: Boolean(input.fixture),
  };
}

export class WorkerSession {
  readonly contract: WorkerSessionContract;

  constructor(contract: WorkerSessionContract) {
    this.contract = contract;
  }

  get id(): string {
    return this.contract.session_id;
  }

  isActivated(): false {
    return false;
  }
}
