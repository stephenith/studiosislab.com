/**
 * Originality engine — corpus similarity and uniqueness targeting.
 */
import { analyzeExistingTemplates } from "../research/ExistingTemplateAnalyzer.js";
import type { IndustryId } from "../research/types.js";

export type OriginalityDecision = {
  originality_score: number;
  max_similarity: number;
  pass: boolean;
  most_similar: string | null;
  differentiation: string[];
};

const ORIGINALITY_TARGET = 65;

export function resolveOriginality(input: {
  objective: string;
  industry: IndustryId;
  layout_family: string;
}): OriginalityDecision {
  const comparison = analyzeExistingTemplates({
    objective: input.objective,
    industry: input.industry,
    preferred_family: input.layout_family,
  });

  const max_similarity = comparison.most_similar_templates[0]?.similarity_score ?? 0;
  const originality_score = comparison.uniqueness_score;

  return {
    originality_score,
    max_similarity,
    pass: originality_score >= ORIGINALITY_TARGET && comparison.pass_uniqueness,
    most_similar: comparison.most_similar_templates[0]?.template_id ?? null,
    differentiation: [
      ...comparison.improvement_opportunities.slice(0, 3),
      ...comparison.weaknesses_to_avoid.slice(0, 2).map((w) => `Avoid: ${w}`),
    ],
  };
}
