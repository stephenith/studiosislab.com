/**
 * Knowledge consumer — reuse Research, Benchmark, Design Brain, Intelligence, Learning.
 */
import { loadResumeDesignKnowledge } from "../../domain/studiosislab/resume/ResumeDesignKnowledge.js";
import { loadResumeIntelligenceEngine } from "../../domain/studiosislab/resume/intelligence/ResumeIntelligenceEngine.js";
import { loadBenchmarkDatabase } from "../benchmark/BenchmarkDatabase.js";
import { loadBenchmarkMemory } from "../benchmark/BenchmarkMemory.js";
import { loadBrainMemory } from "../design-brain/DesignMemory.js";
import { loadDesignMemory } from "../workers/resume-learning/design-memory.js";
import { EDITOR_TECHNICAL_CONTRACT } from "../workers/resume-production/knowledge-context.js";
import { analyzeIndustry } from "../research/IndustryAnalyzer.js";
import type { LoadedTemplateContext } from "./types.js";

export type CriticKnowledgeContext = {
  loaded_at: string;
  design_knowledge_version: string;
  intelligence_template_count: number;
  benchmark_principle_count: number;
  benchmark_patterns: string[];
  brain_memory_entries: number;
  learning_memory: ReturnType<typeof loadDesignMemory>;
  editor_contract: typeof EDITOR_TECHNICAL_CONTRACT;
  industry: ReturnType<typeof analyzeIndustry>;
};

export function consumeKnowledge(ctx: LoadedTemplateContext): CriticKnowledgeContext {
  const knowledge = loadResumeDesignKnowledge();
  const intelligence = loadResumeIntelligenceEngine();
  const benchmark = loadBenchmarkDatabase();
  const benchmark_memory = loadBenchmarkMemory();
  const brain_memory = loadBrainMemory();
  const learning_memory = loadDesignMemory();
  const industry = analyzeIndustry(ctx.objective);

  const benchmark_patterns =
    benchmark?.principles
      .sort((a, b) => b.metrics.composite_score - a.metrics.composite_score)
      .slice(0, 10)
      .map((p) => p.principle) ?? [];

  return {
    loaded_at: new Date().toISOString(),
    design_knowledge_version: knowledge.version,
    intelligence_template_count: intelligence.database.published_template_count,
    benchmark_principle_count: benchmark?.principle_count ?? 0,
    benchmark_patterns,
    brain_memory_entries: brain_memory.entries?.length ?? 0,
    learning_memory,
    editor_contract: EDITOR_TECHNICAL_CONTRACT,
    industry,
  };
}
