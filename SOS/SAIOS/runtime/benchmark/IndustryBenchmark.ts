/**
 * Industry benchmark — summarize industry-specific expectations.
 */
import type { DesignPrinciple } from "./types.js";
import { filterCategory, summarize } from "./LayoutBenchmark.js";

export function benchmarkIndustry(principles: DesignPrinciple[]) {
  return summarize(filterCategory(principles, "industry"), "industry");
}
