/**
 * WorkerLifecycle — Agent #182.
 * REGISTERED → ASSIGNED → READY → WAITING_CONTROLLER → CONTROLLER_AUTHORIZED → STOP
 */
import {
  BaseLifecycleStateMachine,
  DEFAULT_EXECUTION_BLOCKED_TARGETS,
} from "../../platform/state-machine/BaseLifecycleStateMachine.js";
import type { WorkerRuntimeLifecycleStatus } from "./WorkerRuntimeTypes.js";

export const WORKER_RUNTIME_TRANSITIONS: Partial<
  Record<WorkerRuntimeLifecycleStatus, WorkerRuntimeLifecycleStatus[]>
> = {
  REGISTERED: ["ASSIGNED", "STOPPED"],
  ASSIGNED: ["READY", "STOPPED"],
  READY: ["WAITING_CONTROLLER", "STOPPED"],
  WAITING_CONTROLLER: ["CONTROLLER_AUTHORIZED", "STOPPED"],
  CONTROLLER_AUTHORIZED: ["STOPPED"],
  STOPPED: [],
};

const machine = new BaseLifecycleStateMachine(
  WORKER_RUNTIME_TRANSITIONS as Record<string, readonly string[]>,
  [
    ...DEFAULT_EXECUTION_BLOCKED_TARGETS,
    "RUNNING",
    "SPAWNED",
    "EXECUTING",
    "COMPLETED",
  ],
);

export function canWorkerRuntimeTransition(
  from: WorkerRuntimeLifecycleStatus,
  to: WorkerRuntimeLifecycleStatus,
): boolean {
  return machine.can(from, to);
}

export function assertWorkerRuntimeTransition(
  from: WorkerRuntimeLifecycleStatus,
  to: WorkerRuntimeLifecycleStatus,
): void {
  machine.assert(from, to, "worker-runtime");
}

export function isWorkerSpawnPossible(
  _status: WorkerRuntimeLifecycleStatus,
): false {
  return false;
}

export function isWorkerExecutionPossible(
  _status: WorkerRuntimeLifecycleStatus,
): false {
  return false;
}
