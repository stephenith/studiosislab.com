/**
 * MissionDecision factory — immutable decision records (Agent #163).
 */
import { randomUUID } from "node:crypto";
import type {
  MissionDecision,
  MissionDecisionInput,
  MissionDecisionKind,
  MissionRevisionProposal,
} from "./mission-decision-types.js";
import {
  MISSION_DECISION_SCHEMA_VERSION,
  MISSION_FOUNDER_ACTOR,
} from "./mission-decision-types.js";

function nextSafeAction(kind: MissionDecisionKind): string | null {
  if (kind === "APPROVED") {
    return "Open Queue Admission Readiness Review (no enqueue)";
  }
  if (kind === "CHANGES_REQUESTED") {
    return "Review revision proposal — do not auto-revise";
  }
  if (kind === "REJECTED") {
    return "Mission rejected — no automatic replacement";
  }
  return null;
}

export function createMissionDecision(
  input: MissionDecisionInput & {
    reason: string;
    feedback: string;
  },
): MissionDecision {
  const now = new Date().toISOString();
  let revision: MissionRevisionProposal | null = null;
  if (input.decision === "CHANGES_REQUESTED") {
    revision = {
      proposal_id: `mrev-${randomUUID().slice(0, 8)}`,
      mission_id: input.mission_id,
      mission_version: input.mission_version,
      feedback: input.feedback,
      created_at: now,
      auto_revise: false,
      status: "PROPOSED",
    };
  }

  return {
    schema_version: MISSION_DECISION_SCHEMA_VERSION,
    decision_id: `mdec-${now.slice(0, 10).replace(/-/g, "")}-${randomUUID().slice(0, 8)}`,
    mission_id: input.mission_id,
    mission_version: input.mission_version,
    decision: input.decision,
    actor: input.actor || MISSION_FOUNDER_ACTOR,
    reason: input.reason,
    feedback: input.feedback,
    created_at: now,
    consumed_at: null,
    status: "RECORDED",
    execution_allowed: false,
    queue_admission_allowed: false,
    publishing_allowed: false,
    next_safe_action: nextSafeAction(input.decision),
    revision_proposal: revision,
    supersedes_decision_id: null,
    fixture: input.fixture,
  };
}
