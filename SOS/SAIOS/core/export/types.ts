/**
 * Agent #243 — StudiosisLab Export Adapter contracts.
 * Export never publishes. publication_allowed always false.
 */

export type ReservationStatus =
  | "RESERVED"
  | "EXPORT_BUILT"
  | "ASSETS_READY"
  | "ASSET_PROCESSING_FAILED"
  | "READY_FOR_RELEASE"
  | "PUBLICATION_VALIDATION_FAILED"
  | "RELEASE_REQUESTED"
  | "FOUNDER_RELEASE_APPROVED"
  | "RELEASE_EXECUTING"
  | "RELEASE_COMPLETED"
  | "RELEASE_FAILED"
  | "COMMITTED"
  | "FAILED"
  | "ROLLED_BACK"
  | "CANCELLED";

export type CatalogueReservation = {
  reservation_id: string;
  reserved_catalogue_id: string;
  generation_id: string;
  candidate_id: string;
  staging_package_id: string;
  reserved_at: string;
  status: ReservationStatus;
  reason: string;
  checksum: string;
  export_package_id: string | null;
  updated_at: string;
  publication_allowed: false;
};

export type ExportOrigin = {
  generation_id: string;
  candidate_id: string;
  approval_decision_id: string;
  staging_package_id: string;
  reservation_id: string;
  reserved_catalogue_id: string;
  export_package_id: string;
  future_release_id: null;
  source_batch: string | null;
  openai_provider: string | null;
  openai_model: string | null;
  role: string;
  design_family: string | null;
  created_at: string;
  publication_allowed: false;
  live: false;
};

export type ManifestDraftEntry = {
  id: string;
  title: string;
  categoryId: string;
  thumbnailPath: string;
  jsonPath: string;
  status: "draft";
  tags: string[];
};

export type SeoDraft = {
  templateId: string;
  title: string;
  slug: string;
  description: string;
  keywords: string[];
  canonical_draft: string;
  collision: boolean;
  suggested_alternate_slug: string | null;
  h1: string;
  isPublished: false;
};

export type SearchMetadata = {
  templateId: string;
  title: string;
  role: string;
  category: string;
  categoryId: string;
  tags: string[];
  keywords: string[];
  normalized_text: string;
};

export type AssetPlan = {
  catalogue_id: string;
  expected_png: string;
  expected_webp: string;
  future_avif: string;
  source_preview: string;
  source_thumbnail: string;
  optimization_deferred: true;
};

export type ExportValidationReport = {
  export_package_id: string;
  candidate_id: string;
  generation_id: string;
  pass: boolean;
  checked_at: string;
  checks: Record<string, boolean>;
  errors: string[];
  warnings: string[];
  publication_allowed: false;
  website_files_written: false;
  release_manager_invoked: false;
  live_manifest_modified: false;
};

export type ExportResult = {
  ok: boolean;
  idempotent: boolean;
  candidate_id: string;
  generation_id: string;
  staging_package_id: string | null;
  reservation_id: string | null;
  reserved_catalogue_id: string | null;
  export_package_id: string | null;
  export_path: string | null;
  validation: ExportValidationReport | null;
  error: string | null;
  publication_allowed: false;
};
