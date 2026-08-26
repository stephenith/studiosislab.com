import { DESIGN_STANDARDS } from "./DesignStandards.js";
import { ATS_STANDARDS } from "./ATSStandards.js";
import { LAYOUT_RULES } from "./LayoutRules.js";
import { TYPOGRAPHY_SCALE } from "./TypographyRules.js";
import { SECTION_LIBRARY } from "./SectionLibrary.js";
import { RESUME_GENERATION_SPECIFICATION } from "./ResumeGenerationSpecification.js";
import { VALIDATION_CHECKLIST } from "./ValidationChecklist.js";
import { THUMBNAIL_SPECIFICATION } from "./ThumbnailSpecification.js";
import { SAMPLE_PROFILE_STANDARDS } from "./SampleProfileStandards.js";
import { TEMPLATE_CORPUS_ANALYSIS } from "./TemplateCorpusAnalysis.js";
import {
  EXTERNAL_BEST_PRACTICES,
  GAP_ANALYSIS,
  IMPROVEMENT_PRIORITIES,
} from "./ExternalBestPractices.js";
import { loadResumeIntelligenceEngine } from "./intelligence/ResumeIntelligenceEngine.js";
import type { ResumeDesignKnowledge } from "./types.js";

export const RESUME_KNOWLEDGE_VERSION = "1.0.0";
export const RESUME_KNOWLEDGE_DOMAIN = "studiosislab-resume" as const;

/**
 * Load the complete StudiosisLab Resume Design Knowledge Pack.
 * Every future Resume Worker must consult this before creating templates.
 */
export function loadResumeDesignKnowledge(): ResumeDesignKnowledge {
  return {
    version: RESUME_KNOWLEDGE_VERSION,
    domain: RESUME_KNOWLEDGE_DOMAIN,
    corpus: TEMPLATE_CORPUS_ANALYSIS,
    design_standards: [...DESIGN_STANDARDS],
    ats_standards: [...ATS_STANDARDS],
    layout_rules: [...LAYOUT_RULES],
    typography_scale: [...TYPOGRAPHY_SCALE],
    sections: [...SECTION_LIBRARY],
    generation_spec: { ...RESUME_GENERATION_SPECIFICATION },
    validation_checklist: [...VALIDATION_CHECKLIST],
    thumbnail_spec: { ...THUMBNAIL_SPECIFICATION },
    sample_profile_standards: { ...SAMPLE_PROFILE_STANDARDS },
    external_principles: { ...EXTERNAL_BEST_PRACTICES, improvement_priorities: [...IMPROVEMENT_PRIORITIES] },
    gap_analysis: [...GAP_ANALYSIS],
    intelligence: loadResumeIntelligenceEngine(),
  };
}

export {
  DESIGN_STANDARDS,
  ATS_STANDARDS,
  LAYOUT_RULES,
  TYPOGRAPHY_SCALE,
  SECTION_LIBRARY,
  RESUME_GENERATION_SPECIFICATION,
  VALIDATION_CHECKLIST,
  THUMBNAIL_SPECIFICATION,
  SAMPLE_PROFILE_STANDARDS,
  TEMPLATE_CORPUS_ANALYSIS,
  EXTERNAL_BEST_PRACTICES,
  GAP_ANALYSIS,
  IMPROVEMENT_PRIORITIES,
};
