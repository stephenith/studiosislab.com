/**
 * Benchmark collector — orchestrates Cursor + Firecrawl collection.
 */
import type { CursorResearchExecutor } from "../research/ResearchCoordinator.js";
import { collectResearch, type ResearchCollection } from "./ResearchCollector.js";
import { collectFirecrawlBenchmarks, type FirecrawlCollection } from "./FirecrawlCollector.js";

export type CollectedBenchmarks = {
  research: ResearchCollection;
  firecrawl: FirecrawlCollection;
  raw_observations: string[];
};

export async function collectBenchmarks(input: {
  executor: CursorResearchExecutor;
  mcp_available: boolean;
  focus?: string;
}): Promise<CollectedBenchmarks> {
  const research = await collectResearch(input);
  const firecrawl = collectFirecrawlBenchmarks(input.mcp_available);

  const raw_observations = [
    ...research.domain_principles,
    ...research.cursor_intelligence,
    ...firecrawl.findings.map((f) => `[${f.source}] ${f.principle}`),
  ];

  return { research, firecrawl, raw_observations };
}
