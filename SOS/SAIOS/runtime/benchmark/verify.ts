#!/usr/bin/env tsx
/**
 * Visual Benchmark Intelligence Engine verification.
 */
import { existsSync } from "node:fs";
import { join } from "node:path";
import { BENCHMARK_ENGINE, runBenchmarkCycle } from "./BenchmarkDirector.js";
import { collectBenchmarks } from "./BenchmarkCollector.js";
import { extractDesignPatterns } from "./DesignPatternExtractor.js";
import { benchmarkLayout } from "./LayoutBenchmark.js";
import { benchmarkTypography } from "./TypographyBenchmark.js";
import { benchmarkSpacing } from "./SpacingBenchmark.js";
import { benchmarkColor } from "./ColorBenchmark.js";
import { benchmarkATS } from "./ATSBenchmark.js";
import { benchmarkIndustry } from "./IndustryBenchmark.js";
import { scorePopularity } from "./PopularityScorer.js";
import { rankPrinciples } from "./QualityRanker.js";
import { loadBenchmarkMemory } from "./BenchmarkMemory.js";
import { createMockCursorResearchExecutor } from "../research/ResearchCoordinator.js";
import { BENCHMARK_OUTPUT_ROOT } from "./BenchmarkDatabase.js";

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(msg);
}

async function main(): Promise<void> {
  assert(BENCHMARK_ENGINE.module === "visual-benchmark-intelligence-engine", "module id");
  assert(BENCHMARK_ENGINE.role === "design_benchmark_only", "role");
  assert(BENCHMARK_ENGINE.prohibitions.includes("no_fabric_json"), "no fabric json");

  const executor = createMockCursorResearchExecutor({ failure_rate: 0, base_ms: 5 });

  const collected = await collectBenchmarks({ executor, mcp_available: true });
  assert(collected.raw_observations.length > 0, "research collection");

  let principles = extractDesignPatterns(collected);
  assert(principles.length >= 20, "pattern extraction");
  principles = scorePopularity(principles);

  const layout = benchmarkLayout(principles);
  const typography = benchmarkTypography(principles);
  const spacing = benchmarkSpacing(principles);
  const color = benchmarkColor(principles);
  const ats = benchmarkATS(principles);
  const industry = benchmarkIndustry(principles);

  assert(layout.count > 0, "layout benchmarking");
  assert(typography.count > 0, "typography benchmarking");
  assert(spacing.count > 0, "spacing benchmarking");
  assert(color.count > 0, "color benchmarking");
  assert(ats.count > 0, "ats benchmarking");
  assert(industry.count > 0, "industry benchmarking");
  assert(principles.every((p) => p.metrics.composite_score > 0), "trend scoring");

  const rankings = rankPrinciples(principles);
  assert(rankings.top_principles.length > 0, "quality ranking");

  const memoryBefore = loadBenchmarkMemory();
  const result = await runBenchmarkCycle({
    mcp_firecrawl_available: true,
    persist: true,
    cursor_executor: executor,
  });

  const memoryAfter = loadBenchmarkMemory();
  assert(memoryAfter.entries.length >= memoryBefore.entries.length, "memory persistence");
  assert(result.pass, "overall pass");
  assert(result.validation.pass, "validation pass");

  const artifacts = [
    "benchmark-database.json",
    "layout-patterns.json",
    "typography-patterns.json",
    "spacing-patterns.json",
    "color-patterns.json",
    "industry-patterns.json",
    "ats-patterns.json",
    "trend-analysis.json",
    "quality-rankings.json",
    "benchmark-report.md",
  ];

  for (const file of artifacts) {
    assert(existsSync(join(BENCHMARK_OUTPUT_ROOT, file)), `artifact: ${file}`);
  }

  console.log(
    JSON.stringify(
      {
        pass: true,
        component: "visual-benchmark-intelligence-engine",
        run_id: result.run_id,
        principle_count: result.principle_count,
        checks: result.validation.checks,
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
