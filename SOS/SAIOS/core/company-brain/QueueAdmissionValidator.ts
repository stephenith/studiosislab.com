/**
 * QueueAdmissionValidator — Agent #164.
 */
import type { MissionContract, MissionLifecycleStatus } from "./mission-types.js";
import type {
  QueueDecisionInput,
  QueueAdmissionStatus,
} from "./queue-admission-types.js";
import { QUEUE_FOUNDER_ACTOR } from "./queue-admission-types.js";
import { rejectForbiddenKeys } from "../../platform/checksums/index.js";

export type QueueValidationIssue = {
  code: string;
  message: string;
  field?: string;
};

export type QueueValidationResult = {
  ok: boolean;
  errors: QueueValidationIssue[];
};

/** Active queue-admission transitions only. */
export const QUEUE_TRANSITIONS: Partial<
  Record<MissionLifecycleStatus, MissionLifecycleStatus[]>
> = {
  APPROVED: ["WAITING_QUEUE_REVIEW"],
  WAITING_QUEUE_REVIEW: ["READY_FOR_QUEUE", "QUEUE_BLOCKED", "APPROVED"],
  QUEUE_BLOCKED: ["WAITING_QUEUE_REVIEW", "APPROVED"],
};

export function canQueueTransition(
  from: MissionLifecycleStatus,
  to: MissionLifecycleStatus,
): boolean {
  if (to === "IN_PROGRESS" || to === "COMPLETED") return false;
  return (QUEUE_TRANSITIONS[from] ?? []).includes(to);
}

export function decisionToQueueStatus(
  decision: QueueDecisionInput["decision"],
): QueueAdmissionStatus {
  if (decision === "APPROVE_QUEUE_ADMISSION") return "READY_FOR_QUEUE";
  return "QUEUE_BLOCKED";
}

const FORBIDDEN = [
  "execute",
  "run",
  "dispatch",
  "enqueue",
  "publish",
  "enable_live",
  "queue_enqueue_allowed",
  "execution_allowed",
  "publishing_allowed",
] as const;

export function validateQueueDecisionInput(
  input: QueueDecisionInput,
  mission: MissionContract | null,
  opts?: { consumed_for_version?: boolean },
): QueueValidationResult {
  const errors: QueueValidationIssue[] = [];

  const forbidden = rejectForbiddenKeys(
    input as unknown as Record<string, unknown>,
    FORBIDDEN,
    {
      messageForKey: (key) =>
        `Field '${key}' is forbidden on queue decisions`,
    },
  );
  if (forbidden) errors.push(forbidden);

  if (!input.mission_id?.trim()) {
    errors.push({
      code: "MISSING_MISSION_ID",
      message: "mission_id required",
      field: "mission_id",
    });
  }

  if (!mission) {
    errors.push({
      code: "MISSION_NOT_FOUND",
      message: `Mission not found: ${input.mission_id}`,
      field: "mission_id",
    });
    return { ok: false, errors };
  }

  if (mission.mission_version !== input.mission_version) {
    errors.push({
      code: "STALE_MISSION_VERSION",
      message: `Expected mission_version ${mission.mission_version}, got ${input.mission_version}`,
      field: "mission_version",
    });
  }

  if (input.actor !== QUEUE_FOUNDER_ACTOR) {
    errors.push({
      code: "INVALID_FOUNDER_ACTOR",
      message: `Actor must be '${QUEUE_FOUNDER_ACTOR}'`,
      field: "actor",
    });
  }

  if (
    ![
      "APPROVE_QUEUE_ADMISSION",
      "REQUEST_CHANGES",
      "REJECT_QUEUE_ADMISSION",
    ].includes(input.decision)
  ) {
    errors.push({
      code: "INVALID_DECISION",
      message: `Unknown decision: ${String(input.decision)}`,
      field: "decision",
    });
  }

  if (
    input.decision === "REJECT_QUEUE_ADMISSION" &&
    !String(input.reason ?? "").trim()
  ) {
    errors.push({
      code: "REASON_REQUIRED",
      message: "REJECT_QUEUE_ADMISSION requires reason",
      field: "reason",
    });
  }

  if (
    input.decision === "REQUEST_CHANGES" &&
    !String(input.feedback ?? "").trim()
  ) {
    errors.push({
      code: "FEEDBACK_REQUIRED",
      message: "REQUEST_CHANGES requires feedback",
      field: "feedback",
    });
  }

  if (opts?.consumed_for_version && input.decision === "APPROVE_QUEUE_ADMISSION") {
    // Allow request changes / reject after approve? No — once READY_FOR_QUEUE, no more approve
    errors.push({
      code: "DUPLICATE_DECISION",
      message: "Queue admission already approved for this mission version",
      field: "mission_version",
    });
  }

  const target = decisionToQueueStatus(input.decision);
  // APPROVE must be from WAITING_QUEUE_REVIEW only
  if (input.decision === "APPROVE_QUEUE_ADMISSION") {
    if (!canQueueTransition(mission.status, "READY_FOR_QUEUE")) {
      errors.push({
        code: "INVALID_LIFECYCLE_TRANSITION",
        message: `Cannot transition ${mission.status} → READY_FOR_QUEUE`,
        field: "decision",
      });
    }
  } else if (input.decision === "REJECT_QUEUE_ADMISSION") {
    if (!canQueueTransition(mission.status, "QUEUE_BLOCKED")) {
      errors.push({
        code: "INVALID_LIFECYCLE_TRANSITION",
        message: `Cannot transition ${mission.status} → QUEUE_BLOCKED`,
        field: "decision",
      });
    }
  } else if (input.decision === "REQUEST_CHANGES") {
    // Request changes → QUEUE_BLOCKED (or APPROVED to re-plan)
    if (
      !canQueueTransition(mission.status, "QUEUE_BLOCKED") &&
      !canQueueTransition(mission.status, "APPROVED")
    ) {
      errors.push({
        code: "INVALID_LIFECYCLE_TRANSITION",
        message: `Cannot request changes from ${mission.status}`,
        field: "decision",
      });
    }
  }

  if (mission.execution_allowed !== false) {
    errors.push({
      code: "EXECUTION_MUST_REMAIN_FALSE",
      message: "execution_allowed must remain false",
    });
  }

  void target;
  return { ok: errors.length === 0, errors };
}
