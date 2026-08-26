/**
 * Benchmark database — persist validated design knowledge artifacts.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import type {
  BenchmarkDatabase,
  DesignPrinciple,
  QualityRanking,
  TrendAnalysis,
} from "./types.js";
import { benchmarkLayout } from "./LayoutBenchmark.js";
import { benchmarkTypography } from "./TypographyBenchmark.js";
import { benchmarkSpacing } from "./SpacingBenchmark.js";
import { benchmarkColor } from "./ColorBenchmark.js";
import { benchmarkIndustry } from "./IndustryBenchmark.js";
import { benchmarkATS } from "./ATSBenchmark.js";

const SOS_ROOT = resolve(import.meta.dirname, "../../..");
export const BENCHMARK_OUTPUT_ROOT = join(SOS_ROOT, "07_LOGS/saios/benchmark");

export type PersistedBenchmarkArtifacts = {
  output_root: string;
  database_path: string;
  layout_path: string;
  typography_path: string;
  spacing_path: string;
  color_path: string;
  industry_path: string;
  ats_path: string;
  trend_path: string;
  rankings_path: string;
};

export function buildBenchmarkDatabase(input: {
  run_id: string;
  sources_studied: string[];
  principles: DesignPrinciple[];
}): BenchmarkDatabase {
  return {
    version: "1.0.0",
    updated_at: new Date().toISOString(),
    run_id: input.run_id,
    principle_count: input.principles.length,
    sources_studied: input.sources_studied,
    principles: input.principles,
  };
}

export function buildTrendAnalysis(principles: DesignPrinciple[]): TrendAnalysis {
  const trends = principles.filter((p) => p.category === "trend").map((p) => p.principle);
  const ats = principles.filter((p) => p.category === "ats").map((p) => p.principle);
  const premium = principles
    .filter((p) => p.metrics.premium_perception >= 88)
    .slice(0, 6)
    .map((p) => p.principle);
  const industry = principles.filter((p) => p.category === "industry");

  return {
    analyzed_at: new Date().toISOString(),
    emerging_patterns: trends.length > 0 ? trends : ["Minimal decoration density", "Premium whitespace"],
    declining_patterns: ["Dense multi-column layouts", "Skill bar graphics", "Photo headers in ATS tier"],
    ats_innovations: ats.slice(0, 5),
    premium_patterns: premium,
    industry_expectations: {
      finance: industry.filter((p) => p.principle.toLowerCase().includes("finance")).map((p) => p.principle),
      tech: industry.filter((p) => p.principle.toLowerCase().includes("tech")).map((p) => p.principle),
      healthcare: industry.filter((p) => p.principle.toLowerCase().includes("healthcare")).map((p) => p.principle),
      executive: industry.filter((p) => p.principle.toLowerCase().includes("executive")).map((p) => p.principle),
    },
  };
}

export function persistBenchmarkArtifacts(input: {
  database: BenchmarkDatabase;
  trend_analysis: TrendAnalysis;
  quality_rankings: QualityRanking;
  principles: DesignPrinciple[];
  persist?: boolean;
}): PersistedBenchmarkArtifacts {
  const output_root = BENCHMARK_OUTPUT_ROOT;
  const paths = {
    output_root,
    database_path: join(output_root, "benchmark-database.json"),
    layout_path: join(output_root, "layout-patterns.json"),
    typography_path: join(output_root, "typography-patterns.json"),
    spacing_path: join(output_root, "spacing-patterns.json"),
    color_path: join(output_root, "color-patterns.json"),
    industry_path: join(output_root, "industry-patterns.json"),
    ats_path: join(output_root, "ats-patterns.json"),
    trend_path: join(output_root, "trend-analysis.json"),
    rankings_path: join(output_root, "quality-rankings.json"),
  };

  if (input.persist !== false) {
    mkdirSync(output_root, { recursive: true });
    writeFileSync(paths.database_path, JSON.stringify(input.database, null, 2));
    writeFileSync(paths.layout_path, JSON.stringify(benchmarkLayout(input.principles), null, 2));
    writeFileSync(paths.typography_path, JSON.stringify(benchmarkTypography(input.principles), null, 2));
    writeFileSync(paths.spacing_path, JSON.stringify(benchmarkSpacing(input.principles), null, 2));
    writeFileSync(paths.color_path, JSON.stringify(benchmarkColor(input.principles), null, 2));
    writeFileSync(paths.industry_path, JSON.stringify(benchmarkIndustry(input.principles), null, 2));
    writeFileSync(paths.ats_path, JSON.stringify(benchmarkATS(input.principles), null, 2));
    writeFileSync(paths.trend_path, JSON.stringify(input.trend_analysis, null, 2));
    writeFileSync(paths.rankings_path, JSON.stringify(input.quality_rankings, null, 2));
  }

  return paths;
}

export function loadBenchmarkDatabase(): BenchmarkDatabase | null {
  const path = join(BENCHMARK_OUTPUT_ROOT, "benchmark-database.json");
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, "utf8")) as BenchmarkDatabase;
}
