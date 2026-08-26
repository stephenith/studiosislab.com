/**
 * DepartmentValidator — contract validation (Agent #180).
 */
import { rejectForbiddenKeys } from "../checksums/index.js";
import type {
  DepartmentContract,
  DepartmentValidationIssue,
  DepartmentValidationResult,
} from "./DepartmentTypes.js";

export const DEPARTMENT_FORBIDDEN_KEYS = [
  "execute",
  "dispatch",
  "scheduler",
  "enqueue",
  "queue_insert",
  "spawn_worker",
  "worker_spawn",
  "provider",
  "publish",
  "enable_live",
  "activate_bridge",
  "call_model",
] as const;

export function rejectForbiddenDepartmentPayload(
  payload: Record<string, unknown>,
): DepartmentValidationIssue | null {
  return rejectForbiddenKeys(payload, DEPARTMENT_FORBIDDEN_KEYS, {
    messageForKey: (key) => `Field '${key}' is forbidden on department SDK`,
  });
}

export function validateDepartment(
  dept: DepartmentContract | null,
): DepartmentValidationResult {
  const errors: DepartmentValidationIssue[] = [];

  if (!dept) {
    return {
      ok: false,
      errors: [
        {
          code: "DEPARTMENT_MISSING",
          message: "Department contract missing",
        },
      ],
    };
  }

  const forbidden = rejectForbiddenDepartmentPayload(
    dept as unknown as Record<string, unknown>,
  );
  if (forbidden) errors.push(forbidden);

  if (!dept.department_id?.trim()) {
    errors.push({
      code: "MISSING_DEPARTMENT_ID",
      message: "department_id required",
      field: "department_id",
    });
  }
  if (!dept.department_name?.trim()) {
    errors.push({
      code: "MISSING_DEPARTMENT_NAME",
      message: "department_name required",
      field: "department_name",
    });
  }
  if (!dept.director?.director_id) {
    errors.push({
      code: "MISSING_DIRECTOR",
      message: "director required",
      field: "director",
    });
  }

  if (dept.director) {
    if (dept.director.may_execute !== false) {
      errors.push({
        code: "DIRECTOR_MAY_EXECUTE",
        message: "Director must never execute",
        field: "director.may_execute",
      });
    }
    if (dept.director.may_spawn_workers !== false) {
      errors.push({
        code: "DIRECTOR_MAY_SPAWN",
        message: "Director must never spawn workers",
        field: "director.may_spawn_workers",
      });
    }
    if (dept.director.may_call_providers !== false) {
      errors.push({
        code: "DIRECTOR_MAY_PROVIDERS",
        message: "Director must never call providers",
        field: "director.may_call_providers",
      });
    }
    if (dept.director.may_publish !== false) {
      errors.push({
        code: "DIRECTOR_MAY_PUBLISH",
        message: "Director must never publish",
        field: "director.may_publish",
      });
    }
  }

  for (const m of dept.managers ?? []) {
    if (m.may_execute !== false) {
      errors.push({
        code: "MANAGER_MAY_EXECUTE",
        message: `Manager ${m.manager_id} must never execute`,
        field: "managers",
      });
    }
    for (const wid of m.worker_ids) {
      if (!dept.workers.some((w) => w.worker_id === wid)) {
        errors.push({
          code: "MANAGER_UNKNOWN_WORKER",
          message: `Manager ${m.manager_id} references unknown worker ${wid}`,
          field: "managers.worker_ids",
        });
      }
    }
  }

  for (const mid of dept.director?.manager_ids ?? []) {
    if (!dept.managers.some((m) => m.manager_id === mid)) {
      errors.push({
        code: "DIRECTOR_UNKNOWN_MANAGER",
        message: `Director references unknown manager ${mid}`,
        field: "director.manager_ids",
      });
    }
  }

  for (const w of dept.workers ?? []) {
    if (w.may_execute !== false || w.may_call_providers !== false) {
      errors.push({
        code: "WORKER_UNSAFE",
        message: `Worker ${w.worker_id} must not execute or call providers`,
        field: "workers",
      });
    }
  }

  for (const c of dept.capabilities ?? []) {
    if (
      c.provider_independent !== true ||
      c.may_call_providers !== false ||
      c.may_call_brain_router !== false
    ) {
      errors.push({
        code: "CAPABILITY_UNSAFE",
        message: `Capability ${c.capability_id} must remain provider-independent`,
        field: "capabilities",
      });
    }
  }

  if (dept.execution_policy?.may_execute !== false) {
    errors.push({
      code: "EXECUTION_POLICY_UNLOCKED",
      message: "execution_policy.may_execute must be false",
      field: "execution_policy",
    });
  }
  if (dept.publishing_policy?.may_publish !== false) {
    errors.push({
      code: "PUBLISHING_POLICY_UNLOCKED",
      message: "publishing_policy.may_publish must be false",
      field: "publishing_policy",
    });
  }
  if (dept.safety_flags?.execution_allowed !== false) {
    errors.push({
      code: "SAFETY_EXECUTION",
      message: "safety_flags.execution_allowed must be false",
      field: "safety_flags",
    });
  }
  if (dept.safety_flags?.live_enabled !== false) {
    errors.push({
      code: "SAFETY_LIVE",
      message: "safety_flags.live_enabled must be false",
      field: "safety_flags",
    });
  }

  return { ok: errors.length === 0, errors };
}
