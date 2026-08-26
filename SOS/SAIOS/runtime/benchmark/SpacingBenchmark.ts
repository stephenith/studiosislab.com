/**
 * Spacing benchmark — summarize spacing and rhythm principles.
 */
import type { DesignPrinciple } from "./types.js";
import { filterCategory, summarize } from "./LayoutBenchmark.js";

export function benchmarkSpacing(principles: DesignPrinciple[]) {
  return summarize(filterCategory(principles, "spacing"), "spacing");
}
