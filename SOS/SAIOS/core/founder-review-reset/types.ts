/** Agent #250 — Founder Review workspace reset contracts. */

export const REVIEW_WORKSPACE_VERSION = "1.0.0";
export const ACTIVE_BATCH_TAG = "agent250-fresh";

export type ReviewWorkspaceManifest = {
  schema_version: "founder-review-workspace-1.0.0";
  mode: "active_registry_only";
  batch_tag: string;
  batch_id: string | null;
  candidate_ids: string[];
  archived_to: string;
  archived_count: number;
  generated_at: string;
  live: false;
  publication_allowed: false;
  awaiting_founder_review: true;
  agent: 250;
};
