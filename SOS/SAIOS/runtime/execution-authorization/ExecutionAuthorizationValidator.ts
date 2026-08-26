/**
 * ExecutionAuthorizationValidator — Agent #186.
 */
import { rejectForbiddenKeys } from "../../platform/checksums/index.js";
import { sha256Canonical } from "../../platform/checksums/index.js";
import type {
  ExecutionAuthorizationCertificateContract,
  ExecutionAuthorizationContract,
  ExecutionAuthorizationValidationIssue,
  ExecutionAuthorizationValidationResult,
} from "./ExecutionAuthorizationTypes.js";
import { computeAuthorizationCertificateChecksum } from "./ExecutionAuthorizationCertificate.js";

export function computeAuthorizationChecksum(
  record: Omit<ExecutionAuthorizationContract, "checksums"> & {
    checksums: {
      authorization_checksum: string;
      request_checksum: string | null;
      decision_checksum: string | null;
      certificate_checksum: string | null;
    };
  },
): string {
  const { checksums: _c, ...rest } = record;
  return sha256Canonical({
    ...rest,
    checksums: {
      request_checksum: record.checksums.request_checksum,
      decision_checksum: record.checksums.decision_checksum,
      certificate_checksum: record.checksums.certificate_checksum,
    },
  });
}

export const EXECUTION_AUTHORIZATION_FORBIDDEN_KEYS = [
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
  "override_activation",
] as const;

export function rejectForbiddenAuthorizationPayload(
  payload: Record<string, unknown>,
): ExecutionAuthorizationValidationIssue | null {
  return rejectForbiddenKeys(payload, EXECUTION_AUTHORIZATION_FORBIDDEN_KEYS, {
    messageForKey: (key) =>
      `Field '${key}' is forbidden on execution authorization`,
  });
}

export function validateExecutionAuthorization(
  record: ExecutionAuthorizationContract | null,
): ExecutionAuthorizationValidationResult {
  const errors: ExecutionAuthorizationValidationIssue[] = [];
  if (!record) {
    return {
      ok: false,
      errors: [{ code: "MISSING", message: "Authorization record missing" }],
    };
  }
  const forbidden = rejectForbiddenAuthorizationPayload(
    record as unknown as Record<string, unknown>,
  );
  if (forbidden) errors.push(forbidden);

  if (record.schema_version !== "execution-authorization-1.0.0") {
    errors.push({
      code: "BAD_SCHEMA",
      message: "schema must be execution-authorization-1.0.0",
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
  if (record.overrides_activation_gate !== false) {
    errors.push({
      code: "OVERRIDES_GATE",
      message: "overrides_activation_gate must be false",
      field: "overrides_activation_gate",
    });
  }
  if (record.safety_flags.authorization_enables_execution !== false) {
    errors.push({
      code: "AUTH_ENABLES_EXEC",
      message: "authorization_enables_execution must be false",
      field: "safety_flags.authorization_enables_execution",
    });
  }
  const expected = computeAuthorizationChecksum({
    ...record,
    checksums: { ...record.checksums, authorization_checksum: "" },
  });
  if (record.checksums.authorization_checksum !== expected) {
    errors.push({
      code: "CHECKSUM_MISMATCH",
      message: "authorization checksum mismatch",
      field: "checksums.authorization_checksum",
    });
  }
  return { ok: errors.length === 0, errors };
}

export function validateExecutionAuthorizationCertificate(
  cert: ExecutionAuthorizationCertificateContract | null,
): ExecutionAuthorizationValidationResult {
  const errors: ExecutionAuthorizationValidationIssue[] = [];
  if (!cert) {
    return {
      ok: false,
      errors: [{ code: "MISSING", message: "Certificate missing" }],
    };
  }
  if (cert.schema_version !== "execution-authorization-certificate-1.0.0") {
    errors.push({
      code: "BAD_SCHEMA",
      message: "schema must be execution-authorization-certificate-1.0.0",
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
  const expected = computeAuthorizationCertificateChecksum({
    ...cert,
    checksums: { ...cert.checksums, certificate_checksum: "" },
  });
  if (cert.checksums.certificate_checksum !== expected) {
    errors.push({
      code: "CHECKSUM_MISMATCH",
      message: "certificate checksum mismatch",
      field: "checksums.certificate_checksum",
    });
  }
  return { ok: errors.length === 0, errors };
}
