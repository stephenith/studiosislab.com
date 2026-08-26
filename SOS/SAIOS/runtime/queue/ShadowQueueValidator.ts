/**
 * ShadowQueueValidator — Agent #168.
 * Validates shadow reception. Never dispatches.
 */
import type { MissionContract } from "../../core/company-brain/mission-types.js";
import type { QueueSubmissionPackage } from "../../core/company-brain/queue-submission-types.js";
import { computeSubmissionChecksum } from "../../core/company-brain/QueueSubmissionValidator.js";
import type { ShadowQueueReceiveInput } from "./shadow-queue-types.js";
import {
  SHADOW_QUEUE_FORBIDDEN_KEYS,
  SHADOW_QUEUE_FOUNDER_ACTOR,
} from "./shadow-queue-types.js";
import { rejectForbiddenKeys } from "../../platform/checksums/index.js";

export type ShadowQueueValidationIssue = {
  code: string;
  message: string;
  field?: string;
};

export type ShadowQueueValidationResult = {
  ok: boolean;
  errors: ShadowQueueValidationIssue[];
};

export function rejectForbiddenShadowPayload(
  payload: Record<string, unknown>,
): ShadowQueueValidationIssue | null {
  return rejectForbiddenKeys(payload, SHADOW_QUEUE_FORBIDDEN_KEYS, {
    messageForKey: (key) => `Field '${key}' is forbidden on shadow queue`,
  });
}

export function validateShadowReceiveInput(
  input: ShadowQueueReceiveInput,
  mission: MissionContract | null,
  submission: QueueSubmissionPackage | null,
  opts?: { already_received?: boolean },
): ShadowQueueValidationResult {
  const errors: ShadowQueueValidationIssue[] = [];

  const forbidden = rejectForbiddenShadowPayload(
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

  if (!submission) {
    errors.push({
      code: "MISSING_SUBMISSION",
      message: "Queue submission package not found",
      field: "submission_id",
    });
    return { ok: false, errors };
  }

  if (input.actor !== SHADOW_QUEUE_FOUNDER_ACTOR) {
    errors.push({
      code: "INVALID_FOUNDER_ACTOR",
      message: `actor must be ${SHADOW_QUEUE_FOUNDER_ACTOR}`,
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

  if (mission.status !== "QUEUE_SUBMISSION_READY") {
    if (
      mission.status === "SHADOW_QUEUE_RECEIVED" ||
      opts?.already_received
    ) {
      errors.push({
        code: "DUPLICATE_SHADOW_RECORD",
        message: "Shadow queue already received this submission",
        field: "submission_id",
      });
    } else {
      errors.push({
        code: "SUBMISSION_NOT_READY",
        message: `Mission must be QUEUE_SUBMISSION_READY (got ${mission.status})`,
        field: "status",
      });
    }
  }

  if (submission.submission_id !== input.submission_id) {
    errors.push({
      code: "SUBMISSION_ID_MISMATCH",
      message: "submission_id does not match current package",
      field: "submission_id",
    });
  }

  if (submission.submission_checksum !== input.submission_checksum) {
    errors.push({
      code: "SUBMISSION_CHECKSUM_MISMATCH",
      message: "submission_checksum does not match current package",
      field: "submission_checksum",
    });
  }

  const expectedSubmissionChecksum = computeSubmissionChecksum(submission);
  if (submission.submission_checksum !== expectedSubmissionChecksum) {
    errors.push({
      code: "SUBMISSION_CHECKSUM_INVALID",
      message: "Stored submission checksum does not match package body",
      field: "submission_checksum",
    });
  }

  if (!submission.execution_package_checksum?.trim()) {
    errors.push({
      code: "EXECUTION_PACKAGE_CHECKSUM_MISSING",
      message: "execution_package_checksum required",
      field: "execution_package_checksum",
    });
  }

  if (!submission.acknowledgement_checksum?.trim()) {
    errors.push({
      code: "ACKNOWLEDGEMENT_CHECKSUM_MISSING",
      message: "acknowledgement_checksum required",
      field: "acknowledgement_checksum",
    });
  }

  if (
    submission.dry_run !== true ||
    submission.queue_insert_allowed !== false ||
    submission.execution_allowed !== false ||
    submission.publishing_allowed !== false
  ) {
    errors.push({
      code: "UNSAFE_SUBMISSION_FLAGS",
      message: "Submission package must remain dry_run with all allow-flags false",
    });
  }

  if (opts?.already_received) {
    errors.push({
      code: "DUPLICATE_SHADOW_RECORD",
      message: "Shadow queue already received this submission",
      field: "submission_id",
    });
  }

  return { ok: errors.length === 0, errors };
}
