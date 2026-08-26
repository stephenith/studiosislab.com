import { DESIGN_FAMILIES, getDesignFamilyById, getTemplatesInFamily } from "./DesignFamilies.js";
import { RESUME_GENERATOR_RULES, getGeneratorRulesForTier, getRequiredGeneratorRules } from "./ResumeGeneratorRules.js";
import {
  buildResumeIntelligenceDatabase,
  getTemplateDNA,
  getTemplateDNAById,
  getTemplatesByFamily,
} from "./TemplateDNA.js";
import type { DesignFamilyId, ResumeIntelligenceEngine } from "./types.js";

export const RESUME_INTELLIGENCE_VERSION = "1.0.0";

/**
 * Load the complete Resume Intelligence Engine.
 * Every Resume Worker MUST consult this before designing any template.
 */
export function loadResumeIntelligenceEngine(): ResumeIntelligenceEngine {
  return {
    version: RESUME_INTELLIGENCE_VERSION,
    database: buildResumeIntelligenceDatabase(),
    generator_rules: [...RESUME_GENERATOR_RULES],
  };
}

export {
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
};

export type {
  DesignFamilyId,
  DesignFamily,
  TemplateDNA,
  ResumeGeneratorRule,
  ResumeIntelligenceDatabase,
  ResumeIntelligenceEngine,
  ColumnStructure,
  SpacingProfile,
  TypographyProfile,
  ColorProfile,
  SectionProfile,
} from "./types.js";
