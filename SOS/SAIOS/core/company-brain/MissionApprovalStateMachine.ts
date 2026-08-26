/**
 * Mission approval lifecycle state machine (Agent #163).
 * Approval-only. Does not activate READY_FOR_QUEUE / IN_PROGRESS / etc.
 */
import type { MissionLifecycleStatus } from "./mission-types.js";
import type { MissionDecisionKind } from "./mission-decision-types.js";

/** Active approval transitions for Agent #163. */
export const APPROVAL_TRANSITIONS: Partial<
  Record<MissionLifecycleStatus, MissionLifecycleStatus[]>
> = {
  PLANNED: ["WAITING_FOUNDER"],
  WAITING_FOUNDER: ["APPROVED", "REJECTED", "CHANGES_REQUESTED"],
};

/** Placeholder execution stages — must never be reached by approval or queue admission. */
export const PLACEHOLDER_STATUSES: MissionLifecycleStatus[] = [
  "IN_PROGRESS",
  "COMPLETED",
];

export function decisionToStatus(
  decision: MissionDecisionKind,
): MissionLifecycleStatus {
  if (decision === "APPROVED") return "APPROVED";
  if (decision === "REJECTED") return "REJECTED";
  return "CHANGES_REQUESTED";
}

export function canApprovalTransition(
  from: MissionLifecycleStatus,
  to: MissionLifecycleStatus,
): boolean {
  if (PLACEHOLDER_STATUSES.includes(to)) return false;
  return (APPROVAL_TRANSITIONS[from] ?? []).includes(to);
}

export function assertApprovalTransition(
  from: MissionLifecycleStatus,
  to: MissionLifecycleStatus,
): void {
  if (!canApprovalTransition(from, to)) {
    throw new Error(
      `Invalid mission approval transition: ${from} → ${to}`,
    );
  }
}
