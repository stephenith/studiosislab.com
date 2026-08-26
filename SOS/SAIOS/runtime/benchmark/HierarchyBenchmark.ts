/**
 * Hierarchy benchmark — summarize visual hierarchy principles.
 */
import type { DesignPrinciple } from "./types.js";
import { filterCategory, summarize } from "./LayoutBenchmark.js";

export function benchmarkHierarchy(principles: DesignPrinciple[]) {
  return summarize(filterCategory(principles, "hierarchy"), "hierarchy");
}
