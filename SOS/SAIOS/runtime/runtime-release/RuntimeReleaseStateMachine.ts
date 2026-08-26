/**
 * RuntimeReleaseStateMachine — Agent #170.
 * Governance only. Never activates execution states.
 * Platform consolidation (Agent #173): uses BaseLifecycleStateMachine helpers.
 */
import type { MissionLifecycleStatus } from "../../core/company-brain/mission-types.js";
import type {
  RuntimeReleaseDecisionKind,
  RuntimeReleaseLifecycleStatus,
} from "./runtime-release-types.js";
import {
  BaseLifecycleStateMachine,
  DEFAULT_EXECUTION_BLOCKED_TARGETS,
} from "../../platform/state-machine/BaseLifecycleStateMachine.js";

export const RUNTIME_RELEASE_TRANSITIONS: Partial<
  Record<MissionLifecycleStatus, MissionLifecycleStatus[]>
> = {
  RUNTIME_PLAN_READY: ["WAITING_RUNTIME_RELEASE"],
  WAITING_RUNTIME_RELEASE: [
    "RUNTIME_RELEASE_APPROVED",
    "RUNTIME_RELEASE_REJECTED",
    "RUNTIME_RELEASE_CHANGES_REQUESTED",
  ],
  RUNTIME_RELEASE_CHANGES_REQUESTED: [
    "WAITING_RUNTIME_RELEASE",
    "RUNTIME_PLAN_READY",
    "ARCHIVED",
  ],
  RUNTIME_RELEASE_APPROVED: ["ARCHIVED"],
  RUNTIME_RELEASE_REJECTED: ["ARCHIVED", "RUNTIME_PLAN_READY"],
};

const machine = new BaseLifecycleStateMachine(
  RUNTIME_RELEASE_TRANSITIONS as Record<string, readonly string[]>,
  DEFAULT_EXECUTION_BLOCKED_TARGETS,
);

export function canRuntimeReleaseTransition(
  from: MissionLifecycleStatus,
  to: MissionLifecycleStatus,
): boolean {
  return machine.can(from, to);
}

export function decisionToReleaseStatus(
  decision: RuntimeReleaseDecisionKind,
): RuntimeReleaseLifecycleStatus {
  if (decision === "APPROVED") return "RUNTIME_RELEASE_APPROVED";
  if (decision === "CHANGES_REQUESTED")
    return "RUNTIME_RELEASE_CHANGES_REQUESTED";
  return "RUNTIME_RELEASE_REJECTED";
}

export function assertRuntimeReleaseTransition(
  from: MissionLifecycleStatus,
  to: MissionLifecycleStatus,
): void {
  machine.assert(from, to, "runtime release");
}
