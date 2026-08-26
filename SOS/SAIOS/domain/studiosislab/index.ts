/**
 * StudiosisLab Domain Knowledge Pack — public exports
 */

export {
  loadStudiosisLabKnowledge,
  getTopCategoriesBySeo,
  getTopCategoriesByAts,
  getTotalRecommendedTemplates,
  KNOWLEDGE_VERSION,
  KNOWLEDGE_DOMAIN,
  RESUME_CATEGORIES,
  TOTAL_RECOMMENDED_TEMPLATES,
  TEMPLATE_STANDARDS,
  SEO_STANDARDS,
  ASSET_STANDARDS,
  FEATURE_CATALOG,
  REVENUE_STREAMS,
  SIXTY_DAY_REVENUE_OBJECTIVE,
  QUALITY_STANDARDS,
  ROADMAP_GOALS,
} from "./ResumeKnowledge.js";

export {
  getResumeCategoryById,
  getResumeCategoryByName,
  listResumeCategoriesByPriority,
} from "./ResumeCategories.js";

export { getFeatureById, listFeaturesByStatus } from "./FeatureCatalog.js";
export { getRevenueStreamById } from "./RevenueModel.js";
export { getQualityStandardById } from "./QualityStandards.js";
export { getRoadmapWeek } from "./RoadmapGoals.js";
export { getTemplateStandardById } from "./TemplateStandards.js";
export { getSEOStandardById } from "./SEOStandards.js";
export { getAssetStandardById } from "./AssetStandards.js";
export {
  BUSINESS_DELIVERABLES,
  getBusinessDeliverableById,
} from "./BusinessFeatureProfiles.js";
export type { BusinessDeliverableProfile } from "./BusinessFeatureProfiles.js";
export {
  detectBusinessIntents,
  mergeIntentWeights,
  scoreBusinessDeliverables,
  estimateHorizonDays,
  REVENUE_EXECUTION_ORDER,
} from "./BusinessScoring.js";
export type {
  BusinessObjectiveIntent,
  IntentWeights,
  ScoredDeliverable,
} from "./BusinessScoring.js";

export * from "./resume/index.js";

export type {
  DomainPriority,
  ImportanceScore,
  ResumeCategory,
  CatalogFeature,
  RevenueStream,
  RevenueObjective,
  RoadmapWeek,
  QualityStandard,
  TemplateStandard,
  SEOStandard,
  AssetStandard,
  StudiosisLabKnowledge,
} from "./types.js";
