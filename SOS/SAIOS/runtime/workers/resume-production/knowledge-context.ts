/**
 * Load all mandatory knowledge sources for v2 production pipeline.
 */
import { loadResumeDesignKnowledge } from "../../../domain/studiosislab/resume/ResumeDesignKnowledge.js";
import { loadResumeIntelligenceEngine } from "../../../domain/studiosislab/resume/intelligence/ResumeIntelligenceEngine.js";
import { RESUME_GENERATION_SPECIFICATION } from "../../../domain/studiosislab/resume/ResumeGenerationSpecification.js";
import { loadDesignMemory } from "../resume-learning/design-memory.js";
import { analyzeIndustry } from "../../research/IndustryAnalyzer.js";

export const EDITOR_TECHNICAL_CONTRACT = {
  source: "Editor System Audit (Agent #053)",
  canvas: { width: 794, height: 1123, fabric_version: "6.9.1", page_size: "A4" },
  page_background: {
    index: 0,
    role: "pageBackground",
    locked: true,
    dimensions: "794×1123",
  },
  serialization_props: [
    "role", "data", "id", "name", "slbAssetId", "slbSource", "isPageBg", "locked", "hidden",
  ],
  forbidden: [
    "blob image src",
    "negative content coordinates",
    "skill bars / star ratings in ATS tier",
    "data URL images for cloud save",
  ],
} as const;

export type KnowledgeContext = {
  loaded_at: string;
  design_knowledge: ReturnType<typeof loadResumeDesignKnowledge>;
  intelligence: ReturnType<typeof loadResumeIntelligenceEngine>;
  generation_spec: typeof RESUME_GENERATION_SPECIFICATION;
  learning_memory: ReturnType<typeof loadDesignMemory>;
  editor_contract: typeof EDITOR_TECHNICAL_CONTRACT;
  corpus_template_count: number;
  successful_templates: string[];
};

export function loadKnowledgeContext(): KnowledgeContext {
  const design_knowledge = loadResumeDesignKnowledge();
  const intelligence = loadResumeIntelligenceEngine();
  let learning_memory;
  try {
    learning_memory = loadDesignMemory();
  } catch {
    learning_memory = {
      version: "1.0.0",
      updated_at: new Date().toISOString(),
      accepted_layouts: [],
      rejected_layouts: [],
      preferred_spacing: { min_section_gap_px: 16, min_paragraph_gap_px: 6, margin_px: 48 },
      preferred_typography: { font_families: ["Inter"], min_body_pt: 10.5, heading_scale: 1.8 },
      preferred_colors: { accent: ["#2563eb"], avoid: [], body_text: "#111827" },
      preferred_sections: { order: ["summary", "experience", "education", "skills"], elevate: [] },
      preferred_visual_density: "balanced" as const,
      preferred_ats_score: 85,
      preferred_visual_score: 75,
      feedback_count: 0,
    };
  }

  const successful_templates = intelligence.database.template_dna
    .filter((t) => t.ats_score >= 85)
    .slice(0, 10)
    .map((t) => t.id);

  return {
    loaded_at: new Date().toISOString(),
    design_knowledge,
    intelligence,
    generation_spec: RESUME_GENERATION_SPECIFICATION,
    learning_memory,
    editor_contract: EDITOR_TECHNICAL_CONTRACT,
    corpus_template_count: intelligence.database.published_template_count,
    successful_templates,
  };
}

export { analyzeIndustry };
