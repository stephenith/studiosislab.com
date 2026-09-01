/**
 * Multi-eligible AIOS publication workflow contracts.
 * Discovery-based plans — never silently omit VALIDATED staged candidates.
 */

export const PUBLICATION_WORKFLOW_VERSION = "publication-workflow-1.0.0";

export type PublicationPlanStatus =
  | "DRAFT"
  | "VERIFIED"
  | "LOCKED"
  | "PUBLISHING"
  | "COMPLETED"
  | "FAILED"
  | "SUPERSEDED";

export type PublicationStatusLabel =
  | "APPROVED_NOT_STAGED"
  | "VALIDATED_ELIGIBLE"
  | "PLANNED"
  | "VERIFIED"
  | "PUBLISHING"
  | "PUBLISHED"
  | "PUBLICATION_FAILED"
  | "EXCLUDED_SUPERSEDED"
  | "EXCLUDED_ALREADY_PUBLISHED"
  | "EXCLUDED_CHANGES_REQUESTED"
  | "EXCLUDED_REJECTED"
  | "EXCLUDED_VALIDATION_FAILED"
  | "EXCLUDED_MISSING_STAGING"
  | "EXCLUDED_NON_PRODUCTION"
  | "EXCLUDED_OTHER";

export type ExclusionReasonCode =
  | "CHANGES_REQUESTED"
  | "REJECTED"
  | "SUPERSEDED"
  | "ALREADY_PUBLISHED"
  | "RELEASE_COMPLETED"
  | "LIFECYCLE_PUBLISHED"
  | "NOT_APPROVED"
  | "NOT_VALIDATED"
  | "MISSING_STAGING_PACKAGE"
  | "VALIDATION_FAILED"
  | "CONFLICTING_RESERVATION"
  | "PUBLICATION_FAILURE_MANUAL"
  | "IN_ACTIVE_PLAN"
  | "NON_PRODUCTION"
  | "OTHER";

/** Persisted plan eligibility scope (Phase 5Q). */
export type PublicationPlanScope = {
  mode: "all_eligible" | "explicit";
  /** Explicit Resume Template legacy IDs; empty when mode=all_eligible. */
  candidate_ids: string[];
};

export type EligibilityProof = {
  founder_decision_id: string;
  founder_decision: "APPROVED";
  founder_decided_at: string;
  lifecycle_status: "VALIDATED";
  staging_package_id: string;
  validation_pass: true;
  not_superseded: true;
  not_release_completed: true;
  not_lifecycle_published: true;
  no_conflicting_reservation: true;
};

export type EligibleCandidate = {
  candidate_id: string;
  title: string;
  decision_id: string;
  review_id: string;
  generation_id: string;
  staging_package_id: string;
  founder_approved_at: string;
  staged_at: string;
  sort_key: string;
  proposed_catalogue_id: string;
  expected_generated_files: string[];
  eligibility_proof: EligibilityProof;
  evidence: {
    lifecycle_path: string;
    staging_package_path: string;
    validation_report_path: string;
    candidate_json_path: string;
  };
};

export type ExcludedCandidate = {
  candidate_id: string;
  title: string | null;
  status_label: PublicationStatusLabel;
  reason_code: ExclusionReasonCode;
  reason: string;
  lifecycle_status: string | null;
  staging_package_id: string | null;
  catalogue_id: string | null;
  decision: string | null;
};

export type PublicationPlanEntry = {
  candidate_id: string;
  title: string;
  decision_id: string;
  review_id: string;
  generation_id: string;
  staging_package_id: string;
  proposed_catalogue_id: string;
  expected_generated_files: string[];
  sort_key: string;
  founder_approved_at: string;
  staged_at: string;
  eligibility_proof: EligibilityProof;
  evidence: EligibleCandidate["evidence"];
  current_state: {
    lifecycle_status: string;
    reservation_status: string | null;
    existing_catalogue_id: string | null;
  };
};

export type PublicationPlan = {
  schema_version: "publication-plan-1.0.0";
  workflow_version: typeof PUBLICATION_WORKFLOW_VERSION;
  plan_id: string;
  status: PublicationPlanStatus;
  created_at: string;
  updated_at: string;
  eligibility_fingerprint: string;
  /** Scope used for discovery fingerprint + verify/apply re-discovery. */
  scope: PublicationPlanScope;
  confirm_phrase: string;
  entries: PublicationPlanEntry[];
  excluded: ExcludedCandidate[];
  warnings: string[];
  proposed_catalogue_ids: string[];
  git_path_allowlist: string[];
  quarantined_template_ids: string[];
  website_writes: false;
  reservations_created: false;
  publication_allowed: false;
  live: false;
  verification: PublicationVerificationReport | null;
  apply: PublicationApplyRecord | null;
};

export type PublicationVerificationCheck = {
  name: string;
  pass: boolean;
  detail: string;
  candidate_id?: string;
};

export type PublicationVerificationReport = {
  plan_id: string;
  verified_at: string;
  pass: boolean;
  checks: PublicationVerificationCheck[];
  errors: string[];
  warnings: string[];
  eligible_count: number;
  discovered_eligible_count: number;
  omission_detected: boolean;
};

export type PublicationApplyRecord = {
  plan_id: string;
  started_at: string;
  finished_at: string | null;
  status: "DRY_RUN" | "PUBLISHING" | "COMPLETED" | "FAILED";
  confirm_phrase_accepted: boolean;
  execute_writes: boolean;
  steps_completed: string[];
  partial_writes: string[];
  results: Array<{
    candidate_id: string;
    catalogue_id: string;
    export_package_id: string | null;
    release_id: string | null;
    git_commit_sha: string | null;
    deployment_id: string | null;
    live_url: string | null;
    published: boolean;
  }>;
  error: string | null;
  recovery_instructions: string[];
  website_modified: boolean;
  git_committed: boolean;
  git_pushed: boolean;
  live_verified: boolean;
};

export type CandidatePublicationStatus = {
  candidate_id: string;
  title: string | null;
  status_label: PublicationStatusLabel;
  lifecycle_status: string | null;
  staging_package_id: string | null;
  catalogue_id: string | null;
  plan_id: string | null;
  release_id: string | null;
  git_commit_sha: string | null;
  live_url: string | null;
  decision: string | null;
  reason: string | null;
};

export type ReconciliationProposal = {
  candidate_id: string;
  catalogue_id: string;
  current_lifecycle_status: string;
  proposed_lifecycle_status: "PUBLISHED";
  evidence: {
    reservation_status: string;
    release_id: string | null;
    manifest_present: boolean;
    git_commit_sha: string | null;
  };
  republish: false;
  website_writes: false;
  applied: boolean;
};
