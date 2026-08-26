/**
 * StudiosisLab domain knowledge — shared types
 */

export type DomainPriority = "P0" | "P1" | "P2" | "P3";

export type ImportanceScore = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

export type ResumeCategory = {
  id: string;
  name: string;
  priority: DomainPriority;
  seo_value: ImportanceScore;
  ats_importance: ImportanceScore;
  sample_job_roles: string[];
  recommended_template_count: number;
};

export type CatalogFeature = {
  id: string;
  name: string;
  description: string;
  priority: DomainPriority;
  revenue_relevance: ImportanceScore;
  status: "live" | "planned" | "roadmap";
};

export type RevenueStream = {
  id: string;
  name: string;
  description: string;
  priority: DomainPriority;
};

export type RevenueObjective = {
  horizon_days: number;
  target_description: string;
  primary_streams: string[];
  milestones: { day: number; goal: string }[];
};

export type RoadmapWeek = {
  week: number;
  title: string;
  goals: string[];
  deliverables: string[];
};

export type QualityStandard = {
  id: string;
  name: string;
  description: string;
  metrics: string[];
  minimum_score: number;
};

export type TemplateStandard = {
  id: string;
  name: string;
  requirements: string[];
};

export type SEOStandard = {
  id: string;
  name: string;
  requirements: string[];
};

export type AssetStandard = {
  id: string;
  name: string;
  formats: string[];
  requirements: string[];
};

export type StudiosisLabKnowledge = {
  version: string;
  domain: "studiosislab";
  categories: ResumeCategory[];
  features: CatalogFeature[];
  revenue: {
    streams: RevenueStream[];
    objective: RevenueObjective;
  };
  roadmap: RoadmapWeek[];
  quality: QualityStandard[];
  template_standards: TemplateStandard[];
  seo_standards: SEOStandard[];
  asset_standards: AssetStandard[];
};
