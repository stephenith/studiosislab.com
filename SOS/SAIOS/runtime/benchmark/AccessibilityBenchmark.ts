/**
 * Accessibility benchmark — summarize accessibility principles.
 */
import type { DesignPrinciple } from "./types.js";
import { filterCategory, summarize } from "./LayoutBenchmark.js";

export function benchmarkAccessibility(principles: DesignPrinciple[]) {
  return summarize(filterCategory(principles, "accessibility"), "accessibility");
}
