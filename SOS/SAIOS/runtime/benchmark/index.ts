/**
 * Visual Benchmark Intelligence Engine — public API.
 */
export { BENCHMARK_ENGINE, runBenchmarkCycle, allocateBenchmarkRunId } from "./BenchmarkDirector.js";
export { collectBenchmarks } from "./BenchmarkCollector.js";
export { collectResearch } from "./ResearchCollector.js";
export { collectFirecrawlBenchmarks } from "./FirecrawlCollector.js";
export { extractDesignPatterns } from "./DesignPatternExtractor.js";
export { benchmarkLayout } from "./LayoutBenchmark.js";
export { benchmarkTypography } from "./TypographyBenchmark.js";
export { benchmarkSpacing } from "./SpacingBenchmark.js";
export { benchmarkColor } from "./ColorBenchmark.js";
export { benchmarkHierarchy } from "./HierarchyBenchmark.js";
export { benchmarkIndustry } from "./IndustryBenchmark.js";
export { benchmarkATS } from "./ATSBenchmark.js";
export { benchmarkAccessibility } from "./AccessibilityBenchmark.js";
export { benchmarkOriginality } from "./OriginalityBenchmark.js";
export { scorePrinciple } from "./TrendScorer.js";
export { scorePopularity } from "./PopularityScorer.js";
export { rankPrinciples } from "./QualityRanker.js";
export {
  buildBenchmarkDatabase,
  buildTrendAnalysis,
  persistBenchmarkArtifacts,
  loadBenchmarkDatabase,
  BENCHMARK_OUTPUT_ROOT,
} from "./BenchmarkDatabase.js";
export { appendBenchmarkMemory, loadBenchmarkMemory, BENCHMARK_MEMORY_ROOT } from "./BenchmarkMemory.js";
export { validateBenchmarkRun } from "./BenchmarkValidator.js";
export { renderBenchmarkReport, persistBenchmarkReport } from "./BenchmarkReporter.js";
export * from "./types.js";
