/**
 * Duplicate detection — redesign if similarity exceeds 70%.
 */
import { analyzeExistingTemplates } from "../../research/ExistingTemplateAnalyzer.js";
import type { IndustryId } from "../../research/types.js";

export const DUPLICATE_THRESHOLD = 0.7;

export type DuplicateCheckResult = {
  max_similarity: number;
  exceeds_threshold: boolean;
  most_similar_template_id: string | null;
  uniqueness_score: number;
  comparison: ReturnType<typeof analyzeExistingTemplates>;
  redesign_required: boolean;
};

export function checkDuplicateRisk(input: {
  objective: string;
  industry: IndustryId;
  family_id: string;
}): DuplicateCheckResult {
  const comparison = analyzeExistingTemplates({
    objective: input.objective,
    industry: input.industry,
    preferred_family: input.family_id,
  });

  const max_similarity = comparison.most_similar_templates[0]?.similarity_score ?? 0;
  const exceeds_threshold = max_similarity > DUPLICATE_THRESHOLD;

  return {
    max_similarity,
    exceeds_threshold,
    most_similar_template_id: comparison.most_similar_templates[0]?.template_id ?? null,
    uniqueness_score: comparison.uniqueness_score,
    comparison,
    redesign_required: exceeds_threshold,
  };
}

export function pickAlternateFamily(
  affinity: string[],
  exclude: string[],
): string | null {
  const alt = affinity.find((f) => !exclude.includes(f));
  return alt ?? null;
}
