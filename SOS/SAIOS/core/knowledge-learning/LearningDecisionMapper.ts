/**
 * Map founder decisions → learning categories — Agent #125.
 */
import type { FounderDecision } from "../founder-decisions/types.js";
import type { LearningCategory } from "./types.js";

export function mapDecisionToLearningCategories(
  decision: FounderDecision,
): LearningCategory[] {
  switch (decision.decision) {
    case "APPROVED":
      return ["approved_pattern", "quality_observation", "founder_preference_signal"];
    case "REJECTED":
      return ["rejected_pattern", "quality_observation"];
    case "CHANGES_REQUESTED":
      return ["revision_instruction", "founder_preference_signal"];
  }
}
