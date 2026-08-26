/**
 * Agent #246 — Founder Release Controller contracts.
 * Authorization layer only; ReleaseManager executes when authorized.
 * No auto-publish. LIVE remains OFF unless Founder explicitly releases.
 */

export const FOUNDER_RELEASE_CONTROLLER_VERSION = "1.0.0";

export type ReleaseLifecycleStatus =
  | "READY_FOR_RELEASE"
  | "RELEASE_REQUESTED"
  | "FOUNDER_RELEASE_APPROVED"
  | "RELEASE_EXECUTING"
  | "RELEASE_COMPLETED"
  | "RELEASE_FAILED";

export type FounderReleaseAuthorization = {
  authorization_id: string;
  export_package_id: string;
  catalogue_id: string;
  reservation_id: string;
  founder_name: string;
  approved_at: string;
  explicit_approval: true;
  confirm_phrase: "RELEASE_TO_STUDIOSISLAB";
  scope: "export_package_release";
  nonce: string;
  signature: string;
};

export type ReleaseAuditEventType =
  | "release_requested"
  | "approval"
  | "approval_rejected"
  | "execution_started"
  | "execution"
  | "rollback"
  | "completion"
  | "failure";

export type ReleaseAuditEvent = {
  at: string;
  type: ReleaseAuditEventType;
  export_package_id: string;
  catalogue_id: string | null;
  reservation_id: string | null;
  release_id: string | null;
  authorization_id: string | null;
  actor: string;
  detail: string;
  ok: boolean;
};

export type PublicationPlan = {
  export_package_id: string;
  catalogue_id: string;
  title: string;
  category_id: string;
  seo_slug: string;
  seo_slug_resolved: string;
  seo_collision: boolean;
  assets: string[];
  risk_summary: string[];
  steps: string[];
  publication_allowed_auto: false;
  requires_explicit_founder_approval: true;
};

export type FounderReleaseResult = {
  ok: boolean;
  export_package_id: string;
  catalogue_id: string | null;
  reservation_id: string | null;
  release_id: string | null;
  status: ReleaseLifecycleStatus | "REJECTED";
  authorization_id: string | null;
  error: string | null;
  rolled_back: boolean;
  website_modified: boolean;
  auto_publish: false;
  live: false;
};
