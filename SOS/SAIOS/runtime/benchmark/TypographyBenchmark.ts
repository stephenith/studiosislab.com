/**
 * Typography benchmark — summarize typography system principles.
 */
import type { DesignPrinciple } from "./types.js";
import { filterCategory, summarize } from "./LayoutBenchmark.js";

export function benchmarkTypography(principles: DesignPrinciple[]) {
  return summarize(filterCategory(principles, "typography"), "typography");
}
