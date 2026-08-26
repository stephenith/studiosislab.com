/**
 * Render scorer — overall, premium, recruiter scores from dimensions.
 */
import type { DimensionScore, RenderScores, FounderApprovalPrediction } from "./types.js";
import { RENDER_SCORE_GATE } from "./types.js";

export function computeRenderScores(dimensions: DimensionScore[]): RenderScores {
  const avg = (keys: string[]) => {
    const items = dimensions.filter((d) => keys.includes(d.dimension));
    if (!items.length) return 90;
    return Math.round(items.reduce((a, d) => a + d.score, 0) / items.length);
  };

  const premiumDims = [
    "overall_premium_impression",
    "premium_appearance",
    "executive_appearance",
    "whitespace_distribution",
    "color_harmony",
  ];
  const recruiterDims = [
    "recruiter_eye_flow",
    "scan_speed",
    "section_hierarchy",
    "information_grouping",
    "professional_trust_score",
  ];

  const overall = Math.round(
    dimensions.reduce((a, d) => a + d.score, 0) / dimensions.length,
  );
  const premium = avg(premiumDims);
  const recruiter = avg(recruiterDims);

  const founder_approval_prediction = predictFounder(overall, premium, recruiter);

  return {
    overall_render_score: overall,
    premium_score: premium,
    recruiter_score: recruiter,
    founder_approval_prediction,
    computed_at: new Date().toISOString(),
  };
}

function predictFounder(
  overall: number,
  premium: number,
  recruiter: number,
): FounderApprovalPrediction {
  const composite = Math.round((overall + premium + recruiter) / 3);
  if (composite < 88) return "REJECT";
  if (composite < 95) return "REVISION";
  if (composite < 98) return "REVISION";
  return "LIKELY APPROVE";
}

export function qualityGatePass(scores: RenderScores): boolean {
  return scores.overall_render_score >= RENDER_SCORE_GATE;
}
