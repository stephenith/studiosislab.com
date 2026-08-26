/**
 * Agent #249 — Founder Revision Batch contracts.
 * Revisions return templates to Founder review. Never auto-approve. Never publish.
 */

export const FOUNDER_REVISION_BATCH_VERSION = "1.0.0";
export const REVISION_TAG = "rev249";

export type RevisionBatchStatus =
  | "REVISION_BATCH_READY_FOR_REVIEW"
  | "REVISION_BATCH_PARTIAL"
  | "REVISION_BATCH_FAILED";

export type RevisionSummary = {
  schema_version: "founder-revision-summary-1.0.0";
  candidate_id: string;
  prior_candidate_id: string;
  prior_revision_id: string | null;
  new_revision_id: string;
  revision_number: number;
  role: string;
  design_family: string;
  review_id: string;
  prior_review_id: string;
  prior_decision_id: string | null;
  requested_changes: string[];
  changes_applied: string[];
  changes_not_applied: string[];
  validation: {
    layout_pass: boolean;
    ats_pass: boolean;
    content_pass: boolean;
    asset_pass: boolean;
    critic_overall: number | null;
    critic_ats: number | null;
    overflow: boolean;
  };
  preview: string;
  thumbnail: string;
  status: "READY_FOR_FOUNDER_REVIEW";
  ready_for_founder_review: true;
  approved: false;
  publication_allowed: false;
  live: false;
  created_at: string;
  changelog_path: string;
};

export type BatchTemplateSpec = {
  role: string;
  family: string;
  prior_candidate_id: string;
  prior_review_id: string;
};
