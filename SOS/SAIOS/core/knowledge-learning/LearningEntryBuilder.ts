/**
 * Build learning entries from founder decisions — Agent #125.
 */
import { randomUUID } from "node:crypto";
import type { FounderDecision } from "../founder-decisions/types.js";
import { mapDecisionToLearningCategories } from "./LearningDecisionMapper.js";
import type { LearningEntry } from "./types.js";

export function buildLearningEntries(
  decision: FounderDecision,
): LearningEntry[] {
  if (decision.fixture) return []; // fixtures never enter real learning

  const categories = mapDecisionToLearningCategories(decision);
  const now = new Date().toISOString();

  return categories.map((category, i) => {
    let subject = `${decision.department}:${category}`;
    let observation = decision.reason;
    if (category === "revision_instruction") {
      observation = decision.requested_changes.join("; ") || decision.reason;
      subject = `revision:${decision.task_id}`;
    }
    if (category === "approved_pattern") {
      subject = `approved:${decision.task_id}`;
      observation = `Founder approved dry-run planning. ${decision.reason}`;
    }
    if (category === "rejected_pattern") {
      subject = `rejected:${decision.task_id}`;
      observation = `Founder rejected dry-run output. ${decision.reason}`;
    }

    return {
      learning_id: `ln-${randomUUID().slice(0, 12)}-${i}`,
      source_decision_id: decision.decision_id,
      source_review_id: decision.review_id,
      source_task_id: decision.task_id,
      department: decision.department,
      category,
      subject,
      observation,
      evidence_references: [...decision.reviewed_artifacts],
      confidence: "confirmed",
      applicability: [decision.department, "resume.layout_planning"],
      approved_by_founder: true,
      supersedes: null,
      created_at: now,
      version: "1.0.0",
      fixture: false,
    };
  });
}
