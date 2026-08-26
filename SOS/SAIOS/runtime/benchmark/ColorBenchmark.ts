/**
 * Color benchmark — summarize color system principles.
 */
import type { DesignPrinciple } from "./types.js";
import { filterCategory, summarize } from "./LayoutBenchmark.js";

export function benchmarkColor(principles: DesignPrinciple[]) {
  return summarize(filterCategory(principles, "color"), "color");
}
