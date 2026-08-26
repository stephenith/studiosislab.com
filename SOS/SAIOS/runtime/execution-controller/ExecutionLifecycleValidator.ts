/**
 * ExecutionLifecycleValidator — Agent #179.
 * Scaffold authorization only. Never executes.
 */
import type { MissionContract } from "../../core/company-brain/mission-types.js";
import { rejectForbiddenKeys } from "../../platform/checksums/index.js";
import type { RuntimeExecutionPlan } from "../planner/runtime-plan-types.js";
import { computeRuntimePlanChecksum } from "../planner/RuntimePlanValidator.js";
import type { RuntimeReleaseDecision } from "../runtime-release/runtime-release-types.js";
import type { SystemReadinessCertificate } from "../system-readiness/system-readiness-types.js";
import type {
  ExecutionControllerRecord,
  ExecutionControllerReviewInput,
} from "./ExecutionControllerTypes.js";
import {
  EXECUTION_CONTROLLER_FORBIDDEN_KEYS,
  EXECUTION_CONTROLLER_FOUNDER_ACTOR,
} from "./ExecutionControllerTypes.js";

export type ExecutionControllerValidationIssue = {
  code: string;
  message: string;
  field?: string;
};

export type ExecutionControllerValidationResult = {
  ok: boolean;
  errors: ExecutionControllerValidationIssue[];
};

export function rejectForbiddenControllerPayload(
  payload: Record<string, unknown>,
): ExecutionControllerValidationIssue | null {
  return rejectForbiddenKeys(payload, EXECUTION_CONTROLLER_FORBIDDEN_KEYS, {
    messageForKey: (key) =>
      `Field '${key}' is forbidden on execution controller`,
  });
}

export function validateExecutionControllerOpen(
  mission: MissionContract | null,
  plan: RuntimeExecutionPlan | null,
  release: RuntimeReleaseDecision | null,
  readiness: SystemReadinessCertificate | null,
  opts?: { already_ready?: boolean },
): ExecutionControllerValidationResult {
  const errors: ExecutionControllerValidationIssue[] = [];

  if (!mission) {
    errors.push({
      code: "MISSION_NOT_FOUND",
      message: "Mission not found",
      field: "mission_id",
    });
    return { ok: false, errors };
  }

  if (mission.status !== "SYSTEM_READY") {
    errors.push({
      code: "MISSION_NOT_SYSTEM_READY",
      message: `Mission must be SYSTEM_READY (got ${mission.status})`,
      field: "status",
    });
  }

  if (!plan || plan.plan_status !== "RUNTIME_PLAN_READY") {
    errors.push({
      code: "INVALID_RUNTIME_PLAN",
      message: "Valid RUNTIME_PLAN_READY plan required",
      field: "runtime_plan_id",
    });
  } else {
    const expected = computeRuntimePlanChecksum(plan);
    if (plan.plan_checksum !== expected) {
      errors.push({
        code: "PLAN_CHECKSUM_INVALID",
        message: "Runtime plan checksum mismatch",
        field: "plan_checksum",
      });
    }
  }

  if (
    !release ||
    release.decision !== "APPROVED" ||
    release.status !== "CONSUMED"
  ) {
    errors.push({
      code: "INVALID_RUNTIME_RELEASE",
      message: "Valid APPROVED+CONSUMED runtime release required",
      field: "runtime_release_id",
    });
  }

  if (!readiness || readiness.certificate_status !== "SYSTEM_READY") {
    errors.push({
      code: "INVALID_SYSTEM_READINESS",
      message: "Valid SYSTEM_READY certificate required",
      field: "system_readiness_id",
    });
  } else if (
    readiness.checksum_chain.certificate_checksum == null ||
    readiness.checksum_chain.certificate_checksum === ""
  ) {
    errors.push({
      code: "READINESS_CHECKSUM_MISSING",
      message: "System readiness checksum chain incomplete",
      field: "checksum_chain",
    });
  }

  if (opts?.already_ready) {
    errors.push({
      code: "DUPLICATE_CONTROLLER",
      message: "Execution controller already ready for this readiness certificate",
      field: "mission_id",
    });
  }

  if (
    plan &&
    release &&
    plan.plan_checksum !== release.plan_checksum
  ) {
    errors.push({
      code: "CHECKSUM_CHAIN_BROKEN",
      message: "Plan checksum does not match release plan checksum",
      field: "checksum_chain",
    });
  }

  if (
    plan &&
    readiness &&
    plan.plan_checksum !== readiness.checksum_chain.plan_checksum
  ) {
    errors.push({
      code: "CHECKSUM_CHAIN_BROKEN",
      message: "Plan checksum does not match readiness plan checksum",
      field: "checksum_chain",
    });
  }

  return { ok: errors.length === 0, errors };
}

export function validateExecutionControllerReview(
  input: ExecutionControllerReviewInput,
  mission: MissionContract | null,
  existing: ExecutionControllerRecord | null,
  opts?: { already_ready?: boolean },
): ExecutionControllerValidationResult {
  const errors: ExecutionControllerValidationIssue[] = [];

  const forbidden = rejectForbiddenControllerPayload(
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

  if (mission.status !== "SYSTEM_READY") {
    errors.push({
      code: "MISSION_NOT_SYSTEM_READY",
      message: `Mission must remain SYSTEM_READY (got ${mission.status})`,
      field: "status",
    });
  }

  if (input.actor !== EXECUTION_CONTROLLER_FOUNDER_ACTOR) {
    errors.push({
      code: "INVALID_FOUNDER_ACTOR",
      message: `actor must be ${EXECUTION_CONTROLLER_FOUNDER_ACTOR}`,
      field: "actor",
    });
  }

  if (mission.mission_version !== input.mission_version) {
    errors.push({
      code: "STALE_MISSION_VERSION",
      message: `Stale mission version (expected ${mission.mission_version}, got ${input.mission_version})`,
      field: "mission_version",
    });
  }

  if (opts?.already_ready && input.decision === "APPROVE_CONTROLLER_SCAFFOLD") {
    errors.push({
      code: "DUPLICATE_CONTROLLER",
      message: "Execution controller scaffold already authorized",
      field: "mission_id",
    });
    return { ok: false, errors };
  }

  if (!existing) {
    errors.push({
      code: "CONTROLLER_NOT_OPEN",
      message: "Open execution controller authorization before review",
      field: "controller_id",
    });
  } else if (
    existing.controller_status === "EXECUTION_CONTROLLER_READY" &&
    input.decision === "APPROVE_CONTROLLER_SCAFFOLD"
  ) {
    errors.push({
      code: "DUPLICATE_CONTROLLER",
      message: "Execution controller already ready",
      field: "controller_id",
    });
  } else if (
    existing.controller_status !== "WAITING_EXECUTION_AUTHORIZATION" &&
    existing.controller_status !== "EXECUTION_CONTROLLER_BLOCKED" &&
    input.decision === "APPROVE_CONTROLLER_SCAFFOLD"
  ) {
    errors.push({
      code: "INVALID_CONTROLLER_STATUS",
      message: `Cannot authorize from ${existing.controller_status}`,
      field: "controller_status",
    });
  }

  return { ok: errors.length === 0, errors };
}
