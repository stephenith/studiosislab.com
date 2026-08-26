/**
 * Critic reporter — persist all founder critic artifacts.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import type {
  ApprovalRecommendation,
  ComparisonReport,
  FounderPredictions,
  FounderReview,
  ImprovementPlan,
} from "./types.js";

export const CRITIC_OUTPUT_ROOT = join(
  resolve(import.meta.dirname, "../../.."),
  "07_LOGS/saios/founder-critic",
);

export function persistCriticArtifacts(input: {
  output_dir: string;
  review: FounderReview;
  predictions: FounderPredictions;
  plan: ImprovementPlan;
  approval: ApprovalRecommendation;
  comparison: ComparisonReport;
  persist?: boolean;
}): string[] {
  const files: string[] = [];
  const write = (name: string, content: object | string) => {
    const path = join(input.output_dir, name);
    if (input.persist !== false) {
      mkdirSync(input.output_dir, { recursive: true });
      writeFileSync(path, typeof content === "string" ? content : JSON.stringify(content, null, 2));
    }
    files.push(name);
  };

  const strengths = input.review.strengths;
  const weaknesses = input.review.weaknesses.length > 0
    ? input.review.weaknesses
    : ["No critical weaknesses identified"];

  write("founder-review.json", input.review);
  write("founder-prediction.json", input.predictions);
  write("improvement-plan.json", input.plan);
  write("visual-strengths.json", { prototype_id: input.review.prototype_id, strengths });
  write("visual-weaknesses.json", { prototype_id: input.review.prototype_id, weaknesses });
  write("approval-recommendation.json", input.approval);
  write("comparison-report.json", input.comparison);
  write("critic-report.md", renderCriticReport(input));

  return files;
}

function renderCriticReport(input: {
  review: FounderReview;
  predictions: FounderPredictions;
  plan: ImprovementPlan;
  approval: ApprovalRecommendation;
  comparison: ComparisonReport;
}): string {
  return [
    "# Founder AI Design Critic Report",
    "",
    `**Prototype:** ${input.review.prototype_id}`,
    `**Question:** ${input.review.question}`,
    `**Verdict:** ${input.review.verdict}`,
    `**Overall Score:** ${input.approval.overall_score}/100`,
    "",
    "## Approval Recommendation",
    "",
    `**${input.approval.summary}**`,
    "",
    ...input.approval.rationale.map((r) => `- ${r}`),
    "",
    "_Founder approval remains mandatory — critic never auto-approves._",
    "",
    "## Founder Predictions",
    "",
    `- Approval probability: ${input.predictions.founder_approval_probability}%`,
    `- Revision probability: ${input.predictions.founder_revision_probability}%`,
    `- Rejection probability: ${input.predictions.founder_rejection_probability}%`,
    `- User click: ${input.predictions.user_click_probability}%`,
    `- User download: ${input.predictions.user_download_probability}%`,
    `- Premium perception: ${input.predictions.premium_perception}%`,
    `- Recruiter appeal: ${input.predictions.recruiter_appeal}%`,
    `- Overall success: ${input.predictions.overall_success_prediction}%`,
    "",
    "## Top Strengths",
    "",
    ...input.review.strengths.slice(0, 5).map((s) => `- ${s}`),
    "",
    "## Improvement Plan",
    "",
    ...input.plan.recommendations.slice(0, 5).map(
      (r) => `- **[${r.priority}]** ${r.recommendation} (+${r.estimated_visual_gain} visual gain)`,
    ),
    "",
    "## Comparison",
    "",
    `- Benchmark alignment: ${input.comparison.benchmark_alignment_score}%`,
    `- Learning alignment: ${input.comparison.learning_alignment_score}%`,
    `- Batch uniqueness: ${input.comparison.batch_uniqueness_score}%`,
  ].join("\n");
}

export function resolveCriticOutputDir(prototype_id: string): string {
  return join(CRITIC_OUTPUT_ROOT, "reviews", prototype_id);
}
