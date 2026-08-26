/**
 * QueueSubmissionStateMachine — Agent #167.
 * Shadow only. Never activates QUEUED / DISPATCHED / RUNNING / EXECUTING.
 * Platform consolidation (Agent #173): uses BaseLifecycleStateMachine helpers.
 */
import type { MissionLifecycleStatus } from "./mission-types.js";
import type {
  QueueSubmissionLifecycleStatus,
  QueueSubmissionReviewDecision,
} from "./queue-submission-types.js";
import { BaseLifecycleStateMachine } from "../../platform/state-machine/BaseLifecycleStateMachine.js";

export const QUEUE_SUBMISSION_TRANSITIONS: Partial<
  Record<MissionLifecycleStatus, MissionLifecycleStatus[]>
> = {
  PACKAGE_ACKNOWLEDGED: ["WAITING_QUEUE_SUBMISSION"],
  WAITING_QUEUE_SUBMISSION: [
    "QUEUE_SUBMISSION_READY",
    "QUEUE_SUBMISSION_BLOCKED",
  ],
  QUEUE_SUBMISSION_BLOCKED: ["WAITING_QUEUE_SUBMISSION", "ARCHIVED"],
  QUEUE_SUBMISSION_READY: ["ARCHIVED"],
};

/** Preserve original blocked set (Agent #167) — do not expand. */
const QUEUE_SUBMISSION_BLOCKED = [
  "IN_PROGRESS",
  "COMPLETED",
  "QUEUED",
  "DISPATCHED",
  "RUNNING",
  "EXECUTING",
] as const;

const machine = new BaseLifecycleStateMachine(
  QUEUE_SUBMISSION_TRANSITIONS as Record<string, readonly string[]>,
  QUEUE_SUBMISSION_BLOCKED,
);

export function canQueueSubmissionTransition(
  from: MissionLifecycleStatus,
  to: MissionLifecycleStatus,
): boolean {
  return machine.can(from, to);
}

export function decisionToSubmissionStatus(
  decision: QueueSubmissionReviewDecision,
): QueueSubmissionLifecycleStatus {
  if (decision === "CONFIRM_SHADOW_PACKAGE") return "QUEUE_SUBMISSION_READY";
  return "QUEUE_SUBMISSION_BLOCKED";
}

export function assertQueueSubmissionTransition(
  from: MissionLifecycleStatus,
  to: MissionLifecycleStatus,
): void {
  machine.assert(from, to, "queue submission");
}
