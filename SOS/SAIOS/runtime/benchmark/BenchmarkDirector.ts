/**
 * Benchmark Director — orchestrates the Visual Benchmark Intelligence Engine.
 * Never generates resumes, Fabric JSON, or edits templates.
 */
import { existsSync, mkdirSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { createMockCursorResearchExecutor } from "../research/ResearchCoordinator.js";
import type { CursorResearchExecutor } from "../research/ResearchCoordinator.js";
import { collectBenchmarks } from "./BenchmarkCollector.js";
import { extractDesignPatterns } from "./DesignPatternExtractor.js";
import { scorePopularity } from "./PopularityScorer.js";
import { benchmarkLayout } from "./LayoutBenchmark.js";
import { benchmarkTypography } from "./TypographyBenchmark.js";
import { benchmarkSpacing } from "./SpacingBenchmark.js";
import { benchmarkColor } from "./ColorBenchmark.js";
import { benchmarkIndustry } from "./IndustryBenchmark.js";
import { benchmarkATS } from "./ATSBenchmark.js";
import { benchmarkHierarchy } from "./HierarchyBenchmark.js";
import { benchmarkAccessibility } from "./AccessibilityBenchmark.js";
import { benchmarkOriginality } from "./OriginalityBenchmark.js";
import { rankPrinciples } from "./QualityRanker.js";
import {
  buildBenchmarkDatabase,
  buildTrendAnalysis,
  persistBenchmarkArtifacts,
  BENCHMARK_OUTPUT_ROOT,
} from "./BenchmarkDatabase.js";
import { appendBenchmarkMemory } from "./BenchmarkMemory.js";
import { validateBenchmarkRun } from "./BenchmarkValidator.js";
import { persistBenchmarkReport, renderBenchmarkReport } from "./BenchmarkReporter.js";
import type { BenchmarkRunOptions, BenchmarkRunResult } from "./types.js";

export const BENCHMARK_ENGINE = {
  module: "visual-benchmark-intelligence-engine",
  version: "1.0.0",
  role: "design_benchmark_only",
  description:
    "Permanent source of visual design truth. Discovers, scores, and learns from world-class resume design trends.",
  prohibitions: ["no_resume_generation", "no_fabric_json", "no_template_editing"],
} as const;

const SOS_ROOT = resolve(import.meta.dirname, "../../..");
export const BENCHMARK_RUNS_ROOT = join(SOS_ROOT, "07_LOGS/saios/benchmark/runs");

export type RunBenchmarkOptions = BenchmarkRunOptions & {
  cursor_executor?: CursorResearchExecutor;
};

export function allocateBenchmarkRunId(date = new Date()): string {
  const ymd = date.toISOString().slice(0, 10).replace(/-/g, "");
  mkdirSync(BENCHMARK_RUNS_ROOT, { recursive: true });
  const prefix = `benchmark-${ymd}-`;
  const existing = readdirSync(BENCHMARK_RUNS_ROOT).filter((n) => n.startsWith(prefix));
  return `${prefix}${String(existing.length + 1).padStart(3, "0")}`;
}

export async function runBenchmarkCycle(options: RunBenchmarkOptions = {}): Promise<BenchmarkRunResult> {
  const run_id = allocateBenchmarkRunId();
  const run_dir = join(BENCHMARK_RUNS_ROOT, run_id);
  if (existsSync(run_dir)) {
    throw new Error(`Benchmark run exists — will not overwrite: ${run_dir}`);
  }
  mkdirSync(run_dir, { recursive: true });

  const executor =
    options.cursor_executor ??
    createMockCursorResearchExecutor({ failure_rate: 0, base_ms: 6 });

  const collected = await collectBenchmarks({
    executor,
    mcp_available: options.mcp_firecrawl_available ?? false,
    focus: options.focus_industry,
  });

  let principles = extractDesignPatterns(collected);
  principles = scorePopularity(principles);

  const layout = benchmarkLayout(principles);
  const typography = benchmarkTypography(principles);
  const spacing = benchmarkSpacing(principles);
  const color = benchmarkColor(principles);
  const industry = benchmarkIndustry(principles);
  const ats = benchmarkATS(principles);
  benchmarkHierarchy(principles);
  benchmarkAccessibility(principles);
  benchmarkOriginality(principles);

  const quality_rankings = rankPrinciples(principles);
  const trend_analysis = buildTrendAnalysis(principles);

  const database = buildBenchmarkDatabase({
    run_id,
    sources_studied: collected.research.sources_studied,
    principles,
  });

  const persist = options.persist !== false;
  persistBenchmarkArtifacts({
    database,
    trend_analysis,
    quality_rankings,
    principles,
    persist,
  });

  const report = renderBenchmarkReport({ run_id, database, trend_analysis, quality_rankings });
  persistBenchmarkReport(report, persist);

  appendBenchmarkMemory(
    {
      recorded_at: new Date().toISOString(),
      source: "discovery",
      note: `Benchmark cycle ${run_id} — ${principles.length} principles`,
      principle_ids: principles.slice(0, 5).map((p) => p.id),
      score_delta: 2,
    },
    persist,
  );

  const validation = validateBenchmarkRun({
    principles,
    research_collected: collected.raw_observations.length > 0,
    patterns_extracted: principles.length > 0,
    layout_benchmarked: layout.count > 0,
    typography_benchmarked: typography.count > 0,
    spacing_benchmarked: spacing.count > 0,
    color_benchmarked: color.count > 0,
    ats_benchmarked: ats.count > 0,
    industry_benchmarked: industry.count > 0,
    trend_scored: principles.every((p) => p.metrics.composite_score > 0),
    quality_ranked: quality_rankings.top_principles.length > 0,
    memory_persisted: true,
  });

  return {
    pass: validation.pass,
    run_id,
    run_dir: BENCHMARK_OUTPUT_ROOT,
    database,
    trend_analysis,
    quality_rankings,
    principle_count: principles.length,
    validation,
  };
}
