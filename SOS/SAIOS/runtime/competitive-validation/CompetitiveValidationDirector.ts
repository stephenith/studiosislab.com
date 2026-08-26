/**
 * Competitive validation director — evaluate generated resumes against top-market expectations.
 * Never generates resumes. Never mutates production systems directly.
 */
import { appendCompetitiveMemory } from "./CompetitiveMemory.js";
import { loadCompetitiveContext } from "./ArtifactCollector.js";
import { persistCompetitiveArtifacts, resolveCompetitiveOutputDir } from "./CompetitiveReporter.js";
import { evaluateCompetitiveness } from "./CompetitiveValidator.js";
import type { CompetitiveValidationOptions, CompetitiveValidationResult } from "./types.js";

export const COMPETITIVE_VALIDATION = {
  module: "competitive-design-validation",
  version: "1.0.0",
  role: "evaluation_only_layer",
  prohibitions: [
    "no_resume_generation",
    "no_design_system_mutation",
    "no_design_brain_mutation",
    "no_production_worker_mutation",
    "no_publication_mutation",
  ],
} as const;

export async function runCompetitiveValidation(
  options: CompetitiveValidationOptions = {},
): Promise<CompetitiveValidationResult> {
  const ctx = loadCompetitiveContext({
    template_path: options.template_path,
    prototype_dir: options.prototype_dir,
  });

  const evaluated = await evaluateCompetitiveness(
    ctx,
    options.mcp_firecrawl_available ?? true,
  );

  const output_dir = resolveCompetitiveOutputDir(ctx.loaded.templateName);
  const artifacts = persistCompetitiveArtifacts({
    output_dir,
    analysis: evaluated.analysis,
    score: evaluated.score,
    strengths: evaluated.strengths,
    weaknesses: evaluated.weaknesses,
    improvements: evaluated.improvements,
    delta: evaluated.delta,
    persist: options.persist,
  });

  appendCompetitiveMemory(
    {
      recorded_at: new Date().toISOString(),
      template_name: ctx.loaded.templateName,
      template_path: ctx.loaded.path,
      overall_competitive_score: evaluated.score.overall_competitive_score,
      likely_user_choice: evaluated.score.likely_user_choice,
      strengths: evaluated.strengths,
      weaknesses: evaluated.weaknesses,
      recommended_improvements: evaluated.improvements.map((r) => r.recommendation),
      founder_status: "AWAITING_FOUNDER_APPROVAL",
    },
    options.persist !== false,
  );

  return {
    pass: evaluated.score.gate_pass,
    template_name: ctx.loaded.templateName,
    template_path: ctx.loaded.path,
    output_dir,
    analysis: evaluated.analysis,
    score: evaluated.score,
    strengths: evaluated.strengths,
    weaknesses: evaluated.weaknesses,
    improvements: evaluated.improvements,
    design_dna_delta: evaluated.delta,
    artifacts,
    status: "AWAITING_FOUNDER_APPROVAL",
  };
}
