/**
 * Benchmark validator — prove pipeline integrity before PASS.
 */
import type { BenchmarkRunResult, BenchmarkValidation, DesignPrinciple } from "./types.js";
import { loadBenchmarkMemory } from "./BenchmarkMemory.js";

export function validateBenchmarkRun(result: {
  principles: DesignPrinciple[];
  research_collected: boolean;
  patterns_extracted: boolean;
  layout_benchmarked: boolean;
  typography_benchmarked: boolean;
  spacing_benchmarked: boolean;
  color_benchmarked: boolean;
  ats_benchmarked: boolean;
  industry_benchmarked: boolean;
  trend_scored: boolean;
  quality_ranked: boolean;
  memory_persisted: boolean;
}): BenchmarkValidation {
  const checks: Record<string, boolean> = {
    research_collection: result.research_collected,
    pattern_extraction: result.patterns_extracted && result.principles.length >= 20,
    layout_benchmarking: result.layout_benchmarked,
    typography_benchmarking: result.typography_benchmarked,
    spacing_benchmarking: result.spacing_benchmarked,
    color_benchmarking: result.color_benchmarked,
    ats_benchmarking: result.ats_benchmarked,
    industry_benchmarking: result.industry_benchmarked,
    trend_scoring: result.trend_scored,
    quality_ranking: result.quality_ranked,
    memory_persistence: result.memory_persisted,
  };

  const errors: string[] = [];
  for (const [key, ok] of Object.entries(checks)) {
    if (!ok) errors.push(`Failed check: ${key}`);
  }

  if (result.principles.some((p) => !p.validated)) {
    errors.push("Unvalidated principles detected");
    checks.pattern_extraction = false;
  }

  const pass = errors.length === 0;
  return { pass, checks, errors };
}

export function assertBenchmarkReady(result: BenchmarkRunResult): BenchmarkValidation {
  const memory = loadBenchmarkMemory();
  if (!memory.version) {
    return { pass: false, checks: result.validation.checks, errors: ["Benchmark memory unavailable"] };
  }
  return result.validation;
}
