/**
 * Build immutable FounderDecision records — Agent #125.
 */
import { randomUUID } from "node:crypto";
import type { DecisionInput, FounderDecision } from "./types.js";
import { nextActionFor, validateDecisionInput } from "./FounderDecisionValidator.js";

export function createFounderDecision(input: DecisionInput): FounderDecision {
  const validation = validateDecisionInput(input);
  if (!validation.ok) {
    throw new Error(`Invalid decision: ${validation.errors.join("; ")}`);
  }

  const requested =
    input.decision === "CHANGES_REQUESTED"
      ? (input.requested_changes?.length
          ? [...input.requested_changes]
          : [input.reason.trim()])
      : (input.requested_changes ?? []);

  return {
    decision_id: `fd-${randomUUID().slice(0, 12)}`,
    review_id: input.review_id,
    task_id: input.task_id,
    cycle_id: input.cycle_id,
    department: input.department ?? "resume",
    decision: input.decision,
    founder_actor: input.founder_actor ?? "stephen",
    reason: input.reason.trim(),
    structured_feedback: { ...(input.structured_feedback ?? {}) },
    quality_scores: { ...(input.quality_scores ?? {}) },
    requested_changes: requested,
    reviewed_artifacts: [
      ...(input.reviewed_artifacts ?? [
        "SOS/07_LOGS/saios/first-dry-run/provider-response.json",
        "SOS/07_LOGS/saios/first-dry-run/qa-summary.json",
        "SOS/07_LOGS/saios/first-dry-run/execution-timeline.json",
      ]),
    ],
    provider: input.provider ?? "Mock",
    dry_run: true,
    created_at: new Date().toISOString(),
    source_interface: "aios_dashboard",
    publication_allowed: false,
    next_action: nextActionFor(input.decision),
    supersedes: input.supersedes ?? null,
    fixture: input.fixture ?? false,
  };
}
