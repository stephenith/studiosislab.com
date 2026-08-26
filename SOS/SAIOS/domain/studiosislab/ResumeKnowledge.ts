import { RESUME_CATEGORIES, TOTAL_RECOMMENDED_TEMPLATES } from "./ResumeCategories.js";
import { TEMPLATE_STANDARDS } from "./TemplateStandards.js";
import { SEO_STANDARDS } from "./SEOStandards.js";
import { ASSET_STANDARDS } from "./AssetStandards.js";
import { FEATURE_CATALOG } from "./FeatureCatalog.js";
import { REVENUE_STREAMS, SIXTY_DAY_REVENUE_OBJECTIVE } from "./RevenueModel.js";
import { QUALITY_STANDARDS } from "./QualityStandards.js";
import { ROADMAP_GOALS } from "./RoadmapGoals.js";
import type { ResumeCategory, StudiosisLabKnowledge } from "./types.js";

export const KNOWLEDGE_VERSION = "1.0.0";
export const KNOWLEDGE_DOMAIN = "studiosislab" as const;

/**
 * Aggregated StudiosisLab domain knowledge pack.
 * Knowledge only — no runtime, execution, or Cursor integration.
 */
export function loadStudiosisLabKnowledge(): StudiosisLabKnowledge {
  return {
    version: KNOWLEDGE_VERSION,
    domain: KNOWLEDGE_DOMAIN,
    categories: [...RESUME_CATEGORIES],
    features: [...FEATURE_CATALOG],
    revenue: {
      streams: [...REVENUE_STREAMS],
      objective: SIXTY_DAY_REVENUE_OBJECTIVE,
    },
    roadmap: [...ROADMAP_GOALS],
    quality: [...QUALITY_STANDARDS],
    template_standards: [...TEMPLATE_STANDARDS],
    seo_standards: [...SEO_STANDARDS],
    asset_standards: [...ASSET_STANDARDS],
  };
}

export function getTopCategoriesBySeo(limit = 5): ResumeCategory[] {
  return [...RESUME_CATEGORIES].sort((a, b) => b.seo_value - a.seo_value).slice(0, limit);
}

export function getTopCategoriesByAts(limit = 5): ResumeCategory[] {
  return [...RESUME_CATEGORIES].sort((a, b) => b.ats_importance - a.ats_importance).slice(0, limit);
}

export function getTotalRecommendedTemplates(): number {
  return TOTAL_RECOMMENDED_TEMPLATES;
}

export {
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
};
