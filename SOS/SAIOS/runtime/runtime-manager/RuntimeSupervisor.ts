/**
 * Supervises department processes in dependency order (in-process simulation).
 * Does not spawn OS processes or modify departments.
 */
import { markFailed, markRunning, markStarting, markStopped, refreshUptime } from "./RuntimeLifecycleManager.js";
import type { DepartmentId, ProcessRecord, RegisteredDepartment, RuntimeLifecycleState } from "./types.js";

export type SupervisorResult = {
  status: RuntimeLifecycleState;
  processes: ProcessRecord[];
  started: DepartmentId[];
  failed: DepartmentId[];
};

export function startAllInOrder(input: {
  startup_order: DepartmentId[];
  departments: RegisteredDepartment[];
  processes: Map<DepartmentId, ProcessRecord>;
}): SupervisorResult {
  const at = new Date().toISOString();
  const started: DepartmentId[] = [];
  const failed: DepartmentId[] = [];
  const byDept = new Map(input.departments.map((d) => [d.id, d]));

  for (const id of input.startup_order) {
    const proc = input.processes.get(id);
    const dept = byDept.get(id);
    if (!proc || !dept) continue;

    let next = markStarting(proc, at);
    input.processes.set(id, next);

    if (!dept.available) {
      next = markFailed(next, `Module unavailable: ${dept.module_path}`);
      input.processes.set(id, next);
      failed.push(id);
      continue;
    }

    // Register-only runtime: treat available departments as successfully supervised.
    next = markRunning(next, at);
    input.processes.set(id, next);
    started.push(id);
  }

  const status: RuntimeLifecycleState =
    failed.length === 0 ? "RUNNING" : started.length === 0 ? "FAILED" : "RUNNING";

  return {
    status,
    processes: refreshUptime(input.processes, at),
    started,
    failed,
  };
}

export function stopAll(input: {
  processes: Map<DepartmentId, ProcessRecord>;
}): ProcessRecord[] {
  const at = new Date().toISOString();
  for (const [id, proc] of input.processes) {
    input.processes.set(id, markStopped(proc, at));
  }
  return [...input.processes.values()];
}
