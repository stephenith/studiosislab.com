/**
 * Founder predictor — approval, revision, rejection, click, download, premium, success.
 */
import type { ComparisonReport, DimensionScore, FounderPredictions, LoadedTemplateContext } from "./types.js";

export function predictFounderOutcome(input: {
  ctx: LoadedTemplateContext;
  dimensions: DimensionScore[];
  comparison: ComparisonReport;
  overall_score: number;
}): FounderPredictions {
  const premium = input.ctx.premium_scores ?? {};
  const overall = input.overall_score;

  let founder_approval_probability = clamp(overall - 8);
  let founder_revision_probability = clamp(100 - overall + 5);
  let founder_rejection_probability = clamp(100 - overall - 10);

  if (!input.ctx.qa_pass) {
    founder_approval_probability = Math.min(founder_approval_probability, 40);
    founder_rejection_probability = Math.max(founder_rejection_probability, 55);
  }

  if (overall >= 98) {
    founder_approval_probability = clamp(overall - 2);
    founder_revision_probability = clamp(12);
    founder_rejection_probability = clamp(5);
  } else if (overall >= 95) {
    founder_revision_probability = clamp(45);
    founder_rejection_probability = clamp(15);
  } else {
    founder_rejection_probability = clamp(60);
    founder_approval_probability = clamp(30);
  }

  const total = founder_approval_probability + founder_revision_probability + founder_rejection_probability;
  founder_approval_probability = clamp(Math.round((founder_approval_probability / total) * 100));
  founder_revision_probability = clamp(Math.round((founder_revision_probability / total) * 100));
  founder_rejection_probability = clamp(100 - founder_approval_probability - founder_revision_probability);

  const user_click_probability = clamp(
    typeof premium.click_prediction === "number" ? premium.click_prediction : overall - 3,
  );
  const user_download_probability = clamp(
    typeof premium.download_prediction === "number" ? premium.download_prediction : overall - 1,
  );
  const premium_perception = clamp(
    typeof premium.premium_score === "number"
      ? Math.round((premium.premium_score + (premium.dna_alignment_score ?? premium.premium_score)) / 2)
      : overall,
  );
  const recruiter_appeal = clamp(
    avgDimension(input.dimensions, ["recruiter_friendliness", "ats_friendliness", "professional_appearance"]),
  );
  const overall_success_prediction = clamp(
    Math.round(
      (founder_approval_probability +
        user_click_probability +
        user_download_probability +
        premium_perception +
        recruiter_appeal +
        input.comparison.benchmark_alignment_score) /
        6,
    ),
  );

  return {
    founder_approval_probability,
    founder_revision_probability,
    founder_rejection_probability,
    user_click_probability,
    user_download_probability,
    premium_perception,
    recruiter_appeal,
    overall_success_prediction,
    computed_at: new Date().toISOString(),
  };
}

function avgDimension(dimensions: DimensionScore[], keys: string[]): number {
  const relevant = dimensions.filter((d) => keys.includes(d.dimension));
  if (relevant.length === 0) return 85;
  return Math.round(relevant.reduce((a, d) => a + d.score, 0) / relevant.length);
}

function clamp(n: number): number {
  return Math.min(100, Math.max(0, Math.round(n)));
}
