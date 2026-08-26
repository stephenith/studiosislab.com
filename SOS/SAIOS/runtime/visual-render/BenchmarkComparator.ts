/**
 * Benchmark comparator — reuse Benchmark Engine principles on rendered metrics.
 */
import { loadBenchmarkDatabase } from "../benchmark/BenchmarkDatabase.js";
import type { RenderMetrics } from "./types.js";

export function loadBenchmarkPrinciplesForRender(): string[] {
  const db = loadBenchmarkDatabase();
  if (!db || db.principles.length === 0) {
    return [
      "Premium whitespace with 48–56px margins",
      "Single accent on neutral base",
      "Clear name-to-body typography hierarchy",
      "ATS-safe flat text structure",
    ];
  }
  return db.principles
    .sort((a, b) => b.metrics.composite_score - a.metrics.composite_score)
    .slice(0, 12)
    .map((p) => p.principle);
}

export function benchmarkAlignmentScore(metrics: RenderMetrics, principles: string[]): number {
  let score = 82;
  if (metrics.left_margin_px >= 48 && metrics.left_margin_px <= 60) score += 6;
  if (metrics.font_sizes_pt.length >= 2) {
    const ratio = metrics.font_sizes_pt[0]! / (metrics.font_sizes_pt.at(-1) ?? 11);
    if (ratio >= 1.8) score += 5;
  }
  if (metrics.accent_count <= 4) score += 4;
  if (principles.some((p) => p.toLowerCase().includes("whitespace"))) score += 3;
  return Math.min(100, score);
}

export function externalPrincipleBoost(principles: string[]): number {
  return Math.min(8, principles.length);
}
