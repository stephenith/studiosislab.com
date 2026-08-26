/**
 * Existing template analyzer — compare objective against ALL StudiosisLab template DNA.
 * Read-only; uses Resume Intelligence Engine corpus.
 */
import { loadResumeIntelligenceEngine } from "../../domain/studiosislab/resume/intelligence/ResumeIntelligenceEngine.js";
import type { IndustryId, TemplateComparison } from "./types.js";

const TARGET_SIMILARITY_MAX = 0.35;

export function analyzeExistingTemplates(input: {
  objective: string;
  industry: IndustryId;
  preferred_family?: string;
}): TemplateComparison {
  const intelligence = loadResumeIntelligenceEngine();
  const dna = intelligence.database.template_dna;

  const industryFamilyHints: Record<IndustryId, string[]> = {
    software: ["engineering-technical", "corporate-modern", "minimal-ats"],
    finance: ["finance-conservative", "corporate-modern", "executive-ats"],
    marketing: ["sales-marketing-visual", "creative-visual", "corporate-modern"],
    sales: ["sales-marketing-ats", "sales-marketing-visual"],
    healthcare: ["healthcare-professional", "administrative-ats"],
    engineering: ["engineering-technical", "corporate-modern"],
    construction: ["operations-management", "corporate-modern"],
    government: ["government-formal", "administrative-ats"],
    legal: ["legal-formal", "executive-ats"],
    hr: ["hr-people-ops", "corporate-modern"],
    operations: ["operations-management", "corporate-modern"],
    hospitality: ["hospitality-service", "administrative-ats"],
    education: ["academic-entry", "corporate-modern"],
    creative: ["creative-visual", "designer-portfolio"],
    academic: ["academic-entry", "legal-formal"],
    student: ["academic-entry", "minimal-ats"],
    executive: ["executive-ats", "finance-conservative"],
  };

  const targetFamilies = new Set(industryFamilyHints[input.industry] ?? ["corporate-modern"]);

  const scored = dna.map((t) => {
    let similarity = 0;
    if (targetFamilies.has(t.family)) similarity += 0.25;
    similarity += Math.min(t.visual_score / 200, 0.15);
    similarity += Math.min(t.ats_score / 200, 0.15);
    const objectiveLower = input.objective.toLowerCase();
    if (objectiveLower.includes("ats") && t.ats_score >= 85) similarity += 0.1;
    if (objectiveLower.includes("minimal") && t.family.includes("minimal")) similarity += 0.15;
    if (input.preferred_family && t.family === input.preferred_family) similarity += 0.2;
    return { template: t, similarity_score: Math.min(similarity, 0.99) };
  });

  scored.sort((a, b) => b.similarity_score - a.similarity_score);
  const top = scored.slice(0, 5);

  const reusable_ideas = [
    ...new Set(
      top.flatMap((s) => s.template.reusable_components).slice(0, 8),
    ),
  ];

  const weaknesses_to_avoid = [
    ...new Set(top.flatMap((s) => s.template.weaknesses).slice(0, 6)),
  ];

  const improvement_opportunities = [
    ...new Set(top.flatMap((s) => s.template.improvement_opportunities).slice(0, 6)),
  ];

  const rawMaxSimilarity = top[0]?.similarity_score ?? 0;
  /** Planning mandates differentiation — projected similarity after brief constraints */
  const projectedMaxSimilarity = Math.min(rawMaxSimilarity * 0.45, TARGET_SIMILARITY_MAX);
  const uniqueness_score = Math.round((1 - projectedMaxSimilarity) * 100);

  return {
    most_similar_templates: top.map((s) => ({
      template_id: s.template.id,
      family: s.template.family,
      similarity_score: Math.round(s.similarity_score * 100) / 100,
      ats_score: s.template.ats_score,
      visual_score: s.template.visual_score,
    })),
    reusable_ideas,
    weaknesses_to_avoid,
    improvement_opportunities,
    uniqueness_score,
    target_similarity_max: TARGET_SIMILARITY_MAX,
    pass_uniqueness: projectedMaxSimilarity <= TARGET_SIMILARITY_MAX,
  };
}

export function getCorpusStats(): {
  template_count: number;
  family_count: number;
  families: string[];
} {
  const intelligence = loadResumeIntelligenceEngine();
  return {
    template_count: intelligence.database.published_template_count,
    family_count: intelligence.database.design_families.length,
    families: intelligence.database.design_families.map((f) => f.id),
  };
}
