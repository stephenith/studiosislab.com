/**
 * ExecutionPackageAcknowledgement factory + checksum helpers (Agent #166).
 */
import { createHash, randomUUID } from "node:crypto";
import type { ExecutionPackage } from "./execution-package-types.js";
import type {
  ExecutionPackageAcknowledgement,
  PackageAckDecisionInput,
  PackageRevisionProposal,
} from "./execution-package-ack-types.js";
import {
  EXECUTION_PACKAGE_ACK_SCHEMA_VERSION,
  PACKAGE_ACK_FOUNDER_ACTOR,
} from "./execution-package-ack-types.js";
import { decisionToAckStatus } from "./ExecutionPackageAckStateMachine.js";

/**
 * Canonical checksum of an execution package (excludes checksum field).
 */
export function computeExecutionPackageChecksum(
  pkg: Omit<ExecutionPackage, "checksum"> | ExecutionPackage,
): string {
  const { checksum: _ignored, ...rest } = pkg as ExecutionPackage & {
    checksum?: string;
  };
  const canonical = JSON.stringify(rest, Object.keys(rest).sort());
  return createHash("sha256").update(canonical).digest("hex");
}

export function createExecutionPackageAcknowledgement(
  input: PackageAckDecisionInput & {
    execution_id: string;
    reason: string;
    notes: string;
  },
): ExecutionPackageAcknowledgement {
  const now = new Date().toISOString();
  let revision: PackageRevisionProposal | null = null;
  if (input.decision === "CHANGES_REQUESTED") {
    revision = {
      proposal_id: `prev-${randomUUID().slice(0, 8)}`,
      mission_id: input.mission_id,
      package_id: input.package_id,
      package_version: input.execution_package_version,
      feedback: input.notes,
      created_at: now,
      auto_revise: false,
      status: "PROPOSED",
    };
  }

  const resulting = decisionToAckStatus(input.decision);

  return {
    schema_version: EXECUTION_PACKAGE_ACK_SCHEMA_VERSION,
    acknowledgement_id: `pack-${now.slice(0, 10).replace(/-/g, "")}-${randomUUID().slice(0, 8)}`,
    mission_id: input.mission_id,
    mission_version: input.mission_version,
    execution_id: input.execution_id,
    package_id: input.package_id,
    execution_package_version: input.execution_package_version,
    execution_package_checksum: input.execution_package_checksum,
    founder_actor: input.actor || PACKAGE_ACK_FOUNDER_ACTOR,
    decision: input.decision,
    reason: input.reason,
    notes: input.notes,
    created_at: now,
    acknowledged_at: input.decision === "ACKNOWLEDGED" ? now : null,
    consumed_at: null,
    status: "RECORDED",
    resulting_status: resulting,
    execution_allowed: false,
    queue_enqueue_allowed: false,
    publishing_allowed: false,
    next_safe_action:
      input.decision === "ACKNOWLEDGED"
        ? "Prepare acknowledged execution package for queue insertion review"
        : input.decision === "CHANGES_REQUESTED"
          ? "Review package revision proposal — do not auto-revise"
          : "Package rejected — no automatic regeneration",
    revision_proposal: revision,
    supersedes_acknowledgement_id: null,
    fixture: input.fixture,
  };
}
