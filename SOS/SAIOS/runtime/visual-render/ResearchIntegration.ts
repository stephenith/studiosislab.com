/**
 * Research integration — Cursor + Firecrawl design principles (principles only).
 */
import {
  buildCursorResearchTask,
  createMockCursorResearchExecutor,
  delegateResearchToCursor,
} from "../research/ResearchCoordinator.js";
import { collectFirecrawlBenchmarks } from "../benchmark/FirecrawlCollector.js";

export type RenderResearchContext = {
  cursor_principles: string[];
  firecrawl_principles: string[];
  combined: string[];
};

export async function gatherRenderResearchPrinciples(
  mcp_available: boolean,
): Promise<RenderResearchContext> {
  const executor = createMockCursorResearchExecutor({ failure_rate: 0, base_ms: 5 });
  const task = buildCursorResearchTask({
    objective: "Evaluate premium resume visual render for founder approval",
    mcp_firecrawl_available: mcp_available,
  });
  const result = await delegateResearchToCursor(task, executor);

  const firecrawl = collectFirecrawlBenchmarks(mcp_available);
  const firecrawl_principles = firecrawl.findings.map((f) => f.principle);

  const cursor_principles = [
    "Founders approve calm whitespace and confident hierarchy",
    "Recruiters scan name → title → experience in under 6 seconds",
    "Premium resumes avoid resume-builder visual noise",
    ...(result.intelligence_applied ?? []).slice(0, 3),
  ];

  const combined = [...new Set([...cursor_principles, ...firecrawl_principles])].slice(0, 10);

  return { cursor_principles, firecrawl_principles, combined };
}
