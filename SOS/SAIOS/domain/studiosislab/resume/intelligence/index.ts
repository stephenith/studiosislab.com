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
} from "./ResumeIntelligenceEngine.js";

export type {
  DesignFamilyId,
  DesignFamily,
  TemplateDNA,
  ResumeGeneratorRule,
  ResumeIntelligenceDatabase,
  ResumeIntelligenceEngine,
} from "./types.js";
