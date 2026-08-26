/**
 * Batch Release Manager — shared types.
 * AGENT #098 — orchestration only; coordinates existing Release Manager.
 */

export type PackageClassification =
  | "ready"
  | "blocked"
  | "published"
  | "rolled_back"
  | "incomplete";

export type ReleaseMode =
  | "dry_run"
  | "simulation"
  | "preview"
  | "rollback_preview"
  | "real_release";

export type ReleaseGroupType =
  | "single"
  | "production_batch"
  | "category"
  | "catalog_ids"
  | "industries"
  | "founder_list";

export type ReleaseGroup = {
  type: ReleaseGroupType;
  label: string;
  catalog_ids: string[];
  filter?: Record<string, string | string[]>;
};

export type PackageRecord = {
  catalog_id: string;
  prototype_id: string;
  package_dir: string;
  classification: PackageClassification;
  publication_state: string;
  founder_approved: boolean;
  founder_final_publish_approval: boolean;
  qa_status: string;
  category_id: string | null;
  industry: string | null;
  batch_id: string | null;
  validation: {
    pass: boolean;
    checks: Record<string, boolean>;
    errors: string[];
  };
  catalog_integrity_safe: boolean;
  blockers: string[];
};

export type BatchReleasePlan = {
  generated_at: string;
  mode: ReleaseMode;
  groups: ReleaseGroup[];
  queue: PackageRecord[];
  selected_for_release: string[];
  excluded: Array<{ catalog_id: string; reason: string }>;
};

export type BatchReleaseSimulation = {
  generated_at: string;
  mode: ReleaseMode;
  would_release: Array<{
    catalog_id: string;
    prototype_id: string;
    package_checksum: string;
    rollback_snapshot_would_be_created: boolean;
    validation_pass: boolean;
  }>;
  would_skip: Array<{ catalog_id: string; reason: string }>;
  live_changes: number;
};

export type BatchReleaseResult = {
  generated_at: string;
  mode: ReleaseMode;
  plan: BatchReleasePlan;
  simulation: BatchReleaseSimulation;
  dry_run: boolean;
  published_count: number;
  rollback_summary: {
    rolled_back_releases: number;
    snapshots_available: number;
    live_release: string;
  };
};
