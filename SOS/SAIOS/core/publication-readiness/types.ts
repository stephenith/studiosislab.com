/**
 * Agent #245 — Publication Readiness Validator contracts.
 * Never publishes. Never writes the live website.
 */

export const PUBLICATION_READINESS_VERSION = "1.0.0";

export type PublicationReadinessResult = {
  ok: boolean;
  idempotent: boolean;
  export_package_id: string;
  export_path: string | null;
  status:
    | "READY_FOR_RELEASE"
    | "PUBLICATION_VALIDATION_FAILED"
    | "REJECTED"
    | "ASSETS_READY";
  ready_for_release: boolean;
  report_path: string | null;
  simulation_path: string | null;
  error: string | null;
  publication_allowed: false;
};

export type DryRunStep = {
  step: string;
  action: string;
  target: string;
  would_write: boolean;
  simulated: true;
  ok: boolean;
  detail: string;
};

export type DryRunSimulationReport = {
  schema_version: "publication-dry-run-1.0.0";
  export_package_id: string;
  catalogue_id: string;
  simulated_at: string;
  website_modified: false;
  release_manager_invoked: false;
  steps: DryRunStep[];
  pass: boolean;
  publication_allowed: false;
};

export type PublicationReadinessDoc = {
  schema_version: "publication-readiness-1.0.0";
  export_package_id: string;
  catalogue_id: string;
  reservation_id: string;
  status: "PASS" | "FAIL";
  ready_for_release: boolean;
  release_version: string;
  publication_readiness_version: string;
  checked_at: string;
  blocking_issues: string[];
  warnings: string[];
  checks: Record<string, boolean>;
  sections: {
    package_files: boolean;
    manifest: boolean;
    fabric: boolean;
    seo: boolean;
    assets: boolean;
    integrity: boolean;
    compatibility: boolean;
    dry_run: boolean;
  };
  future_release_manager_compatible: boolean;
  publication_allowed: false;
  live: false;
  website_files_written: false;
  release_manager_invoked: false;
};
