/**
 * Shared types for Resume QA & Publishing Pipeline
 */

export type QASeverity = "required" | "recommended";

export type QACheck = {
  id: string;
  pass: boolean;
  detail: string;
  severity: QASeverity;
};

export type QAModuleReport = {
  module: string;
  pass: boolean;
  checked_at: string;
  checks: QACheck[];
};

export type FabricCanvasJson = {
  version: string;
  width?: number;
  height?: number;
  objects: Record<string, unknown>[];
  background?: string;
};

export type QATemplateContext = {
  template_id: string;
  prototype_id: string;
  tier: "ats_safe" | "visual";
  title: string;
  family_id: string;
  category_id: string;
  source_dir: string;
  json: FabricCanvasJson;
  thumbnail_path: string | null;
  proposed_catalog_id: string;
};

export type SEOProposal = {
  title: string;
  slug: string;
  category: string;
  keywords: string[];
  description: string;
  ats_tag: string;
  visual_tag: string;
};

export type PipelineStageResult = {
  stage: string;
  pass: boolean;
  report: QAModuleReport;
};

export type QAValidationSummary = {
  pass: boolean;
  template_id: string;
  prototype_id: string;
  validated_at: string;
  stages_passed: number;
  stages_total: number;
  stages: PipelineStageResult[];
};
