/**
 * RuntimeReleaseValidator — Agent #170.
 */
import type { MissionContract } from "../../core/company-brain/mission-types.js";
import type { RuntimeExecutionPlan } from "../planner/runtime-plan-types.js";
import { computeRuntimePlanChecksum } from "../planner/RuntimePlanValidator.js";
import type { RuntimeReleaseDecisionInput } from "./runtime-release-types.js";
import {
  RUNTIME_RELEASE_FORBIDDEN_KEYS,
  RUNTIME_RELEASE_FOUNDER_ACTOR,
} from "./runtime-release-types.js";
import {
  canRuntimeReleaseTransition,
  decisionToReleaseStatus,
} from "./RuntimeReleaseStateMachine.js";
import { rejectForbiddenKeys } from "../../platform/checksums/index.js";

export type RuntimeReleaseValidationIssue = {
  code: string;
  message: string;
  field?: string;
};

export type RuntimeReleaseValidationResult = {
  ok: boolean;
  errors: RuntimeReleaseValidationIssue[];
};

export function rejectForbiddenReleasePayload(
  payload: Record<string, unknown>,
): RuntimeReleaseValidationIssue | null {
  return rejectForbiddenKeys(payload, RUNTIME_RELEASE_FORBIDDEN_KEYS, {
    messageForKey: (key) =>
      `Field '${key}' is forbidden on runtime release`,
  });
}

export function validateRuntimeReleaseInput(
  input: RuntimeReleaseDecisionInput,
  mission: MissionContract | null,
  plan: RuntimeExecutionPlan | null,
  opts?: { already_decided?: boolean },
): RuntimeReleaseValidationResult {
  const errors: RuntimeReleaseValidationIssue[] = [];

  const forbidden = rejectForbiddenReleasePayload(
    input as unknown as Record<string, unknown>,
  );
  if (forbidden) errors.push(forbidden);

  if (!mission) {
    errors.push({
      code: "MISSION_NOT_FOUND",
      message: "Mission not found",
      field: "mission_id",
    });
    return { ok: false, errors };
  }

  if (!plan) {
    errors.push({
      code: "MISSING_RUNTIME_PLAN",
      message: "Runtime plan not found",
      field: "runtime_plan_id",
    });
    return { ok: false, errors };
  }

  if (opts?.already_decided && input.decision === "APPROVED") {
    errors.push({
      code: "DUPLICATE_APPROVAL",
      message: "Runtime release already approved for this plan",
      field: "runtime_plan_id",
    });
    return { ok: false, errors };
  }

  if (
    mission.status === "RUNTIME_RELEASE_APPROVED" &&
    input.decision === "APPROVED"
  ) {
    errors.push({
      code: "DUPLICATE_APPROVAL",
      message: "Runtime release already approved for this plan",
      field: "runtime_plan_id",
    });
    return { ok: false, errors };
  }

  if (input.actor !== RUNTIME_RELEASE_FOUNDER_ACTOR) {
    errors.push({
      code: "INVALID_FOUNDER_ACTOR",
      message: `actor must be ${RUNTIME_RELEASE_FOUNDER_ACTOR}`,
      field: "actor",
    });
  }

  if (mission.mission_version !== input.mission_version) {
    errors.push({
      code: "STALE_MISSION_VERSION",
      message: `Expected mission_version ${mission.mission_version}`,
      field: "mission_version",
    });
  }

  if (plan.runtime_plan_id !== input.runtime_plan_id) {
    errors.push({
      code: "PLAN_ID_MISMATCH",
      message: "runtime_plan_id does not match current plan",
      field: "runtime_plan_id",
    });
  }

  if (plan.plan_checksum !== input.plan_checksum) {
    errors.push({
      code: "PLAN_CHECKSUM_MISMATCH",
      message: "plan_checksum does not match current plan",
      field: "plan_checksum",
    });
  }

  const expected = computeRuntimePlanChecksum(plan);
  if (plan.plan_checksum !== expected) {
    errors.push({
      code: "PLAN_CHECKSUM_INVALID",
      message: "Stored plan checksum does not match plan body",
      field: "plan_checksum",
    });
  }

  if (plan.plan_status !== "RUNTIME_PLAN_READY" && mission.status !== "WAITING_RUNTIME_RELEASE") {
    // Allow decisions only when plan was READY and mission is waiting or still ready
    if (
      mission.status !== "WAITING_RUNTIME_RELEASE" &&
      mission.status !== "RUNTIME_PLAN_READY"
    ) {
      errors.push({
        code: "PLAN_NOT_READY",
        message: `Runtime plan must be READY / waiting release (got plan=${plan.plan_status}, mission=${mission.status})`,
        field: "status",
      });
    }
  }

  if (
    !plan.submission_checksum?.trim() ||
    !plan.execution_package_checksum?.trim() ||
    !plan.acknowledgement_checksum?.trim()
  ) {
    errors.push({
      code: "MISSING_UPSTREAM_CHECKSUMS",
      message: "Submission / execution package / acknowledgement checksums required",
    });
  }

  if (!plan.acknowledgement_checksum) {
    errors.push({
      code: "MISSING_ACKNOWLEDGEMENT",
      message: "Founder acknowledgement checksum missing on plan",
      field: "acknowledgement_checksum",
    });
  }

  if (
    mission.status !== "WAITING_RUNTIME_RELEASE" &&
    mission.status !== "RUNTIME_PLAN_READY"
  ) {
    errors.push({
      code: "INVALID_LIFECYCLE",
      message: `Mission must be WAITING_RUNTIME_RELEASE or RUNTIME_PLAN_READY (got ${mission.status})`,
      field: "status",
    });
  }

  const target = decisionToReleaseStatus(input.decision);
  const from =
    mission.status === "RUNTIME_PLAN_READY"
      ? "WAITING_RUNTIME_RELEASE"
      : mission.status;
  if (
    mission.status === "WAITING_RUNTIME_RELEASE" &&
    !canRuntimeReleaseTransition(mission.status, target)
  ) {
    errors.push({
      code: "INVALID_LIFECYCLE_TRANSITION",
      message: `Cannot transition ${mission.status} → ${target}`,
    });
  }
  void from;

  if (opts?.already_decided && input.decision === "APPROVED") {
    errors.push({
      code: "DUPLICATE_APPROVAL",
      message: "Runtime release already approved for this plan",
      field: "runtime_plan_id",
    });
  }

  if (
    input.decision === "REJECTED" &&
    !String(input.reason ?? "").trim()
  ) {
    errors.push({
      code: "REASON_REQUIRED",
      message: "reason required for REJECTED",
      field: "reason",
    });
  }

  if (
    input.decision === "CHANGES_REQUESTED" &&
    !String(input.notes ?? "").trim()
  ) {
    errors.push({
      code: "FEEDBACK_REQUIRED",
      message: "notes required for CHANGES_REQUESTED",
      field: "notes",
    });
  }

  if (
    plan.planning_only !== true ||
    plan.dispatch_allowed !== false ||
    plan.execution_allowed !== false
  ) {
    errors.push({
      code: "UNSAFE_PLAN_FLAGS",
      message: "Plan must remain planning_only with dispatch/execution false",
    });
  }

  return { ok: errors.length === 0, errors };
}
