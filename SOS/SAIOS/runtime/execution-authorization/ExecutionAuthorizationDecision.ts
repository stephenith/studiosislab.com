/**
 * ExecutionAuthorizationDecision — Agent #186.
 */
import { randomUUID } from "node:crypto";
import { sha256Canonical } from "../../platform/checksums/index.js";
import type { ExecutionAuthorizationDecisionContract } from "./ExecutionAuthorizationTypes.js";
import { EXECUTION_AUTHORIZATION_FOUNDER } from "./ExecutionAuthorizationTypes.js";

export function computeDecisionChecksum(
  record: Omit<ExecutionAuthorizationDecisionContract, "decision_checksum"> & {
    decision_checksum: string;
  },
): string {
  const { decision_checksum: _c, ...rest } = record;
  return sha256Canonical(rest);
}

export function createExecutionAuthorizationDecision(input: {
  authorization_id: string;
  mission_id: string;
  decision: "AUTHORIZED" | "REJECTED";
  reason: string;
  decided_at?: string;
  decision_id?: string;
  fixture?: boolean;
}): ExecutionAuthorizationDecisionContract {
  const now = input.decided_at ?? new Date().toISOString();
  const draft: ExecutionAuthorizationDecisionContract = {
    decision_id:
      input.decision_id ??
      `ead-${now.slice(0, 10).replace(/-/g, "")}-${randomUUID().slice(0, 8)}`,
    authorization_id: input.authorization_id,
    mission_id: input.mission_id,
    founder: EXECUTION_AUTHORIZATION_FOUNDER,
    decided_at: now,
    decision: input.decision,
    reason: input.reason,
    decision_checksum: "",
    fixture: input.fixture,
  };
  draft.decision_checksum = computeDecisionChecksum(draft);
  return draft;
}
