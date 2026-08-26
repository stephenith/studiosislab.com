/**
 * Research collector — delegates internet research to Cursor Agent.
 */
import {
  buildCursorResearchTask,
  delegateResearchToCursor,
  type CursorResearchExecutor,
} from "../research/ResearchCoordinator.js";
import { loadResumeDesignKnowledge } from "../../domain/studiosislab/resume/ResumeDesignKnowledge.js";
import { loadResumeIntelligenceEngine } from "../../domain/studiosislab/resume/intelligence/ResumeIntelligenceEngine.js";
import { BENCHMARK_SOURCES } from "./types.js";

export type ResearchCollection = {
  session_id: string;
  collected_at: string;
  sources_studied: string[];
  cursor_intelligence: string[];
  domain_principles: string[];
  temporary_only: true;
};

export async function collectResearch(input: {
  executor: CursorResearchExecutor;
  mcp_available: boolean;
  focus?: string;
}): Promise<ResearchCollection> {
  const objective =
    input.focus ??
    "Discover and evaluate world-class resume design trends for benchmark intelligence";

  const task = buildCursorResearchTask({
    objective,
    mcp_firecrawl_available: input.mcp_available,
  });

  const result = await delegateResearchToCursor(task, input.executor);
  if (!result.success) {
    throw new Error(result.error ?? "Cursor research collection failed");
  }

  const knowledge = loadResumeDesignKnowledge();
  const intelligence = loadResumeIntelligenceEngine();

  const domain_principles = [
    ...knowledge.design_standards.slice(0, 3).map((s) => s.description),
    ...knowledge.external_principles.improvement_priorities.slice(0, 3).map((p) => p.action),
    `Corpus baseline: ${intelligence.database.published_template_count} StudiosisLab templates`,
    ...intelligence.generator_rules.slice(0, 3).map((r) => r.rule),
  ];

  return {
    session_id: result.session_id,
    collected_at: new Date().toISOString(),
    sources_studied: [...BENCHMARK_SOURCES],
    cursor_intelligence: result.intelligence_applied,
    domain_principles,
    temporary_only: true,
  };
}
