/**
 * ExecutionAuthorizationCertificate — Agent #186.
 * Immutable. execution_permissions always false.
 */
import { randomUUID } from "node:crypto";
import { sha256Canonical } from "../../platform/checksums/index.js";
import type { ExecutionAuthorizationCertificateContract } from "./ExecutionAuthorizationTypes.js";
import {
  EXECUTION_AUTHORIZATION_CERTIFICATE_SCHEMA_VERSION,
  EXECUTION_AUTHORIZATION_SAFETY_FLAGS,
} from "./ExecutionAuthorizationTypes.js";

export function computeAuthorizationCertificateChecksum(
  record: Omit<
    ExecutionAuthorizationCertificateContract,
    "checksums"
  > & {
    checksums: {
      certificate_checksum: string;
      authorization_checksum: string;
    };
  },
): string {
  const { checksums: _c, ...rest } = record;
  return sha256Canonical({
    ...rest,
    checksums: {
      authorization_checksum: record.checksums.authorization_checksum,
    },
  });
}

export function createExecutionAuthorizationCertificate(input: {
  authorization_id: string;
  mission_id: string;
  activation_reference?: string | null;
  status: "AUTHORIZED" | "REJECTED" | "WAITING_FOUNDER";
  authorization_checksum: string;
  notes?: string[];
  fixture?: boolean;
  certificate_id?: string;
  generated_at?: string;
}): ExecutionAuthorizationCertificateContract {
  const now = input.generated_at ?? new Date().toISOString();
  const draft: ExecutionAuthorizationCertificateContract = {
    schema_version: EXECUTION_AUTHORIZATION_CERTIFICATE_SCHEMA_VERSION,
    certificate_id:
      input.certificate_id ??
      `eacrt-${now.slice(0, 10).replace(/-/g, "")}-${randomUUID().slice(0, 8)}`,
    authorization_id: input.authorization_id,
    mission_id: input.mission_id,
    activation_reference: input.activation_reference ?? null,
    status: input.status,
    checksums: {
      certificate_checksum: "",
      authorization_checksum: input.authorization_checksum,
    },
    generated_at: now,
    execution_permissions: false,
    safety_flags: { ...EXECUTION_AUTHORIZATION_SAFETY_FLAGS },
    notes: input.notes ?? [
      "Certificate records founder authorization intent only.",
      "execution_permissions is always false.",
      "Does not override Activation Gate.",
    ],
    fixture: input.fixture,
  };
  draft.checksums.certificate_checksum =
    computeAuthorizationCertificateChecksum(draft);
  return draft;
}
