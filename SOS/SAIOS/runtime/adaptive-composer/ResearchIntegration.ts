/**
 * Research integration — Cursor + Firecrawl composition principles only.
 */
import {
  buildCursorResearchTask,
  createMockCursorResearchExecutor,
  delegateResearchToCursor,
} from "../research/ResearchCoordinator.js";
import { collectFirecrawlBenchmarks } from "../benchmark/FirecrawlCollector.js";

export type ComposerResearchContext = {
  cursor_principles: string[];
  firecrawl_principles: string[];
  combined: string[];
};

export async function gatherCompositionPrinciples(
  objective: string,
  mcp_available: boolean,
): Promise<ComposerResearchContext> {
  const executor = createMockCursorResearchExecutor({ failure_rate: 0, base_ms: 5 });
  const task = buildCursorResearchTask({
    objective: `Compose premium resume from reusable blocks: ${objective}`,
    mcp_firecrawl_available: mcp_available,
  });
  const result = await delegateResearchToCursor(task, executor);

  const firecrawl = collectFirecrawlBenchmarks(mcp_available);
  const firecrawl_principles = firecrawl.findings.map((f) => f.principle);

  const cursor_principles = [
    "Compose from reusable blocks — never clone commercial templates",
    "Section order must follow recruiter scan path",
    "Whitespace rhythm creates premium perception",
    "Typography pairing must justify hierarchy decisions",
    ...(result.intelligence_applied ?? []).slice(0, 4),
  ];

  const combined = [...new Set([...cursor_principles, ...firecrawl_principles])].slice(0, 12);

  return { cursor_principles, firecrawl_principles, combined };
}
