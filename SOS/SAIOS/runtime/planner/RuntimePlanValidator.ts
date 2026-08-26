/**
 * RuntimePlanValidator — Agent #169.
 * Platform consolidation (Agent #173): shared checksum / forbidden helpers.
 */
import type { MissionContract } from "../../core/company-brain/mission-types.js";
import type { ShadowQueueRecord } from "../queue/shadow-queue-types.js";
import type { QueueSubmissionPackage } from "../../core/company-brain/queue-submission-types.js";
import type {
  RuntimeExecutionPlan,
} from "./runtime-plan-types.js";
import { RUNTIME_PLAN_FORBIDDEN_KEYS } from "./runtime-plan-types.js";
import {
  rejectForbiddenKeys,
  sha256Canonical,
} from "../../platform/checksums/index.js";

export type RuntimePlanValidationIssue = {
  code: string;
  message: string;
  field?: string;
};

export type RuntimePlanValidationResult = {
  ok: boolean;
  errors: RuntimePlanValidationIssue[];
};

export function computeRuntimePlanChecksum(
  plan: Omit<RuntimeExecutionPlan, "plan_checksum"> | RuntimeExecutionPlan,
): string {
  const { plan_checksum: _ignored, ...rest } = plan as RuntimeExecutionPlan & {
    plan_checksum?: string;
  };
  return sha256Canonical(rest);
}

export function rejectForbiddenRuntimePlanPayload(
  payload: Record<string, unknown>,
): RuntimePlanValidationIssue | null {
  return rejectForbiddenKeys(payload, RUNTIME_PLAN_FORBIDDEN_KEYS, {
    messageForKey: (key) => `Field '${key}' is forbidden on runtime plan`,
  });
}

export function validateRuntimePlanPrerequisites(
  mission: MissionContract | null,
  shadow: ShadowQueueRecord | null,
  submission: QueueSubmissionPackage | null,
  opts?: { already_planned?: boolean },
): RuntimePlanValidationResult {
  const errors: RuntimePlanValidationIssue[] = [];

  if (!mission) {
    errors.push({
      code: "MISSION_NOT_FOUND",
      message: "Mission not found",
      field: "mission_id",
    });
    return { ok: false, errors };
  }

  if (
    mission.status !== "SHADOW_QUEUE_RECEIVED" &&
    mission.status !== "RUNTIME_PLAN_READY" &&
    mission.status !== "RUNTIME_PLAN_BLOCKED"
  ) {
    errors.push({
      code: "SHADOW_NOT_RECEIVED",
      message: `Mission must be SHADOW_QUEUE_RECEIVED (got ${mission.status})`,
      field: "status",
    });
  }

  if (!shadow || shadow.status !== "SHADOW_QUEUE_RECEIVED") {
    errors.push({
      code: "MISSING_SHADOW_RECORD",
      message: "Shadow queue record not found",
      field: "shadow_queue_id",
    });
    return { ok: false, errors };
  }

  if (!submission) {
    errors.push({
      code: "MISSING_SUBMISSION",
      message: "Queue submission package not found",
      field: "submission_id",
    });
    return { ok: false, errors };
  }

  if (shadow.submission_checksum !== submission.submission_checksum) {
    errors.push({
      code: "SUBMISSION_CHECKSUM_MISMATCH",
      message: "Shadow record checksum does not match submission",
      field: "submission_checksum",
    });
  }

  if (
    shadow.execution_package_checksum !== submission.execution_package_checksum
  ) {
    errors.push({
      code: "EXECUTION_PACKAGE_CHECKSUM_MISMATCH",
      message: "Shadow execution package checksum mismatch",
      field: "execution_package_checksum",
    });
  }

  if (opts?.already_planned) {
    errors.push({
      code: "DUPLICATE_RUNTIME_PLAN",
      message: "Runtime plan already exists for this shadow record",
      field: "shadow_queue_id",
    });
  }

  return { ok: errors.length === 0, errors };
}

export function validateRuntimeExecutionPlan(
  plan: RuntimeExecutionPlan,
): RuntimePlanValidationResult {
  const errors: RuntimePlanValidationIssue[] = [];

  if (plan.schema_version !== "runtime-plan-1.0.0") {
    errors.push({ code: "INVALID_SCHEMA", message: "Invalid schema_version" });
  }
  if (plan.planning_only !== true) {
    errors.push({
      code: "PLANNING_ONLY_REQUIRED",
      message: "planning_only must be true",
    });
  }
  if (plan.dispatch_allowed !== false) {
    errors.push({
      code: "DISPATCH_MUST_BE_FALSE",
      message: "dispatch_allowed must be false",
    });
  }
  if (plan.execution_allowed !== false) {
    errors.push({
      code: "EXECUTION_MUST_BE_FALSE",
      message: "execution_allowed must be false",
    });
  }
  if (plan.publishing_allowed !== false) {
    errors.push({
      code: "PUBLISH_MUST_BE_FALSE",
      message: "publishing_allowed must be false",
    });
  }
  if (!plan.dependency_graph.acyclic) {
    errors.push({
      code: "DEPENDENCY_CYCLE",
      message: "Dependency graph contains cycles",
      field: "dependency_graph",
    });
  }
  if (plan.dependency_graph.invalid_ordering.length > 0) {
    errors.push({
      code: "INVALID_ORDERING",
      message: plan.dependency_graph.invalid_ordering.join("; "),
      field: "dependency_graph",
    });
  }

  const expected = computeRuntimePlanChecksum(plan);
  if (plan.plan_checksum !== expected) {
    errors.push({
      code: "PLAN_CHECKSUM_MISMATCH",
      message: "plan_checksum does not match plan body",
      field: "plan_checksum",
    });
  }

  return { ok: errors.length === 0, errors };
}
