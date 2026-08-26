/**
 * FounderGateValidator
 */
import type { CycleCheckpoint, FounderDecisionKind } from "./types.js";
import { FOUNDER_ACTOR } from "./types.js";
import { verifyChecksum } from "./CycleCheckpoint.js";

export type DecisionLike = {
  decision_id: string;
  review_id: string;
  task_id: string;
  cycle_id: string;
  decision: FounderDecisionKind;
  founder_actor: string;
  publication_allowed: boolean;
  dry_run: boolean;
};

export function validateDecisionForCycle(
  decision: DecisionLike,
  checkpoint: CycleCheckpoint,
): { ok: boolean; errors: string[] } {
  const errors: string[] = [];
  if (checkpoint.state !== "WAITING_FOUNDER") {
    errors.push(`cycle not WAITING_FOUNDER (is ${checkpoint.state})`);
  }
  if (decision.review_id !== checkpoint.review_id) {
    errors.push("review_id mismatch");
  }
  if (decision.cycle_id !== checkpoint.cycle_id) {
    errors.push("cycle_id mismatch");
  }
  if (decision.task_id !== checkpoint.task_id) {
    errors.push("task_id mismatch");
  }
  if (decision.founder_actor !== FOUNDER_ACTOR) {
    errors.push(`founder_actor must be ${FOUNDER_ACTOR}`);
  }
  if (decision.publication_allowed !== false) {
    errors.push("publication_allowed must be false");
  }
  if (decision.dry_run !== true) {
    errors.push("dry_run must be true");
  }
  if (!verifyChecksum(checkpoint)) {
    errors.push("checkpoint checksum invalid");
  }
  return { ok: errors.length === 0, errors };
}
