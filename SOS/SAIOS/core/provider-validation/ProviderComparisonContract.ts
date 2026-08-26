/**
 * ProviderComparisonContract — locked Mock vs Real comparison contract.
 */
import { buildComparisonScorecard, COMPARISON_DIMENSIONS } from "./ComparisonScorecard.js";

export function buildProviderComparisonContract(validationId: string | null) {
  const scorecard = buildComparisonScorecard();
  return {
    contract_id: `pcc-${validationId ?? "pending"}`,
    version: "1.0.0",
    validation_id: validationId,
    created_at: new Date().toISOString(),
    same_input_required: true,
    provider_specific_prompt_changes_forbidden: true,
    sides: {
      baseline: "mock",
      challenger: "real_provider_future",
    },
    shared_pipeline: [
      "objective",
      "Knowledge Snapshot",
      "Skill request",
      "expected response schema",
      "DesignBrief mapping",
      "deterministic renderer",
      "editor compatibility",
      "Resume Critic",
      "Critic Gate",
    ],
    dimensions: COMPARISON_DIMENSIONS,
    scorecard_version: scorecard.version,
    publication_allowed: false,
    live: false,
    dry_run: true,
  };
}

export class ProviderComparisonEngine {
  /** Scorecard-only in Agent #134 — no real side yet. */
  describePendingComparison(validationId: string | null) {
    return {
      status: "AWAITING_REAL_PROVIDER_SIDE",
      contract: buildProviderComparisonContract(validationId),
      real_side_executed: false,
      message:
        "Comparison engine ready. Real provider side blocked until configuration + one-time founder authorization.",
    };
  }
}
