/**
 * SimulationCertificate — Agent #187.
 */
import { randomUUID } from "node:crypto";
import { sha256Canonical } from "../../platform/checksums/index.js";
import type {
  PreDispatchSimulationCertificate,
  SimulationIntegrityScores,
} from "./SimulationTypes.js";
import {
  PRE_DISPATCH_SIMULATION_CERTIFICATE_SCHEMA_VERSION,
  PRE_DISPATCH_SIMULATION_SAFETY_FLAGS,
} from "./SimulationTypes.js";

export function computeSimulationCertificateChecksum(
  record: Omit<PreDispatchSimulationCertificate, "certificate_checksum"> & {
    certificate_checksum: string;
  },
): string {
  const { certificate_checksum: _c, ...rest } = record;
  return sha256Canonical(rest);
}

export function createSimulationCertificate(input: {
  simulation_id: string;
  mission_id: string;
  scores: SimulationIntegrityScores;
  notes?: string[];
  fixture?: boolean;
  certificate_id?: string;
  generated_at?: string;
}): PreDispatchSimulationCertificate {
  const now = input.generated_at ?? new Date().toISOString();
  const draft: PreDispatchSimulationCertificate = {
    schema_version: PRE_DISPATCH_SIMULATION_CERTIFICATE_SCHEMA_VERSION,
    certificate_id:
      input.certificate_id ??
      `pscrt-${now.slice(0, 10).replace(/-/g, "")}-${randomUUID().slice(0, 8)}`,
    simulation_id: input.simulation_id,
    mission_id: input.mission_id,
    scores: input.scores,
    generated_at: now,
    certificate_checksum: "",
    execution_permissions: false,
    safety_flags: { ...PRE_DISPATCH_SIMULATION_SAFETY_FLAGS },
    notes: input.notes ?? [
      "Pre-dispatch simulation certificate — metadata only.",
      "execution_permissions is always false.",
    ],
    fixture: input.fixture,
  };
  draft.certificate_checksum = computeSimulationCertificateChecksum(draft);
  return draft;
}
