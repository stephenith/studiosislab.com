/**
 * StudiosisLab Resume Design Knowledge Pack — public exports
 */

export {
  loadResumeDesignKnowledge,
  RESUME_KNOWLEDGE_VERSION,
  RESUME_KNOWLEDGE_DOMAIN,
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
} from "./ResumeDesignKnowledge.js";

export { FABRIC_JSON_STRUCTURE } from "./TemplateCorpusAnalysis.js";
export { getDesignStandardById } from "./DesignStandards.js";
export { getAtsStandardById, MARKET_ATS_NOTES, EXTERNAL_ATS_PRINCIPLES_2025_2026 } from "./ATSStandards.js";
export { getLayoutRuleById, LAYOUT_SAFE_AREA } from "./LayoutRules.js";
export { FONT_TIERS, TYPOGRAPHY_RULES, getTypographyScale } from "./TypographyRules.js";
export {
  getSectionById,
  getSectionsForCategory,
  CATEGORY_SECTION_DEFAULTS,
} from "./SectionLibrary.js";
export { getRequiredChecks, getAutoCheckableChecks } from "./ValidationChecklist.js";

export {
  loadResumeIntelligenceEngine,
  RESUME_INTELLIGENCE_VERSION,
  DESIGN_FAMILIES,
  getDesignFamilyById,
  getTemplatesInFamily,
  RESUME_GENERATOR_RULES,
  getGeneratorRulesForTier,
  getRequiredGeneratorRules,
  getTemplateDNA,
  getTemplateDNAById,
  getTemplatesByFamily,
  buildResumeIntelligenceDatabase,
} from "./intelligence/index.js";

export type {
  DesignFamilyId,
  DesignFamily,
  TemplateDNA,
  ResumeGeneratorRule,
  ResumeIntelligenceDatabase,
  ResumeIntelligenceEngine,
} from "./intelligence/types.js";

export type { ResumeGenerationSpecification } from "./ResumeGenerationSpecification.js";
export type { ThumbnailSpecification } from "./ThumbnailSpecification.js";
export type { SampleProfileStandards } from "./SampleProfileStandards.js";

export type {
  MarketRegion,
  AtsRiskLevel,
  ChecklistSeverity,
  ValidationCheckItem,
  SectionDefinition,
  TypographyScale,
  LayoutRule,
  DesignStandard,
  CorpusAnalysisSummary,
  ResumeDesignKnowledge,
} from "./types.js";
