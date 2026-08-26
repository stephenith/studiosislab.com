/**
 * Originality benchmark — rank principles by originality score.
 */
import type { DesignPrinciple } from "./types.js";
import { summarize } from "./LayoutBenchmark.js";

export function benchmarkOriginality(principles: DesignPrinciple[]) {
  const ranked = [...principles].sort((a, b) => b.metrics.originality - a.metrics.originality).slice(0, 8);
  return summarize(ranked, "originality");
}
