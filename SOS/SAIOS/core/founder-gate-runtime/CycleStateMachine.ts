/**
 * CycleStateMachine — validated transitions only.
 */
import { ALLOWED_TRANSITIONS, type CycleState } from "./types.js";

export function canTransition(from: CycleState, to: CycleState): boolean {
  return (ALLOWED_TRANSITIONS[from] ?? []).includes(to);
}

export function assertTransition(from: CycleState, to: CycleState): void {
  if (!canTransition(from, to)) {
    throw new Error(`Illegal cycle transition ${from} → ${to}`);
  }
}

export function decisionToState(
  decision: "APPROVED" | "REJECTED" | "CHANGES_REQUESTED",
): CycleState {
  return decision;
}

export function terminalAfterLearning(decision: CycleState): CycleState {
  if (decision === "CHANGES_REQUESTED") return "COMPLETED_WITH_REVISION_PROPOSED";
  return "COMPLETED";
}
