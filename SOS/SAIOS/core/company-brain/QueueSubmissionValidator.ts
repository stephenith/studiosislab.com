/**
 * QueueSubmissionValidator — Agent #167.
 * Validates shadow submission packages. Never enqueues.
 * Platform consolidation (Agent #173): shared checksum / forbidden helpers.
 */
import type { MissionContract } from "./mission-types.js";
import type { ExecutionPackage } from "./execution-package-types.js";
import type { ExecutionPackageAcknowledgement } from "./execution-package-ack-types.js";
import type {
  QueueSubmissionPackage,
  QueueSubmissionReviewInput,
} from "./queue-submission-types.js";
import { QUEUE_SUBMISSION_FOUNDER_ACTOR } from "./queue-submission-types.js";
import { computeExecutionPackageChecksum } from "./ExecutionPackageAcknowledgement.js";
import {
  canQueueSubmissionTransition,
  decisionToSubmissionStatus,
} from "./QueueSubmissionStateMachine.js";
import {
  rejectForbiddenKeys,
  sha256Canonical,
} from "../../platform/checksums/index.js";

export type QueueSubmissionValidationIssue = {
  code: string;
  message: string;
  field?: string;
};

export type QueueSubmissionValidationResult = {
  ok: boolean;
  errors: QueueSubmissionValidationIssue[];
};

export const QUEUE_SUBMISSION_FORBIDDEN_KEYS = [
  "enqueue",
  "queue",
  "dispatch",
  "execute",
  "publish",
  "enable_live",
  "provider_call",
] as const;

export function computeAcknowledgementChecksum(
  ack: ExecutionPackageAcknowledgement,
): string {
  return sha256Canonical(ack);
}

export function computeSubmissionChecksum(
  pkg: Omit<QueueSubmissionPackage, "submission_checksum"> | QueueSubmissionPackage,
): string {
  const { submission_checksum: _ignored, ...rest } =
    pkg as QueueSubmissionPackage & { submission_checksum?: string };
  return sha256Canonical(rest);
}

export function rejectForbiddenSubmissionPayload(
  payload: Record<string, unknown>,
): QueueSubmissionValidationIssue | null {
  return rejectForbiddenKeys(payload, QUEUE_SUBMISSION_FORBIDDEN_KEYS, {
    messageForKey: (key) =>
      `Field '${key}' is forbidden on queue submission`,
  });
}

export function validateSubmissionPrerequisites(
  mission: MissionContract | null,
  pkg: ExecutionPackage | null,
  ack: ExecutionPackageAcknowledgement | null,
  opts?: { already_submitted?: boolean },
): QueueSubmissionValidationResult {
  const errors: QueueSubmissionValidationIssue[] = [];

  if (!mission) {
    errors.push({
      code: "MISSION_NOT_FOUND",
      message: "Mission not found",
      field: "mission_id",
    });
    return { ok: false, errors };
  }

  if (
    mission.status !== "PACKAGE_ACKNOWLEDGED" &&
    mission.status !== "WAITING_QUEUE_SUBMISSION" &&
    mission.status !== "QUEUE_SUBMISSION_READY" &&
    mission.status !== "QUEUE_SUBMISSION_BLOCKED"
  ) {
    errors.push({
      code: "MISSION_NOT_ACKNOWLEDGED",
      message: `Mission must be PACKAGE_ACKNOWLEDGED (got ${mission.status})`,
      field: "status",
    });
  }

  if (!pkg) {
    errors.push({
      code: "MISSING_PACKAGE",
      message: "Execution package not found",
      field: "execution_package_id",
    });
    return { ok: false, errors };
  }

  const expectedPkgChecksum = computeExecutionPackageChecksum(pkg);
  if (pkg.checksum !== expectedPkgChecksum) {
    errors.push({
      code: "EXECUTION_PACKAGE_CHECKSUM_INVALID",
      message: "Execution package checksum does not match package body",
      field: "execution_package_checksum",
    });
  }

  if (!ack) {
    errors.push({
      code: "MISSING_ACKNOWLEDGEMENT",
      message: "Package acknowledgement not found",
      field: "acknowledgement_id",
    });
    return { ok: false, errors };
  }

  if (ack.decision !== "ACKNOWLEDGED" || ack.status !== "CONSUMED") {
    errors.push({
      code: "PACKAGE_NOT_ACKNOWLEDGED",
      message: "Execution package must be ACKNOWLEDGED and CONSUMED",
      field: "acknowledgement_id",
    });
  }

  if (ack.execution_package_checksum !== pkg.checksum) {
    errors.push({
      code: "ACK_PACKAGE_CHECKSUM_MISMATCH",
      message: "Acknowledgement checksum does not match execution package",
      field: "acknowledgement_checksum",
    });
  }

  if (ack.execution_package_version !== pkg.package_version) {
    errors.push({
      code: "STALE_PACKAGE_VERSION",
      message: `Acknowledgement package version ${ack.execution_package_version} != ${pkg.package_version}`,
      field: "execution_package_version",
    });
  }

  if (opts?.already_submitted) {
    errors.push({
      code: "DUPLICATE_SUBMISSION",
      message: "Submission package already exists for this execution package",
      field: "execution_package_id",
    });
  }

  return { ok: errors.length === 0, errors };
}

export function validateQueueSubmissionPackage(
  pkg: QueueSubmissionPackage,
): QueueSubmissionValidationResult {
  const errors: QueueSubmissionValidationIssue[] = [];

  if (pkg.schema_version !== "queue-submission-1.0.0") {
    errors.push({
      code: "INVALID_SCHEMA",
      message: "schema_version must be queue-submission-1.0.0",
    });
  }
  if (pkg.dry_run !== true) {
    errors.push({ code: "DRY_RUN_REQUIRED", message: "dry_run must be true" });
  }
  if (pkg.submission_allowed !== false) {
    errors.push({
      code: "SUBMISSION_MUST_BE_FALSE",
      message: "submission_allowed must be false",
    });
  }
  if (pkg.queue_insert_allowed !== false) {
    errors.push({
      code: "QUEUE_INSERT_MUST_BE_FALSE",
      message: "queue_insert_allowed must be false",
    });
  }
  if (pkg.execution_allowed !== false) {
    errors.push({
      code: "EXECUTION_MUST_BE_FALSE",
      message: "execution_allowed must be false",
    });
  }
  if (pkg.publishing_allowed !== false) {
    errors.push({
      code: "PUBLISH_MUST_BE_FALSE",
      message: "publishing_allowed must be false",
    });
  }

  const expected = computeSubmissionChecksum(pkg);
  if (pkg.submission_checksum !== expected) {
    errors.push({
      code: "SUBMISSION_CHECKSUM_MISMATCH",
      message: "submission_checksum does not match package body",
      field: "submission_checksum",
    });
  }

  return { ok: errors.length === 0, errors };
}

export function validateQueueSubmissionReviewInput(
  input: QueueSubmissionReviewInput,
  mission: MissionContract | null,
  pkg: QueueSubmissionPackage | null,
): QueueSubmissionValidationResult {
  const errors: QueueSubmissionValidationIssue[] = [];

  const forbidden = rejectForbiddenSubmissionPayload(
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

  if (!pkg) {
    errors.push({
      code: "MISSING_SUBMISSION",
      message: "Queue submission package not found",
      field: "submission_id",
    });
    return { ok: false, errors };
  }

  if (input.actor !== QUEUE_SUBMISSION_FOUNDER_ACTOR) {
    errors.push({
      code: "INVALID_FOUNDER_ACTOR",
      message: `actor must be ${QUEUE_SUBMISSION_FOUNDER_ACTOR}`,
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

  if (pkg.submission_id !== input.submission_id) {
    errors.push({
      code: "SUBMISSION_ID_MISMATCH",
      message: "submission_id does not match current package",
      field: "submission_id",
    });
  }

  if (pkg.submission_checksum !== input.submission_checksum) {
    errors.push({
      code: "SUBMISSION_CHECKSUM_MISMATCH",
      message: "submission_checksum does not match current package",
      field: "submission_checksum",
    });
  }

  if (mission.status !== "WAITING_QUEUE_SUBMISSION") {
    errors.push({
      code: "INVALID_LIFECYCLE",
      message: `Mission must be WAITING_QUEUE_SUBMISSION (got ${mission.status})`,
      field: "status",
    });
  }

  const target = decisionToSubmissionStatus(input.decision);
  if (!canQueueSubmissionTransition(mission.status, target)) {
    errors.push({
      code: "INVALID_LIFECYCLE_TRANSITION",
      message: `Cannot transition ${mission.status} → ${target}`,
    });
  }

  if (
    input.decision === "BLOCK_SUBMISSION" &&
    !String(input.reason ?? "").trim()
  ) {
    errors.push({
      code: "REASON_REQUIRED",
      message: "reason required for BLOCK_SUBMISSION",
      field: "reason",
    });
  }

  return { ok: errors.length === 0, errors };
}
