/**
 * SystemReadinessCertificate — factory + checksum (Agent #171).
 * Platform consolidation (Agent #173): shared checksum helper.
 */
import { randomUUID } from "node:crypto";
import type {
  ChecksumChain,
  SafetyFlags,
  SystemReadinessCertificate,
  SystemReadinessStatus,
  VerificationSummary,
  LifecycleTimelineEntry,
} from "./system-readiness-types.js";
import {
  ARCHITECTURE_VERSION,
  GOVERNANCE_VERSION,
  SYSTEM_READINESS_FOUNDER,
  SYSTEM_READINESS_SCHEMA_VERSION,
} from "./system-readiness-types.js";
import { sha256Canonical } from "../../platform/checksums/index.js";

export const SAFETY_FLAGS_LOCKED: SafetyFlags = {
  execution_allowed: false,
  dispatch_allowed: false,
  scheduler_allowed: false,
  worker_execution_allowed: false,
  queue_insert_allowed: false,
  provider_allowed: false,
  publishing_allowed: false,
  live_enabled: false,
};

export function computeCertificateChecksum(
  cert: Omit<SystemReadinessCertificate, "checksum_chain"> & {
    checksum_chain: Omit<ChecksumChain, "certificate_checksum">;
  },
): string {
  return sha256Canonical(cert);
}

export function createSystemReadinessCertificate(input: {
  mission_id: string;
  mission_version: number;
  runtime_plan_id: string;
  runtime_release_id: string;
  shadow_queue_id: string;
  submission_id: string;
  checksum_chain: Omit<ChecksumChain, "certificate_checksum">;
  current_lifecycle: string;
  certificate_status: SystemReadinessStatus;
  lifecycle_timeline: LifecycleTimelineEntry[];
  verification_summary: VerificationSummary;
  reports_present: string[];
  blockers: string[];
  readiness_score: number;
  fixture?: boolean;
}): SystemReadinessCertificate {
  const now = new Date().toISOString();
  const draft = {
    schema_version: SYSTEM_READINESS_SCHEMA_VERSION,
    certificate_id: `srcert-${now.slice(0, 10).replace(/-/g, "")}-${randomUUID().slice(0, 8)}`,
    mission_id: input.mission_id,
    mission_version: input.mission_version,
    runtime_plan_id: input.runtime_plan_id,
    runtime_release_id: input.runtime_release_id,
    shadow_queue_id: input.shadow_queue_id,
    submission_id: input.submission_id,
    architecture_version: ARCHITECTURE_VERSION,
    governance_version: GOVERNANCE_VERSION,
    validated_at: now,
    founder: SYSTEM_READINESS_FOUNDER,
    current_lifecycle: input.current_lifecycle,
    certificate_status: input.certificate_status,
    lifecycle_timeline: input.lifecycle_timeline,
    safety_flags: SAFETY_FLAGS_LOCKED,
    verification_summary: input.verification_summary,
    reports_present: input.reports_present,
    blockers: input.blockers,
    readiness_score: input.readiness_score,
    next_safe_action:
      input.certificate_status === "SYSTEM_READY"
        ? "Governance spine frozen · STOP — execution remains impossible"
        : "Resolve blockers · STOP — do not execute",
    planning_notes: [
      "System Readiness Freeze V1 (Agent #171)",
      "Certificate is not execution authorization",
      "LIVE OFF · scheduler/workers/providers/publishing disabled",
    ],
    fixture: input.fixture || undefined,
    checksum_chain: input.checksum_chain,
  };

  const certificate_checksum = computeCertificateChecksum(draft);
  return {
    ...draft,
    checksum_chain: {
      ...input.checksum_chain,
      certificate_checksum,
    },
  };
}
