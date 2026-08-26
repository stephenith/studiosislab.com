/**
 * Layout benchmark — shared category helpers and layout summaries.
 */
import type { DesignPrinciple } from "./types.js";

export function filterCategory(principles: DesignPrinciple[], category: DesignPrinciple["category"]) {
  return principles.filter((p) => p.category === category);
}

export function summarize(principles: DesignPrinciple[], label: string) {
  const items = principles
    .sort((a, b) => b.metrics.composite_score - a.metrics.composite_score)
    .slice(0, 10);
  return {
    label,
    count: principles.length,
    avg_composite:
      principles.length > 0
        ? Math.round(
            principles.reduce((a, p) => a + p.metrics.composite_score, 0) / principles.length,
          )
        : 0,
    top_principles: items.map((p) => ({
      id: p.id,
      principle: p.principle,
      score: p.metrics.composite_score,
      source: p.source,
    })),
  };
}

export function benchmarkLayout(principles: DesignPrinciple[]) {
  return summarize(filterCategory(principles, "layout"), "layout");
}
