/**
 * WorkerRuntimeValidator — Agent #182.
 */
import { rejectForbiddenKeys } from "../../platform/checksums/index.js";
import type {
  WorkerAssignmentContract,
  WorkerRuntimeContract,
  WorkerRuntimeValidationIssue,
  WorkerRuntimeValidationResult,
  WorkerSessionContract,
} from "./WorkerRuntimeTypes.js";
import { computeWorkerRuntimeChecksum } from "./WorkerRuntime.js";
import { computeAssignmentChecksum } from "./WorkerAssignment.js";

export const WORKER_RUNTIME_FORBIDDEN_KEYS = [
  "execute",
  "dispatch",
  "scheduler",
  "enqueue",
  "queue_insert",
  "spawn",
  "spawn_worker",
  "worker_spawn",
  "child_process",
  "fork",
  "provider",
  "publish",
  "enable_live",
] as const;

export function rejectForbiddenWorkerRuntimePayload(
  payload: Record<string, unknown>,
): WorkerRuntimeValidationIssue | null {
  return rejectForbiddenKeys(payload, WORKER_RUNTIME_FORBIDDEN_KEYS, {
    messageForKey: (key) =>
      `Field '${key}' is forbidden on worker runtime`,
  });
}

export function validateWorkerRuntime(
  runtime: WorkerRuntimeContract | null,
): WorkerRuntimeValidationResult {
  const errors: WorkerRuntimeValidationIssue[] = [];
  if (!runtime) {
    return {
      ok: false,
      errors: [{ code: "RUNTIME_MISSING", message: "Worker runtime missing" }],
    };
  }

  const forbidden = rejectForbiddenWorkerRuntimePayload(
    runtime as unknown as Record<string, unknown>,
  );
  if (forbidden) errors.push(forbidden);

  if (!runtime.worker_runtime_id?.trim()) {
    errors.push({
      code: "MISSING_RUNTIME_ID",
      message: "worker_runtime_id required",
      field: "worker_runtime_id",
    });
  }
  if (!runtime.worker_id?.trim()) {
    errors.push({
      code: "MISSING_WORKER_ID",
      message: "worker_id required",
      field: "worker_id",
    });
  }
  if (!runtime.department_id?.trim()) {
    errors.push({
      code: "MISSING_DEPARTMENT",
      message: "department_id required",
      field: "department_id",
    });
  }
  if (!runtime.mission_id?.trim()) {
    errors.push({
      code: "MISSING_MISSION",
      message: "mission_id required",
      field: "mission_id",
    });
  }
  if (runtime.schema_version !== "worker-runtime-1.0.0") {
    errors.push({
      code: "BAD_SCHEMA",
      message: "schema must be worker-runtime-1.0.0",
      field: "schema_version",
    });
  }
  if (runtime.safety_flags.worker_spawn_allowed !== false) {
    errors.push({
      code: "SPAWN_UNLOCKED",
      message: "worker_spawn_allowed must be false",
      field: "safety_flags",
    });
  }
  if (runtime.safety_flags.execution_allowed !== false) {
    errors.push({
      code: "EXECUTION_UNLOCKED",
      message: "execution_allowed must be false",
      field: "safety_flags",
    });
  }
  if (runtime.safety_flags.live_enabled !== false) {
    errors.push({
      code: "LIVE_UNLOCKED",
      message: "live_enabled must be false",
      field: "safety_flags",
    });
  }

  const expected = computeWorkerRuntimeChecksum({
    ...runtime,
    checksums: {
      ...runtime.checksums,
      runtime_checksum: "",
    },
  });
  if (runtime.checksums.runtime_checksum !== expected) {
    errors.push({
      code: "RUNTIME_CHECKSUM_INVALID",
      message: "runtime checksum mismatch",
      field: "checksums",
    });
  }

  return { ok: errors.length === 0, errors };
}

export function validateWorkerAssignment(
  assignment: WorkerAssignmentContract | null,
): WorkerRuntimeValidationResult {
  const errors: WorkerRuntimeValidationIssue[] = [];
  if (!assignment) {
    return {
      ok: false,
      errors: [{ code: "ASSIGNMENT_MISSING", message: "Assignment missing" }],
    };
  }
  const forbidden = rejectForbiddenWorkerRuntimePayload(
    assignment as unknown as Record<string, unknown>,
  );
  if (forbidden) errors.push(forbidden);
  if (!assignment.worker_id?.trim()) {
    errors.push({
      code: "MISSING_WORKER_ID",
      message: "worker_id required",
      field: "worker_id",
    });
  }
  const expected = computeAssignmentChecksum({
    ...assignment,
    assignment_checksum: "",
  });
  if (assignment.assignment_checksum !== expected) {
    errors.push({
      code: "ASSIGNMENT_CHECKSUM_INVALID",
      message: "assignment checksum mismatch",
      field: "assignment_checksum",
    });
  }
  return { ok: errors.length === 0, errors };
}

export function validateWorkerSession(
  session: WorkerSessionContract | null,
): WorkerRuntimeValidationResult {
  const errors: WorkerRuntimeValidationIssue[] = [];
  if (!session) {
    return {
      ok: false,
      errors: [{ code: "SESSION_MISSING", message: "Session missing" }],
    };
  }
  if (session.activated !== false) {
    errors.push({
      code: "SESSION_ACTIVATED",
      message: "session must not be activated",
      field: "activated",
    });
  }
  if (session.safety_flags.worker_spawn_allowed !== false) {
    errors.push({
      code: "SPAWN_UNLOCKED",
      message: "worker_spawn_allowed must be false",
      field: "safety_flags",
    });
  }
  return { ok: errors.length === 0, errors };
}
