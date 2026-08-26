/**
 * ActivationValidator — Agent #185.
 */
import { rejectForbiddenKeys } from "../../platform/checksums/index.js";
import type {
  ActivationCertificateContract,
  ActivationEligibilityContract,
  ActivationValidationIssue,
  ActivationValidationResult,
} from "./ActivationGateTypes.js";
import { computeEligibilityChecksum } from "./ActivationEligibility.js";
import { computeCertificateChecksum } from "./ActivationCertificate.js";

export const ACTIVATION_FORBIDDEN_KEYS = [
  "execute",
  "dispatch",
  "scheduler",
  "enqueue",
  "spawn",
  "provider",
  "publish",
  "enable_live",
  "enable_execution",
  "unlock",
] as const;

export function rejectForbiddenActivationPayload(
  payload: Record<string, unknown>,
): ActivationValidationIssue | null {
  return rejectForbiddenKeys(payload, ACTIVATION_FORBIDDEN_KEYS, {
    messageForKey: (key) => `Field '${key}' is forbidden on activation gate`,
  });
}

export function validateActivationEligibility(
  record: ActivationEligibilityContract | null,
): ActivationValidationResult {
  const errors: ActivationValidationIssue[] = [];
  if (!record) {
    return {
      ok: false,
      errors: [{ code: "MISSING", message: "Eligibility record missing" }],
    };
  }
  const forbidden = rejectForbiddenActivationPayload(
    record as unknown as Record<string, unknown>,
  );
  if (forbidden) errors.push(forbidden);

  if (record.schema_version !== "activation-eligibility-1.0.0") {
    errors.push({
      code: "BAD_SCHEMA",
      message: "schema must be activation-eligibility-1.0.0",
      field: "schema_version",
    });
  }
  if (!record.mission_id?.trim()) {
    errors.push({
      code: "MISSING_MISSION",
      message: "mission_id required",
      field: "mission_id",
    });
  }
  if (record.execution_enabled !== false) {
    errors.push({
      code: "EXECUTION_UNLOCKED",
      message: "execution_enabled must be false",
      field: "execution_enabled",
    });
  }
  if (record.live_enabled !== false) {
    errors.push({
      code: "LIVE_UNLOCKED",
      message: "live_enabled must be false",
      field: "live_enabled",
    });
  }
  if (record.safety_flags.activation_enables_execution !== false) {
    errors.push({
      code: "ACTIVATION_ENABLES_EXEC",
      message: "activation_enables_execution must be false",
      field: "safety_flags.activation_enables_execution",
    });
  }
  const expected = computeEligibilityChecksum({
    ...record,
    checksums: { ...record.checksums, eligibility_checksum: "" },
  });
  if (record.checksums.eligibility_checksum !== expected) {
    errors.push({
      code: "CHECKSUM_MISMATCH",
      message: "eligibility checksum mismatch",
      field: "checksums.eligibility_checksum",
    });
  }
  return { ok: errors.length === 0, errors };
}

export function validateActivationCertificate(
  cert: ActivationCertificateContract | null,
): ActivationValidationResult {
  const errors: ActivationValidationIssue[] = [];
  if (!cert) {
    return {
      ok: false,
      errors: [{ code: "MISSING", message: "Certificate missing" }],
    };
  }
  if (cert.schema_version !== "activation-certificate-1.0.0") {
    errors.push({
      code: "BAD_SCHEMA",
      message: "schema must be activation-certificate-1.0.0",
      field: "schema_version",
    });
  }
  if (cert.execution_permissions !== false) {
    errors.push({
      code: "EXEC_PERMS",
      message: "execution_permissions must be false",
      field: "execution_permissions",
    });
  }
  const expected = computeCertificateChecksum({
    ...cert,
    certificate_checksum: "",
  });
  if (cert.certificate_checksum !== expected) {
    errors.push({
      code: "CHECKSUM_MISMATCH",
      message: "certificate checksum mismatch",
      field: "certificate_checksum",
    });
  }
  return { ok: errors.length === 0, errors };
}
