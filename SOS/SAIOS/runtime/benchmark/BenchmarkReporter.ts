/**
 * Benchmark reporter — human-readable benchmark report.
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import type { BenchmarkDatabase, QualityRanking, TrendAnalysis } from "./types.js";
import { BENCHMARK_OUTPUT_ROOT } from "./BenchmarkDatabase.js";

export function renderBenchmarkReport(input: {
  run_id: string;
  database: BenchmarkDatabase;
  trend_analysis: TrendAnalysis;
  quality_rankings: QualityRanking;
}): string {
  const lines: string[] = [
    "# Visual Benchmark Intelligence Report",
    "",
    `**Run ID:** ${input.run_id}`,
    `**Updated:** ${input.database.updated_at}`,
    `**Principles:** ${input.database.principle_count}`,
  ];

  lines.push("", "## Sources Studied", "");
  for (const source of input.database.sources_studied.slice(0, 12)) {
    lines.push(`- ${source}`);
  }
  if (input.database.sources_studied.length > 12) {
    lines.push(`- …and ${input.database.sources_studied.length - 12} more`);
  }

  lines.push("", "## Top Quality Principles", "");
  for (const item of input.quality_rankings.top_principles.slice(0, 8)) {
    lines.push(`- **${item.composite_score}** [${item.category}] ${item.principle}`);
  }

  lines.push("", "## Emerging Trends", "");
  for (const pattern of input.trend_analysis.emerging_patterns) {
    lines.push(`- ${pattern}`);
  }

  lines.push("", "## ATS Innovations", "");
  for (const pattern of input.trend_analysis.ats_innovations) {
    lines.push(`- ${pattern}`);
  }

  lines.push("", "## Design Brain Integration", "");
  lines.push("Benchmark knowledge is the permanent design truth layer.");
  lines.push("Design Brain prefers benchmark database over temporary internet observations.");

  return lines.join("\n");
}

export function persistBenchmarkReport(report: string, persist = true): string {
  const path = join(BENCHMARK_OUTPUT_ROOT, "benchmark-report.md");
  if (persist) writeFileSync(path, report);
  return path;
}
