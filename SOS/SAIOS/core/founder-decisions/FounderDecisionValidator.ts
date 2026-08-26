/**
 * Validate founder decisions — Agent #125.
 */
import type { DecisionInput, FounderDecisionKind } from "./types.js";

const ALLOWED: FounderDecisionKind[] = [
  "APPROVED",
  "REJECTED",
  "CHANGES_REQUESTED",
];

export function validateDecisionInput(input: DecisionInput): {
  ok: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  if (!input.review_id) errors.push("review_id required");
  if (!input.task_id) errors.push("task_id required");
  if (!input.cycle_id) errors.push("cycle_id required");
  if (!ALLOWED.includes(input.decision)) {
    errors.push(`decision must be one of ${ALLOWED.join(", ")}`);
  }
  if (!input.reason || !input.reason.trim()) {
    errors.push("reason required");
  }
  if (input.decision === "CHANGES_REQUESTED") {
    const changes = input.requested_changes ?? [];
    if (!changes.length && !input.reason.trim()) {
      errors.push("CHANGES_REQUESTED requires requested_changes or reason text");
    }
    if (!changes.length) {
      // reason alone is acceptable if treated as the change request
      if (input.reason.trim().length < 8) {
        errors.push("CHANGES_REQUESTED requires substantial feedback");
      }
    }
  }
  if (input.decision === "REJECTED" && input.reason.trim().length < 4) {
    errors.push("REJECTED requires a reason");
  }
  if (process.env.SOS_AIOS_LIVE === "1") {
    errors.push("LIVE must be OFF for founder decisions in V1");
  }
  return { ok: errors.length === 0, errors };
}

export function nextActionFor(decision: FounderDecisionKind): string {
  switch (decision) {
    case "APPROVED":
      return "Prepare resume template for real-provider validation";
    case "REJECTED":
      return "Review rejected-pattern learning";
    case "CHANGES_REQUESTED":
      return "Prepare revision task from founder feedback";
  }
}

export function assertImmutable(
  existing: { decision_id: string },
  attemptedEdit: boolean,
): void {
  if (attemptedEdit) {
    throw new Error(
      `Decision ${existing.decision_id} is immutable — create a superseding decision`,
    );
  }
}
