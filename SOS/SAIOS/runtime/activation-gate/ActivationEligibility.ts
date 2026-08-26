/**
 * ActivationEligibility — activation-eligibility-1.0.0 (Agent #185).
 */
import { randomUUID } from "node:crypto";
import { sha256Canonical } from "../../platform/checksums/index.js";
import type {
  ActivationChecklistItem,
  ActivationEligibilityContract,
  ActivationLifecycleStatus,
  ActivationScorecard,
} from "./ActivationGateTypes.js";
import {
  ACTIVATION_ELIGIBILITY_SCHEMA_VERSION,
  ACTIVATION_GATE_SAFETY_FLAGS,
} from "./ActivationGateTypes.js";

export function computeEligibilityChecksum(
  record: Omit<ActivationEligibilityContract, "checksums"> & {
    checksums: {
      eligibility_checksum: string;
      checklist_checksum: string;
      certificate_checksum: string | null;
    };
  },
): string {
  const { checksums: _c, ...rest } = record;
  return sha256Canonical({
    ...rest,
    checksums: {
      checklist_checksum: record.checksums.checklist_checksum,
      certificate_checksum: record.checksums.certificate_checksum,
    },
  });
}

export function computeChecklistChecksum(
  checklist: ActivationChecklistItem[],
): string {
  return sha256Canonical({ checklist });
}

export function createActivationEligibility(input: {
  mission_id: string;
  controller_id?: string | null;
  checklist: ActivationChecklistItem[];
  score: ActivationScorecard;
  blocking_items: string[];
  warnings: string[];
  recommendations: string[];
  status: ActivationLifecycleStatus;
  outcome?: "ACTIVATION_BLOCKED" | "ACTIVATION_ELIGIBLE" | null;
  certificate_checksum?: string | null;
  version?: string;
  notes?: string[];
  fixture?: boolean;
  activation_id?: string;
  created_at?: string;
}): ActivationEligibilityContract {
  const now = new Date().toISOString();
  const checklist_checksum = computeChecklistChecksum(input.checklist);
  const draft: ActivationEligibilityContract = {
    schema_version: ACTIVATION_ELIGIBILITY_SCHEMA_VERSION,
    activation_id:
      input.activation_id ??
      `act-${now.slice(0, 10).replace(/-/g, "")}-${randomUUID().slice(0, 8)}`,
    mission_id: input.mission_id,
    controller_id: input.controller_id ?? null,
    checklist: input.checklist,
    score: input.score,
    blocking_items: input.blocking_items,
    warnings: input.warnings,
    recommendations: input.recommendations,
    status: input.status,
    outcome:
      input.outcome ??
      (input.status === "ACTIVATION_BLOCKED" ||
      input.status === "ACTIVATION_ELIGIBLE"
        ? input.status
        : null),
    checksums: {
      eligibility_checksum: "",
      checklist_checksum,
      certificate_checksum: input.certificate_checksum ?? null,
    },
    version: input.version ?? "1.0.0",
    safety_flags: { ...ACTIVATION_GATE_SAFETY_FLAGS },
    execution_enabled: false,
    live_enabled: false,
    created_at: input.created_at ?? now,
    updated_at: now,
    next_safe_action:
      "Review Activation Gate · eligibility only · execution remains disabled",
    notes: input.notes ?? [
      "Activation Gate computes eligibility only.",
      "ACTIVATION_ELIGIBLE does not enable execution.",
    ],
    fixture: input.fixture,
  };
  draft.checksums.eligibility_checksum = computeEligibilityChecksum(draft);
  return draft;
}
