/**
 * Department-level recovery — restart only the failed department.
 */
import type { DepartmentId, ProcessRecord, RecoveryEvent, RegisteredDepartment } from "./types.js";
import type { RuntimeConfiguration } from "./RuntimeConfiguration.js";
import { markFailed, markRecovering, markRunning } from "./RuntimeLifecycleManager.js";

export function recoverDepartment(input: {
  department_id: DepartmentId;
  processes: Map<DepartmentId, ProcessRecord>;
  departments: RegisteredDepartment[];
  config: RuntimeConfiguration;
  reason: string;
}): { process: ProcessRecord; event: RecoveryEvent } {
  const at = new Date().toISOString();
  const current = input.processes.get(input.department_id);
  const dept = input.departments.find((d) => d.id === input.department_id);

  if (!current) {
    const event: RecoveryEvent = {
      at,
      department_id: input.department_id,
      action: "escalate",
      reason: "Process not registered",
      success: false,
    };
    return {
      process: {
        id: input.department_id,
        state: "FAILED",
        started_at: null,
        stopped_at: at,
        restart_count: 0,
        last_error: "not registered",
        last_health: "failed",
        uptime_ms: 0,
      },
      event,
    };
  }

  if (current.restart_count >= input.config.max_restarts_per_department) {
    const failed = markFailed(current, "Max restarts exceeded");
    input.processes.set(input.department_id, failed);
    return {
      process: failed,
      event: {
        at,
        department_id: input.department_id,
        action: "escalate",
        reason: `Max restarts (${input.config.max_restarts_per_department}) exceeded — ${input.reason}`,
        success: false,
      },
    };
  }

  if (!dept?.available) {
    const failed = markFailed(current, "Module unavailable");
    input.processes.set(input.department_id, failed);
    return {
      process: failed,
      event: {
        at,
        department_id: input.department_id,
        action: "escalate",
        reason: `Module missing — ${input.reason}`,
        success: false,
      },
    };
  }

  let next = markRecovering(current);
  next = markRunning(next, at);
  input.processes.set(input.department_id, next);

  return {
    process: next,
    event: {
      at,
      department_id: input.department_id,
      action: "restart_department",
      reason: input.reason,
      success: true,
    },
  };
}

export function recoverFailedDepartments(input: {
  processes: Map<DepartmentId, ProcessRecord>;
  departments: RegisteredDepartment[];
  config: RuntimeConfiguration;
}): RecoveryEvent[] {
  const events: RecoveryEvent[] = [];
  for (const proc of input.processes.values()) {
    if (proc.state !== "FAILED") continue;
    const result = recoverDepartment({
      department_id: proc.id,
      processes: input.processes,
      departments: input.departments,
      config: input.config,
      reason: proc.last_error ?? "failed health check",
    });
    events.push(result.event);
  }
  return events;
}
