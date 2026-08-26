/**
 * Resume Catalog & Publication Manager — shared types.
 */

export type PublicationState =
  | "draft"
  | "founder_approved"
  | "ready_to_publish"
  | "published"
  | "archived"
  | "deprecated";

export type PublicationTier = "ats_safe" | "visual" | "hybrid";

export type TemplateMetadata = {
  template_id: string;
  catalog_id: string;
  prototype_id: string;
  title: string;
  version: string;
  publication_state: PublicationState;
  approval_date: string | null;
  founder: string;
  industry: string;
  ats_tier: PublicationTier;
  visual_tier: PublicationTier;
  difficulty: "beginner" | "intermediate" | "advanced";
  experience_level: string;
  layout_family: string;
  color_family: string;
  design_family: string;
  category_id: string;
};

export type CategoryMetadata = {
  category_id: string;
  label: string;
  description: string;
  template_count: number;
  industries: string[];
  ats_tiers: PublicationTier[];
};

export type SEODraft = {
  meta_title: string;
  meta_description: string;
  slug: string;
  keywords: string[];
  structured_data: Record<string, unknown>;
  open_graph: Record<string, string>;
  twitter_card: Record<string, string>;
  internal_links: string[];
  faq_suggestions: Array<{ question: string; answer: string }>;
};

export type ManifestDraft = {
  id: string;
  title: string;
  categoryId: string;
  thumbnailPath: string;
  jsonPath: string;
  status: "draft";
  tags: string[];
};

export type RegistryDraft = {
  export_name: string;
  snippet: string;
};

export type PublicationRecord = {
  publication_id: string;
  catalog_id: string;
  prototype_id: string;
  state: PublicationState;
  founder_approved: boolean;
  founder_final_publish_approval: false;
  prepared_at: string;
  package_dir: string;
  artifacts: string[];
  validation_pass: boolean;
};

export type CatalogEntry = TemplateMetadata & {
  slug: string;
  thumbnail_path: string;
  added_at: string;
};

export type MasterCatalog = {
  version: string;
  updated_at: string;
  categories: CategoryMetadata[];
  templates: CatalogEntry[];
};

export type ReleasePackage = {
  release_id: string;
  catalog_id: string;
  prototype_id: string;
  state: PublicationState;
  files: Record<string, string>;
  manual_steps: string[];
  waiting_for: "founder_final_publish_approval";
};

export type PublicationRunResult = {
  pass: boolean;
  catalog_id: string;
  prototype_id: string;
  output_root: string;
  package_dir: string;
  state: PublicationState;
  publication: PublicationRecord;
  validation: PublicationValidation;
  artifacts: string[];
};

export type PublicationValidation = {
  pass: boolean;
  checks: Record<string, boolean>;
  errors: string[];
};

export type PublicationRunOptions = {
  prototype_dir?: string;
  founder_approved?: boolean;
  founder_name?: string;
  persist?: boolean;
};

export type CollectedApprovalContext = {
  prototype_id: string;
  prototype_dir: string;
  qa_pass: boolean;
  qa_validation_path: string;
  critic_ready: boolean;
  critic_score: number;
  design_plan: Record<string, unknown> | null;
  premium_scores: Record<string, number> | null;
  seo_qa: Record<string, unknown> | null;
  objective: string;
  family_id: string;
  tier: PublicationTier;
};
