/**
 * ExecutionControllerStateMachine — Agent #179.
 * Controller-local only. Never mutates MissionLifecycleStatus.
 */
import {
  BaseLifecycleStateMachine,
  DEFAULT_EXECUTION_BLOCKED_TARGETS,
} from "../../platform/state-machine/BaseLifecycleStateMachine.js";
import type { ExecutionControllerLifecycleStatus } from "./ExecutionControllerTypes.js";

/**
 * SYSTEM_READY (mission prerequisite, not a controller state)
 * → WAITING_EXECUTION_AUTHORIZATION
 * → EXECUTION_AUTHORIZED
 * → WAITING_EXECUTION_CONTROLLER
 * → EXECUTION_CONTROLLER_READY
 * → STOP
 */
export const EXECUTION_CONTROLLER_TRANSITIONS: Partial<
  Record<
    ExecutionControllerLifecycleStatus,
    ExecutionControllerLifecycleStatus[]
  >
> = {
  WAITING_EXECUTION_AUTHORIZATION: [
    "EXECUTION_AUTHORIZED",
    "EXECUTION_CONTROLLER_BLOCKED",
  ],
  EXECUTION_AUTHORIZED: [
    "WAITING_EXECUTION_CONTROLLER",
    "EXECUTION_CONTROLLER_BLOCKED",
  ],
  WAITING_EXECUTION_CONTROLLER: [
    "EXECUTION_CONTROLLER_READY",
    "EXECUTION_CONTROLLER_BLOCKED",
  ],
  EXECUTION_CONTROLLER_READY: [],
  EXECUTION_CONTROLLER_BLOCKED: ["WAITING_EXECUTION_AUTHORIZATION"],
};

const machine = new BaseLifecycleStateMachine(
  EXECUTION_CONTROLLER_TRANSITIONS as Record<string, readonly string[]>,
  [
    ...DEFAULT_EXECUTION_BLOCKED_TARGETS,
    "IN_PROGRESS",
    "QUEUED",
    "DISPATCHED",
    "WORKER_STARTED",
    "COMPLETED",
  ],
);

export function canExecutionControllerTransition(
  from: ExecutionControllerLifecycleStatus,
  to: ExecutionControllerLifecycleStatus,
): boolean {
  return machine.can(from, to);
}

export function assertExecutionControllerTransition(
  from: ExecutionControllerLifecycleStatus,
  to: ExecutionControllerLifecycleStatus,
): void {
  machine.assert(from, to, "execution-controller");
}

export function decisionToControllerStatus(
  decision: "APPROVE_CONTROLLER_SCAFFOLD" | "BLOCK_CONTROLLER_SCAFFOLD" | "REQUEST_CONTROLLER_CHANGES",
): ExecutionControllerLifecycleStatus {
  if (decision === "APPROVE_CONTROLLER_SCAFFOLD") {
    return "EXECUTION_CONTROLLER_READY";
  }
  return "EXECUTION_CONTROLLER_BLOCKED";
}
