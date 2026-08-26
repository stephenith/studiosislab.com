/**
 * ExecutionPackageAckStateMachine — Agent #166.
 */
import type { MissionLifecycleStatus } from "./mission-types.js";
import type {
  PackageAckDecisionKind,
  PackageAckLifecycleStatus,
} from "./execution-package-ack-types.js";

export const PACKAGE_ACK_TRANSITIONS: Partial<
  Record<MissionLifecycleStatus, MissionLifecycleStatus[]>
> = {
  READY_FOR_QUEUE: ["WAITING_PACKAGE_ACKNOWLEDGEMENT"],
  WAITING_PACKAGE_ACKNOWLEDGEMENT: [
    "PACKAGE_ACKNOWLEDGED",
    "PACKAGE_CHANGES_REQUESTED",
    "PACKAGE_REJECTED",
  ],
};

export function canPackageAckTransition(
  from: MissionLifecycleStatus,
  to: MissionLifecycleStatus,
): boolean {
  if (
    to === "IN_PROGRESS" ||
    to === "COMPLETED" ||
    to === "QUEUED" ||
    (to as string) === "DISPATCHED" ||
    (to as string) === "RUNNING" ||
    (to as string) === "EXECUTING"
  ) {
    return false;
  }
  return (PACKAGE_ACK_TRANSITIONS[from] ?? []).includes(to);
}

export function decisionToAckStatus(
  decision: PackageAckDecisionKind,
): PackageAckLifecycleStatus {
  if (decision === "ACKNOWLEDGED") return "PACKAGE_ACKNOWLEDGED";
  if (decision === "CHANGES_REQUESTED") return "PACKAGE_CHANGES_REQUESTED";
  return "PACKAGE_REJECTED";
}

export function assertPackageAckTransition(
  from: MissionLifecycleStatus,
  to: MissionLifecycleStatus,
): void {
  if (!canPackageAckTransition(from, to)) {
    throw new Error(`Invalid package ack transition: ${from} → ${to}`);
  }
}
