/**
 * ExecutionPackageAckValidator — Agent #166.
 */
import type { MissionContract } from "./mission-types.js";
import type { ExecutionPackage } from "./execution-package-types.js";
import type { PackageAckDecisionInput } from "./execution-package-ack-types.js";
import { PACKAGE_ACK_FOUNDER_ACTOR } from "./execution-package-ack-types.js";
import {
  canPackageAckTransition,
  decisionToAckStatus,
} from "./ExecutionPackageAckStateMachine.js";
import { computeExecutionPackageChecksum } from "./ExecutionPackageAcknowledgement.js";
import { rejectForbiddenKeys } from "../../platform/checksums/index.js";

export type AckValidationIssue = {
  code: string;
  message: string;
  field?: string;
};

export type AckValidationResult = {
  ok: boolean;
  errors: AckValidationIssue[];
};

const FORBIDDEN = [
  "execute",
  "run",
  "dispatch",
  "enqueue",
  "queue",
  "publish",
  "enable_live",
  "provider_call",
] as const;

export function validatePackageAckInput(
  input: PackageAckDecisionInput,
  mission: MissionContract | null,
  pkg: ExecutionPackage | null,
  opts?: { already_acknowledged?: boolean },
): AckValidationResult {
  const errors: AckValidationIssue[] = [];

  const forbidden = rejectForbiddenKeys(
    input as unknown as Record<string, unknown>,
    FORBIDDEN,
    {
      messageForKey: (key) =>
        `Field '${key}' is forbidden on package acknowledgement`,
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

  if (!pkg) {
    errors.push({
      code: "MISSING_PACKAGE",
      message: "Execution package not found",
      field: "package_id",
    });
    return { ok: false, errors };
  }

  if (mission.mission_version !== input.mission_version) {
    errors.push({
      code: "STALE_MISSION_VERSION",
      message: `Expected mission_version ${mission.mission_version}`,
      field: "mission_version",
    });
  }

  if (pkg.package_id !== input.package_id) {
    errors.push({
      code: "PACKAGE_ID_MISMATCH",
      message: "package_id does not match current package",
      field: "package_id",
    });
  }

  if (pkg.package_version !== input.execution_package_version) {
    errors.push({
      code: "STALE_PACKAGE_VERSION",
      message: `Expected package_version ${pkg.package_version}, got ${input.execution_package_version}`,
      field: "execution_package_version",
    });
  }

  const expected = computeExecutionPackageChecksum(pkg);
  if (
    input.execution_package_checksum !== pkg.checksum ||
    input.execution_package_checksum !== expected
  ) {
    errors.push({
      code: "CHECKSUM_MISMATCH",
      message: "execution_package_checksum does not match immutable package",
      field: "execution_package_checksum",
    });
  }

  if (input.actor !== PACKAGE_ACK_FOUNDER_ACTOR) {
    errors.push({
      code: "INVALID_FOUNDER_ACTOR",
      message: `Actor must be '${PACKAGE_ACK_FOUNDER_ACTOR}'`,
      field: "actor",
    });
  }

  if (
    !["ACKNOWLEDGED", "CHANGES_REQUESTED", "REJECTED"].includes(input.decision)
  ) {
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
    !String(input.notes ?? "").trim()
  ) {
    errors.push({
      code: "FEEDBACK_REQUIRED",
      message: "CHANGES_REQUESTED requires notes/feedback",
      field: "notes",
    });
  }

  if (opts?.already_acknowledged) {
    errors.push({
      code: "DUPLICATE_ACKNOWLEDGEMENT",
      message: "Package already acknowledged for this version",
      field: "execution_package_version",
    });
  }

  const target = decisionToAckStatus(input.decision);
  if (!canPackageAckTransition(mission.status, target)) {
    errors.push({
      code: "INVALID_LIFECYCLE_TRANSITION",
      message: `Cannot transition ${mission.status} → ${target}`,
      field: "decision",
    });
  }

  if (mission.execution_allowed !== false || pkg.execution_allowed !== false) {
    errors.push({
      code: "EXECUTION_MUST_REMAIN_FALSE",
      message: "execution_allowed must remain false",
    });
  }

  return { ok: errors.length === 0, errors };
}
