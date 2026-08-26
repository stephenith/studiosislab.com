/**
 * Premium integration — Research → Benchmark → Design Brain → Learning → Intelligence.
 */
import { createMockCursorResearchExecutor } from "../../research/ResearchCoordinator.js";
import { buildCursorResearchTask, delegateResearchToCursor } from "../../research/ResearchCoordinator.js";
import type { CursorResearchExecutor } from "../../research/ResearchCoordinator.js";
import { runDesignBrain } from "../../design-brain/DesignBrain.js";
import { loadBenchmarkDatabase } from "../../benchmark/BenchmarkDatabase.js";
import { collectBenchmarks as collectBenchmarkData } from "../../benchmark/BenchmarkCollector.js";
import { extractDesignPatterns } from "../../benchmark/DesignPatternExtractor.js";
import { scorePopularity } from "../../benchmark/PopularityScorer.js";
import type { DesignPrinciple } from "../../benchmark/types.js";
import { loadDesignMemory } from "../resume-learning/design-memory.js";
import { loadKnowledgeContext } from "./knowledge-context.js";
import type { PremiumIntegrationContext } from "./types-v3.js";

export async function integratePremiumSources(input: {
  objective: string;
  mcp_available: boolean;
  cursor_executor?: CursorResearchExecutor;
}): Promise<PremiumIntegrationContext & { ctx: ReturnType<typeof loadKnowledgeContext> }> {
  const ctx = loadKnowledgeContext();
  const executor =
    input.cursor_executor ??
    createMockCursorResearchExecutor({ failure_rate: 0, base_ms: 8 });

  const cursorTask = buildCursorResearchTask({
    objective: input.objective,
    mcp_firecrawl_available: input.mcp_available,
  });
  const cursorResult = await delegateResearchToCursor(cursorTask, executor);
  if (!cursorResult.success) {
    throw new Error(cursorResult.error ?? "Research integration failed");
  }

  const brain = await runDesignBrain({
    objective: input.objective,
    mcp_firecrawl_available: input.mcp_available,
    persist: false,
    cursor_executor: executor,
  });

  const principles = await loadBenchmarkPrinciples(input.mcp_available, executor);
  const topPatterns = principles
    .sort((a, b) => b.metrics.composite_score - a.metrics.composite_score)
    .slice(0, 8)
    .map((p) => p.principle);

  let learning_notes: string[] = [];
  try {
    const memory = loadDesignMemory();
    learning_notes = [
      `Spacing margin ${memory.preferred_spacing.margin_px}px`,
      `Typography min body ${memory.preferred_typography.min_body_pt}pt`,
      `Accent palette: ${memory.preferred_colors.accent.join(", ")}`,
      `Section order: ${memory.preferred_sections.order.join(" → ")}`,
    ];
  } catch {
    learning_notes = ["Default learning memory — no founder preferences yet"];
  }

  return {
    ctx,
    research_session_id: cursorResult.session_id,
    brain_decisions: brain.decisions,
    brain_quality: brain.quality,
    brain_confidence: brain.confidence,
    benchmark_principles: principles,
    benchmark_patterns_used: topPatterns,
    learning_notes,
  };
}

async function loadBenchmarkPrinciples(
  mcp_available: boolean,
  executor: CursorResearchExecutor,
): Promise<DesignPrinciple[]> {
  const stored = loadBenchmarkDatabase();
  if (stored && stored.principles.length > 0) {
    return stored.principles;
  }

  const collected = await collectBenchmarkData({ executor, mcp_available });
  return scorePopularity(extractDesignPatterns(collected));
}
