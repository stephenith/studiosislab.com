/**
 * Agent #242 — Approved → Staged lifecycle contracts.
 * Staging never publishes. publication_allowed always false.
 */

export type TemplateLifecycleStatus =
  | "GENERATING"
  | "QUALITY_CHECK"
  | "READY_FOR_REVIEW"
  | "APPROVED"
  | "CHANGES_REQUESTED"
  | "REJECTED"
  | "STAGING_REQUESTED"
  | "STAGING"
  | "STAGED"
  | "VALIDATED"
  | "STAGING_FAILED"
  | "RELEASE_FAILED"
  | "PUBLISHING"
  | "PUBLICATION_FAILED"
  | "PUBLISHED"
  | "ROLLED_BACK";

export type StagingAuditEventType =
  | "FOUNDER_APPROVAL"
  | "CHANGES_REQUESTED"
  | "REJECTION"
  | "STAGING_REQUESTED"
  | "STAGING_STARTED"
  | "STAGING_VALIDATED"
  | "STAGING_COMPLETED"
  | "STAGING_FAILED"
  | "DUPLICATE_IDEMPOTENT_REQUEST"
  | "INVALID_TRANSITION_ATTEMPT"
  | "APPROVAL_INVALIDATED"
  | "GENERATION_ID_BACKFILL";

export type StagingAuditEvent = {
  event_id: string;
  type: StagingAuditEventType;
  timestamp: string;
  actor: string;
  candidate_id: string;
  generation_id: string | null;
  previous_status: TemplateLifecycleStatus | null;
  new_status: TemplateLifecycleStatus | null;
  decision_id: string | null;
  staging_package_id: string | null;
  reason: string;
  evidence_paths: string[];
  publication_allowed: false;
};

export type GenerationIdRecord = {
  generation_id: string;
  candidate_id: string;
  source_batch_id: string | null;
  source_execution_id: string | null;
  created_at: string;
  backfilled: boolean;
  content_fingerprint: string;
};

export type StagingManifest = {
  staging_package_id: string;
  schema_version: "staging-package-1.0.0";
  generation_id: string;
  candidate_id: string;
  source_batch_id: string | null;
  source_execution_id: string | null;
  source_provider: string | null;
  source_model: string | null;
  role: string;
  category: string;
  design_family: string | null;
  variant: number | null;
  title: string;
  source_created_at: string;
  founder_approved_at: string;
  staging_requested_at: string;
  staged_at: string;
  approval_decision_id: string;
  source_paths: Record<string, string>;
  artifact_checksums: Record<string, string>;
  ats_result: { score: number | null; pass: boolean };
  editor_compatibility_result: { pass: boolean; overall?: string };
  design_score: number | null;
  thumbnail_score: number | null;
  safe_area_result: { pass: boolean };
  contrast_result: { pass: boolean };
  founder_quality_class: string | null;
  current_lifecycle_status: "STAGED" | "VALIDATED" | "STAGING_FAILED";
  proposed_seo_slug: string;
  proposed_catalogue_metadata: {
    title: string;
    categoryId: string;
    role_family: string;
    design_family: string | null;
  };
  publication_allowed: false;
  live: false;
};

export type StagingValidationReport = {
  staging_package_id: string;
  candidate_id: string;
  generation_id: string;
  pass: boolean;
  checked_at: string;
  checks: Record<string, boolean>;
  errors: string[];
  warnings: string[];
  publication_allowed: false;
  release_manager_invoked: false;
  website_files_written: false;
  catalogue_id_allocated: false;
};

export type CandidateLifecycleRecord = {
  candidate_id: string;
  generation_id: string;
  lifecycle_status: TemplateLifecycleStatus;
  approval_decision_id: string | null;
  founder_approved_at: string | null;
  staging_package_id: string | null;
  content_fingerprint: string;
  updated_at: string;
  publication_allowed: false;
};

export type StageApprovedResult = {
  ok: boolean;
  idempotent: boolean;
  candidate_id: string;
  generation_id: string;
  staging_package_id: string | null;
  staging_path: string | null;
  lifecycle_status: TemplateLifecycleStatus;
  validation: StagingValidationReport | null;
  error: string | null;
  publication_allowed: false;
};
