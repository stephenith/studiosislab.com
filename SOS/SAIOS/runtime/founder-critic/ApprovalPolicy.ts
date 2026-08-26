/**
 * Approval policy — gate before founder review. Never auto-approve.
 */
import type { ApprovalRecommendation, FounderPredictions } from "./types.js";

export function recommendApproval(input: {
  overall_score: number;
  qa_pass: boolean;
  predictions: FounderPredictions;
}): ApprovalRecommendation {
  let policy_band: ApprovalRecommendation["policy_band"] = "reject";
  let ready_for_founder_review = false;
  const rationale: string[] = [];

  if (input.overall_score < 95) {
    policy_band = "reject";
    rationale.push("Overall score below 95 — automatically rejected for founder review");
    rationale.push("Return to Premium Generator with improvement plan");
  } else if (input.overall_score < 98) {
    policy_band = "revision_recommended";
    rationale.push("Score 95–97 — revision recommended before founder review");
    rationale.push(`Founder revision probability: ${input.predictions.founder_revision_probability}%`);
    ready_for_founder_review = input.qa_pass;
  } else {
    policy_band = "recommend_founder_approval";
    rationale.push("Score 98+ — recommend founder approval review");
    rationale.push(`Founder approval probability: ${input.predictions.founder_approval_probability}%`);
    ready_for_founder_review = input.qa_pass;
  }

  if (!input.qa_pass) {
    ready_for_founder_review = false;
    policy_band = "reject";
    rationale.push("QA pipeline did not pass — blocked regardless of visual score");
  }

  const summary =
    policy_band === "reject"
      ? "NOT READY — do not send to founder review"
      : policy_band === "revision_recommended"
        ? "REVISION FIRST — address improvement plan, then founder review"
        : "READY FOR FOUNDER REVIEW — founder approval remains mandatory";

  return {
    overall_score: input.overall_score,
    policy_band,
    ready_for_founder_review,
    founder_approval_mandatory: true,
    summary,
    rationale,
  };
}
