/**
 * ATS benchmark — summarize ATS-safe innovation principles.
 */
import type { DesignPrinciple } from "./types.js";
import { filterCategory, summarize } from "./LayoutBenchmark.js";

export function benchmarkATS(principles: DesignPrinciple[]) {
  return summarize(filterCategory(principles, "ats"), "ats");
}
