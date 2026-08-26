/**
 * Founder AI Design Critic — main director.
 * Sits after Resume QA; decides readiness for founder review.
 * NOT a generator, QA engine, or production worker.
 */
import { consumeKnowledge } from "./KnowledgeConsumer.js";
import {
  findLatestPremiumPrototype,
  loadTemplateArtifacts,
} from "./ArtifactCollector.js";
import { runComparisonEngine } from "./ComparisonEngine.js";
import {
  evaluateVisualDimensions,
  buildFounderReview,
  loadQAForCritique,
} from "./VisualCritiqueEngine.js";
import { predictFounderOutcome } from "./FounderPredictor.js";
import { buildImprovementPlan } from "./ImprovementPlanner.js";
import { recommendApproval } from "./ApprovalPolicy.js";
import { persistCriticArtifacts, resolveCriticOutputDir } from "./CriticReporter.js";
import { recordCriticRun } from "./CriticMemory.js";
import type { CriticRunOptions, CriticRunResult } from "./types.js";

export const FOUNDER_AI_DESIGN_CRITIC = {
  module: "founder-ai-design-critic",
  version: "1.0.0",
  role: "founder_quality_gate",
  description:
    'Behaves like the Founder. Answers: "Would Stephen approve this template?" Never auto-approves.',
  prohibitions: ["no_resume_generation", "no_qa_engine", "no_production_worker"],
  pipeline_position: "after_resume_qa_before_local_review",
} as const;

export async function runFounderCritic(options: CriticRunOptions = {}): Promise<CriticRunResult> {
  const prototype_dir = options.prototype_dir ?? findLatestPremiumPrototype();
  const ctx = loadTemplateArtifacts(prototype_dir);

  if (!ctx.qa_pass) {
    throw new Error(`Resume QA must pass before founder critic: ${ctx.prototype_id}`);
  }

  const knowledge = consumeKnowledge(ctx);
  const comparison = runComparisonEngine(ctx, knowledge);
  const qa_reports = loadQAForCritique(ctx.prototype_id);

  const { dimensions, critiques, strengths, weaknesses } = evaluateVisualDimensions({
    ctx,
    knowledge,
    comparison,
    qa_reports,
  });

  const overallDim = dimensions.find((d) => d.dimension === "overall_quality");
  const overall_score = overallDim?.score ?? 90;

  const review = buildFounderReview({
    ctx,
    dimensions,
    critiques,
    strengths,
    weaknesses,
    overall_score,
  });

  const predictions = predictFounderOutcome({ ctx, dimensions, comparison, overall_score });
  const plan = buildImprovementPlan({ ctx, critiques, overall_score });
  const approval = recommendApproval({
    overall_score,
    qa_pass: ctx.qa_pass,
    predictions,
  });

  const output_dir = resolveCriticOutputDir(ctx.prototype_id);
  const artifacts = persistCriticArtifacts({
    output_dir,
    review,
    predictions,
    plan,
    approval,
    comparison,
    persist: options.persist,
  });

  recordCriticRun({
    prototype_id: ctx.prototype_id,
    approval,
    predictions,
    persist: options.persist,
  });

  const pass =
    knowledge.benchmark_principle_count >= 0 &&
    predictions.founder_approval_probability > 0 &&
    predictions.user_click_probability > 0 &&
    predictions.user_download_probability > 0 &&
    predictions.premium_perception > 0 &&
    comparison.corpus_comparisons.length > 0 &&
    plan.recommendations.length > 0 &&
    approval.founder_approval_mandatory === true;

  return {
    pass,
    review_id: review.review_id,
    prototype_id: ctx.prototype_id,
    output_dir,
    overall_score,
    approval,
    predictions,
    ready_for_founder_review: approval.ready_for_founder_review,
    artifacts,
  };
}
