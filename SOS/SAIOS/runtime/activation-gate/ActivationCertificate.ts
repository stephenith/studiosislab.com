/**
 * ActivationCertificate — activation-certificate-1.0.0 (Agent #185).
 * Immutable. No execution permissions.
 */
import { randomUUID } from "node:crypto";
import { sha256Canonical } from "../../platform/checksums/index.js";
import type {
  ActivationCertificateContract,
  ActivationChecklistItem,
} from "./ActivationGateTypes.js";
import {
  ACTIVATION_CERTIFICATE_SCHEMA_VERSION,
  ACTIVATION_GATE_SAFETY_FLAGS,
  ARCHITECTURE_VERSION,
} from "./ActivationGateTypes.js";

export function computeCertificateChecksum(
  record: Omit<ActivationCertificateContract, "certificate_checksum"> & {
    certificate_checksum: string;
  },
): string {
  const { certificate_checksum: _c, ...rest } = record;
  return sha256Canonical(rest);
}

export function createActivationCertificate(input: {
  activation_id: string;
  mission_id: string;
  overall_score: number;
  all_checks: ActivationChecklistItem[];
  status: "ACTIVATION_BLOCKED" | "ACTIVATION_ELIGIBLE";
  notes?: string[];
  fixture?: boolean;
  certificate_id?: string;
  generated_at?: string;
}): ActivationCertificateContract {
  const now = input.generated_at ?? new Date().toISOString();
  const draft: ActivationCertificateContract = {
    schema_version: ACTIVATION_CERTIFICATE_SCHEMA_VERSION,
    certificate_id:
      input.certificate_id ??
      `acrt-${now.slice(0, 10).replace(/-/g, "")}-${randomUUID().slice(0, 8)}`,
    activation_id: input.activation_id,
    mission_id: input.mission_id,
    overall_score: input.overall_score,
    all_checks: input.all_checks,
    architecture_version: ARCHITECTURE_VERSION,
    generated_at: now,
    status: input.status,
    certificate_checksum: "",
    execution_permissions: false,
    safety_flags: { ...ACTIVATION_GATE_SAFETY_FLAGS },
    notes: input.notes ?? [
      "Certificate records eligibility outcome only.",
      "execution_permissions is always false.",
    ],
    fixture: input.fixture,
  };
  draft.certificate_checksum = computeCertificateChecksum(draft);
  return draft;
}
