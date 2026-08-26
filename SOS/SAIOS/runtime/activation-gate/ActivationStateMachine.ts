/**
 * ActivationStateMachine — Agent #185.
 * CREATED → CHECKING → ACTIVATION_BLOCKED | ACTIVATION_ELIGIBLE → STOP
 * No further transitions. Never transitions into execution.
 */
import {
  BaseLifecycleStateMachine,
  DEFAULT_EXECUTION_BLOCKED_TARGETS,
} from "../../platform/state-machine/BaseLifecycleStateMachine.js";
import type { ActivationLifecycleStatus } from "./ActivationGateTypes.js";

export const ACTIVATION_LIFECYCLE_TRANSITIONS: Partial<
  Record<ActivationLifecycleStatus, ActivationLifecycleStatus[]>
> = {
  CREATED: ["CHECKING"],
  CHECKING: ["ACTIVATION_BLOCKED", "ACTIVATION_ELIGIBLE"],
  ACTIVATION_BLOCKED: ["STOP"],
  ACTIVATION_ELIGIBLE: ["STOP"],
  STOP: [],
};

const machine = new BaseLifecycleStateMachine(
  ACTIVATION_LIFECYCLE_TRANSITIONS as Record<string, readonly string[]>,
  [
    ...DEFAULT_EXECUTION_BLOCKED_TARGETS,
    "EXECUTING",
    "DISPATCHING",
    "LIVE",
    "ENABLED",
  ],
);

export function canActivationLifecycleTransition(
  from: ActivationLifecycleStatus,
  to: ActivationLifecycleStatus,
): boolean {
  return machine.can(from, to);
}

export function assertActivationLifecycleTransition(
  from: ActivationLifecycleStatus,
  to: ActivationLifecycleStatus,
): void {
  machine.assert(from, to, "activation-lifecycle");
}

/** Activation never enables execution regardless of status. */
export function isActivationExecutionPossible(
  _status: ActivationLifecycleStatus,
): false {
  return false;
}
