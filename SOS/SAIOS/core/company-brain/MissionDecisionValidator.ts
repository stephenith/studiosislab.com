/**
 * MissionDecisionValidator — Agent #163.
 * Reports errors only. Never executes / enqueues / publishes.
 */
import type { MissionContract } from "./mission-types.js";
import type { MissionDecision, MissionDecisionInput } from "./mission-decision-types.js";
import { MISSION_FOUNDER_ACTOR } from "./mission-decision-types.js";
import {
  canApprovalTransition,
  decisionToStatus,
} from "./MissionApprovalStateMachine.js";

export type DecisionValidationIssue = {
  code: string;
  message: string;
  field?: string;
};

export type DecisionValidationResult = {
  ok: boolean;
  errors: DecisionValidationIssue[];
};

const FORBIDDEN_SIDE_EFFECT_KEYS = [
  "execute",
  "enqueue",
  "publish",
  "enable_live",
  "queue_admission_allowed",
  "execution_allowed",
  "publishing_allowed",
] as const;

export function validateMissionDecisionInput(
  input: MissionDecisionInput,
  mission: MissionContract | null,
  opts?: {
    consumed_for_version?: boolean;
  },
): DecisionValidationResult {
  const errors: DecisionValidationIssue[] = [];

  for (const key of FORBIDDEN_SIDE_EFFECT_KEYS) {
    if (key in input && (input as Record<string, unknown>)[key] !== undefined) {
      errors.push({
        code: "FORBIDDEN_SIDE_EFFECT",
        message: `Field '${key}' is forbidden on mission decisions`,
        field: key,
      });
    }
  }

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

  if (input.actor !== MISSION_FOUNDER_ACTOR) {
    errors.push({
      code: "INVALID_FOUNDER_ACTOR",
      message: `Actor must be '${MISSION_FOUNDER_ACTOR}' (got '${input.actor}')`,
      field: "actor",
    });
  }

  if (!["APPROVED", "REJECTED", "CHANGES_REQUESTED"].includes(input.decision)) {
    errors.push({
      code: "INVALID_DECISION",
      message: `Unknown decision: ${String(input.decision)}`,
      field: "decision",
    });
  }

  if (input.decision === "REJECTED" && !String(input.reason ?? "").trim()) {
    errors.push({
      code: "REASON_REQUIRED",
      message: "REJECTED requires reason",
      field: "reason",
    });
  }

  if (
    input.decision === "CHANGES_REQUESTED" &&
    !String(input.feedback ?? "").trim()
  ) {
    errors.push({
      code: "FEEDBACK_REQUIRED",
      message: "CHANGES_REQUESTED requires feedback",
      field: "feedback",
    });
  }

  if (opts?.consumed_for_version) {
    errors.push({
      code: "DUPLICATE_DECISION",
      message: "A decision for this mission version was already consumed",
      field: "mission_version",
    });
  }

  const target = decisionToStatus(input.decision);
  if (!canApprovalTransition(mission.status, target)) {
    errors.push({
      code: "INVALID_LIFECYCLE_TRANSITION",
      message: `Cannot transition ${mission.status} → ${target}`,
      field: "decision",
    });
  }

  if (mission.execution_allowed !== false) {
    errors.push({
      code: "EXECUTION_MUST_REMAIN_FALSE",
      message: "Mission execution_allowed must remain false",
    });
  }
  if (mission.queue_admission_allowed !== false) {
    errors.push({
      code: "QUEUE_MUST_REMAIN_FALSE",
      message: "Mission queue_admission_allowed must remain false",
    });
  }
  if (mission.publishing_allowed !== false) {
    errors.push({
      code: "PUBLISH_MUST_REMAIN_FALSE",
      message: "Mission publishing_allowed must remain false",
    });
  }

  return { ok: errors.length === 0, errors };
}

export function assertDecisionImmutable(existing: MissionDecision): void {
  // Decisions are append-only; callers must never mutate fields in place.
  void existing;
}
