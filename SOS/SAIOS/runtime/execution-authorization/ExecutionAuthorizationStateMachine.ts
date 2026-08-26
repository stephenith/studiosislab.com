/**
 * ExecutionAuthorizationStateMachine — Agent #186.
 * CREATED → WAITING_FOUNDER → AUTHORIZED | REJECTED → STOP
 * Authorization NEVER changes execution flags.
 */
import {
  BaseLifecycleStateMachine,
  DEFAULT_EXECUTION_BLOCKED_TARGETS,
} from "../../platform/state-machine/BaseLifecycleStateMachine.js";
import type { ExecutionAuthorizationLifecycleStatus } from "./ExecutionAuthorizationTypes.js";

export const EXECUTION_AUTHORIZATION_LIFECYCLE_TRANSITIONS: Partial<
  Record<
    ExecutionAuthorizationLifecycleStatus,
    ExecutionAuthorizationLifecycleStatus[]
  >
> = {
  CREATED: ["WAITING_FOUNDER"],
  WAITING_FOUNDER: ["AUTHORIZED", "REJECTED"],
  AUTHORIZED: ["STOP"],
  REJECTED: ["STOP"],
  STOP: [],
};

const machine = new BaseLifecycleStateMachine(
  EXECUTION_AUTHORIZATION_LIFECYCLE_TRANSITIONS as Record<
    string,
    readonly string[]
  >,
  [
    ...DEFAULT_EXECUTION_BLOCKED_TARGETS,
    "EXECUTING",
    "DISPATCHING",
    "LIVE",
    "ENABLED",
  ],
);

export function canExecutionAuthorizationTransition(
  from: ExecutionAuthorizationLifecycleStatus,
  to: ExecutionAuthorizationLifecycleStatus,
): boolean {
  return machine.can(from, to);
}

export function assertExecutionAuthorizationTransition(
  from: ExecutionAuthorizationLifecycleStatus,
  to: ExecutionAuthorizationLifecycleStatus,
): void {
  machine.assert(from, to, "execution-authorization-lifecycle");
}

export function isAuthorizationExecutionPossible(
  _status: ExecutionAuthorizationLifecycleStatus,
): false {
  return false;
}
