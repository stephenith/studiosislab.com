/**
 * Popularity scorer — weight principles by source prevalence and adoption.
 */
import type { DesignPrinciple } from "./types.js";

const SOURCE_WEIGHT: Record<string, number> = {
  "ats-benchmark": 1.0,
  "typography-benchmark": 0.95,
  "spacing-benchmark": 0.92,
  "layout-benchmark": 0.9,
  "Resume.io": 0.88,
  Novoresume: 0.86,
  Enhancv: 0.84,
  Canva: 0.82,
  "cursor-research": 0.8,
  "trend-benchmark": 0.75,
};

export function scorePopularity(principles: DesignPrinciple[]): DesignPrinciple[] {
  return principles.map((p) => {
    const weight = SOURCE_WEIGHT[p.source] ?? 0.78;
    const popularity = Math.min(100, Math.round(p.metrics.popularity * weight + 5));
    const composite = Math.round(
      (popularity + p.metrics.professionalism + p.metrics.modernity) / 3,
    );
    return {
      ...p,
      metrics: { ...p.metrics, popularity, composite_score: composite },
    };
  });
}
