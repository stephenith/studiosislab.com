/**
 * Catalog Integrity — shared types.
 * AGENT #097 — validation / resolution planning only.
 */

export type ConflictSeverity = "critical" | "warning" | "info";

export type CatalogConflict = {
  type: string;
  severity: ConflictSeverity;
  value: string;
  occurrences: Array<{
    source: string;
    ref: string;
    prototype_id?: string;
    catalog_id?: string;
  }>;
  recommended_action: string;
  suggested_catalog_id?: string;
};

export type ResolutionEntry = {
  conflict_type: string;
  conflict_value: string;
  keep: { prototype_id: string; catalog_id: string; reason: string };
  reassign?: {
    prototype_id: string;
    from_catalog_id: string;
    to_catalog_id: string;
    reason: string;
  };
  backward_compatible: boolean;
  requires_manual_approval: boolean;
};

export type CatalogHistoryEntry = {
  catalog_id: string;
  prototype_id: string | null;
  first_seen: string | null;
  publication_state: string;
  live: boolean;
  release_ids: string[];
  rollback_count: number;
  sources: string[];
};

export type PublicationSafetyReport = {
  generated_at: string;
  safe_to_publish: boolean;
  live_layer_unique: boolean;
  pipeline_conflicts: number;
  checks: Record<string, boolean>;
};

export type CatalogIntegrityResult = {
  generated_at: string;
  conflicts: CatalogConflict[];
  resolutions: ResolutionEntry[];
  history: CatalogHistoryEntry[];
  safety: PublicationSafetyReport;
  next_available_catalog_id: string;
  used_catalog_ids: string[];
};
