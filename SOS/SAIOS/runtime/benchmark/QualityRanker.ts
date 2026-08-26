/**
 * Quality ranker — composite rankings across all principles.
 */
import type { DesignPrinciple, PrincipleCategory, QualityRanking } from "./types.js";

export function rankPrinciples(principles: DesignPrinciple[]): QualityRanking {
  const ranked = [...principles].sort((a, b) => b.metrics.composite_score - a.metrics.composite_score);

  const top_principles = ranked.slice(0, 15).map((p) => ({
    id: p.id,
    principle: p.principle,
    composite_score: p.metrics.composite_score,
    category: p.category,
  }));

  const category_leaders = {} as Record<PrincipleCategory, string | null>;
  const categories: PrincipleCategory[] = [
    "layout",
    "typography",
    "spacing",
    "color",
    "hierarchy",
    "industry",
    "ats",
    "accessibility",
    "trend",
  ];

  for (const cat of categories) {
    const leader = ranked.find((p) => p.category === cat);
    category_leaders[cat] = leader?.id ?? null;
  }

  return {
    ranked_at: new Date().toISOString(),
    top_principles,
    category_leaders,
  };
}
