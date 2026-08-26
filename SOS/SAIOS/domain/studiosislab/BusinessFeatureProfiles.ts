import type { ImportanceScore } from "./types.js";

/**
 * Business deliverable profiles for StudiosisLab execution planning.
 * Includes catalog features and derived revenue/SEO work items.
 */
export type BusinessDeliverableProfile = {
  id: string;
  name: string;
  catalog_feature_id: string | null;
  description: string;
  revenue_impact_base: ImportanceScore;
  traffic_impact_base: ImportanceScore;
  seo_impact_base: ImportanceScore;
  acquisition_impact_base: ImportanceScore;
  ads_impact_base: ImportanceScore;
  development_cost: ImportanceScore;
  dependency_ids: string[];
  worker_type: string;
  capability: string;
  job_count_strategy: "category_templates" | "category_seo_pages" | "fixed";
  fixed_job_count?: number;
  parallel_safe: boolean;
};

export const BUSINESS_DELIVERABLES: readonly BusinessDeliverableProfile[] = [
  {
    id: "resume-templates",
    name: "Resume Templates",
    catalog_feature_id: "resume-templates",
    description: "ATS resume template library across all categories",
    revenue_impact_base: 10,
    traffic_impact_base: 8,
    seo_impact_base: 7,
    acquisition_impact_base: 9,
    ads_impact_base: 8,
    development_cost: 7,
    dependency_ids: [],
    worker_type: "resume-worker",
    capability: "resume",
    job_count_strategy: "category_templates",
    parallel_safe: true,
  },
  {
    id: "seo-landing-pages",
    name: "SEO Landing Pages",
    catalog_feature_id: null,
    description: "Category and role-specific SEO landing pages",
    revenue_impact_base: 9,
    traffic_impact_base: 10,
    seo_impact_base: 10,
    acquisition_impact_base: 9,
    ads_impact_base: 7,
    development_cost: 4,
    dependency_ids: [],
    worker_type: "seo-worker",
    capability: "seo",
    job_count_strategy: "category_seo_pages",
    parallel_safe: true,
  },
  {
    id: "ats-improvements",
    name: "ATS Improvements",
    catalog_feature_id: "ats-checker",
    description: "ATS checker enhancements and validation coverage",
    revenue_impact_base: 8,
    traffic_impact_base: 7,
    seo_impact_base: 6,
    acquisition_impact_base: 8,
    ads_impact_base: 6,
    development_cost: 5,
    dependency_ids: ["resume-templates"],
    worker_type: "testing-worker",
    capability: "testing",
    job_count_strategy: "fixed",
    fixed_job_count: 12,
    parallel_safe: false,
  },
  {
    id: "resume-assets",
    name: "Resume Assets",
    catalog_feature_id: null,
    description: "Icons, thumbnails, and reusable resume asset packs",
    revenue_impact_base: 7,
    traffic_impact_base: 6,
    seo_impact_base: 5,
    acquisition_impact_base: 6,
    ads_impact_base: 7,
    development_cost: 5,
    dependency_ids: ["resume-templates"],
    worker_type: "ui-worker",
    capability: "ui",
    job_count_strategy: "fixed",
    fixed_job_count: 30,
    parallel_safe: true,
  },
  {
    id: "cover-letter",
    name: "Cover Letter",
    catalog_feature_id: "cover-letter",
    description: "Cover letter templates paired with resume categories",
    revenue_impact_base: 7,
    traffic_impact_base: 6,
    seo_impact_base: 6,
    acquisition_impact_base: 7,
    ads_impact_base: 5,
    development_cost: 6,
    dependency_ids: ["resume-templates", "seo-landing-pages"],
    worker_type: "resume-worker",
    capability: "resume",
    job_count_strategy: "fixed",
    fixed_job_count: 15,
    parallel_safe: true,
  },
  {
    id: "invoice-generator",
    name: "Invoice Generator",
    catalog_feature_id: "invoice-generator",
    description: "Freelancer invoice templates and export flows",
    revenue_impact_base: 6,
    traffic_impact_base: 4,
    seo_impact_base: 4,
    acquisition_impact_base: 5,
    ads_impact_base: 6,
    development_cost: 7,
    dependency_ids: ["resume-templates"],
    worker_type: "invoice-worker",
    capability: "invoice",
    job_count_strategy: "fixed",
    fixed_job_count: 10,
    parallel_safe: true,
  },
  {
    id: "portfolio-builder",
    name: "Portfolio Builder",
    catalog_feature_id: "portfolio-builder",
    description: "Portfolio showcase pages for creative professionals",
    revenue_impact_base: 5,
    traffic_impact_base: 5,
    seo_impact_base: 5,
    acquisition_impact_base: 5,
    ads_impact_base: 4,
    development_cost: 8,
    dependency_ids: ["resume-templates", "resume-assets"],
    worker_type: "portfolio-worker",
    capability: "portfolio",
    job_count_strategy: "fixed",
    fixed_job_count: 12,
    parallel_safe: true,
  },
  {
    id: "pdf-tools",
    name: "PDF Tools",
    catalog_feature_id: "pdf-tools",
    description: "PDF merge, compress, and export utilities",
    revenue_impact_base: 6,
    traffic_impact_base: 5,
    seo_impact_base: 4,
    acquisition_impact_base: 6,
    ads_impact_base: 7,
    development_cost: 5,
    dependency_ids: ["resume-templates"],
    worker_type: "pdf-worker",
    capability: "pdf",
    job_count_strategy: "fixed",
    fixed_job_count: 8,
    parallel_safe: true,
  },
] as const;

export function getBusinessDeliverableById(id: string): BusinessDeliverableProfile | undefined {
  return BUSINESS_DELIVERABLES.find((d) => d.id === id);
}
