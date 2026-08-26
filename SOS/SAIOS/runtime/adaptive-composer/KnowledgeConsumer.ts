/**
 * Knowledge consumer — reuse Benchmark, Design Brain, Learning, Intelligence.
 */
import { loadResumeDesignKnowledge } from "../../domain/studiosislab/resume/ResumeDesignKnowledge.js";
import { loadResumeIntelligenceEngine } from "../../domain/studiosislab/resume/intelligence/ResumeIntelligenceEngine.js";
import { loadBenchmarkDatabase } from "../benchmark/BenchmarkDatabase.js";
import { loadBenchmarkMemory } from "../benchmark/BenchmarkMemory.js";
import { loadBrainMemory } from "../design-brain/DesignMemory.js";
import { loadDesignMemory } from "../workers/resume-learning/design-memory.js";
import { loadRenderMemory } from "../visual-render/VisualRenderMemory.js";
import { analyzeIndustry } from "../research/IndustryAnalyzer.js";

export type ComposerKnowledgeContext = {
  loaded_at: string;
  design_knowledge_version: string;
  intelligence_families: number;
  benchmark_principles: string[];
  brain_memory_entries: number;
  learning_spacing_margin_px: number;
  learning_typography_body_pt: number;
  render_memory_entries: number;
  industry: ReturnType<typeof analyzeIndustry>;
};

export function consumeComposerKnowledge(objective: string): ComposerKnowledgeContext {
  const knowledge = loadResumeDesignKnowledge();
  const intelligence = loadResumeIntelligenceEngine();
  const benchmark = loadBenchmarkDatabase();
  const brain_memory = loadBrainMemory();
  const learning = loadDesignMemory();
  const render_memory = loadRenderMemory();
  const industry = analyzeIndustry(objective);

  const benchmark_principles =
    benchmark?.principles
      .sort((a, b) => b.metrics.composite_score - a.metrics.composite_score)
      .slice(0, 12)
      .map((p) => p.principle) ?? [];

  return {
    loaded_at: new Date().toISOString(),
    design_knowledge_version: knowledge.version,
    intelligence_families: intelligence.database.design_families.length,
    benchmark_principles,
    brain_memory_entries: brain_memory.entries?.length ?? 0,
    learning_spacing_margin_px: learning.preferred_spacing.margin_px,
    learning_typography_body_pt: learning.preferred_typography.min_body_pt,
    render_memory_entries: render_memory.entries.length,
    industry,
  };
}
