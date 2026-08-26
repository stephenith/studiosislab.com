/**
 * DepartmentLifecycle — status transitions (Agent #180).
 * Execution remains impossible in every state.
 */
import {
  BaseLifecycleStateMachine,
  DEFAULT_EXECUTION_BLOCKED_TARGETS,
} from "../state-machine/BaseLifecycleStateMachine.js";
import type { DepartmentLifecycleStatus } from "./DepartmentTypes.js";

/**
 * REGISTERED → VALIDATED → READY → ACTIVE → PAUSED → DISABLED
 * (ACTIVE may return to PAUSED / DISABLED; READY may go ACTIVE)
 */
export const DEPARTMENT_LIFECYCLE_TRANSITIONS: Partial<
  Record<DepartmentLifecycleStatus, DepartmentLifecycleStatus[]>
> = {
  REGISTERED: ["VALIDATED", "DISABLED"],
  VALIDATED: ["READY", "DISABLED"],
  READY: ["ACTIVE", "PAUSED", "DISABLED"],
  ACTIVE: ["PAUSED", "DISABLED"],
  PAUSED: ["READY", "ACTIVE", "DISABLED"],
  DISABLED: ["REGISTERED"],
};

const machine = new BaseLifecycleStateMachine(
  DEPARTMENT_LIFECYCLE_TRANSITIONS as Record<string, readonly string[]>,
  [
    ...DEFAULT_EXECUTION_BLOCKED_TARGETS,
    "EXECUTING",
    "DISPATCHED",
    "WORKER_STARTED",
  ],
);

export function canDepartmentLifecycleTransition(
  from: DepartmentLifecycleStatus,
  to: DepartmentLifecycleStatus,
): boolean {
  return machine.can(from, to);
}

export function assertDepartmentLifecycleTransition(
  from: DepartmentLifecycleStatus,
  to: DepartmentLifecycleStatus,
): void {
  machine.assert(from, to, "department-lifecycle");
}

/** V1 scaffold never activates runtime execution. */
export function isExecutionPossibleInStatus(
  _status: DepartmentLifecycleStatus,
): false {
  return false;
}
