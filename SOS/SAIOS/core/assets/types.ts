/**
 * Agent #244 — Asset Processing Pipeline contracts.
 * Never publishes. Never writes the live website.
 */

export const ASSET_PIPELINE_VERSION = "1.0.0";

export type AssetProcessingResult = {
  ok: boolean;
  idempotent: boolean;
  export_package_id: string;
  export_path: string | null;
  status: "ASSETS_READY" | "ASSET_PROCESSING_FAILED" | "EXPORT_BUILT" | "REJECTED";
  assets: string[];
  report_path: string | null;
  error: string | null;
  publication_allowed: false;
};

export type AssetFingerprintEntry = {
  path: string;
  sha256: string;
  width: number;
  height: number;
  format: "png" | "webp";
  filesize: number;
  created_at: string;
  generator_version: string;
};

export type AssetFingerprintDoc = {
  schema_version: "asset-fingerprint-1.0.0";
  export_package_id: string;
  catalogue_id: string;
  generator_version: string;
  created_at: string;
  assets: AssetFingerprintEntry[];
  publication_allowed: false;
};

export type CompatibilityDoc = {
  export_schema: "export-package-1.0.0";
  manifest_schema: "studiosislab-manifest-draft-1.0.0";
  fabric_version: string;
  studiosislab_version: string;
  asset_pipeline_version: string;
  compatible: boolean;
  future_notes: string[];
  checked_at: string;
  publication_allowed: false;
};

export type AssetReportDoc = {
  export_package_id: string;
  catalogue_id: string;
  pass: boolean;
  checked_at: string;
  png: {
    preview: { ok: boolean; width: number; height: number; bytes: number };
    thumbnail: { ok: boolean; width: number; height: number; bytes: number };
  };
  webp: {
    preview: { ok: boolean; width: number; height: number; bytes: number };
    thumbnail: { ok: boolean; width: number; height: number; bytes: number };
  };
  dimensions: Record<string, { width: number; height: number; aspect: number }>;
  quality_checks: Record<string, boolean>;
  compression_ratio: {
    preview_webp_vs_png: number | null;
    thumbnail_webp_vs_png: number | null;
  };
  warnings: string[];
  errors: string[];
  status: "PASS" | "FAIL";
  publication_allowed: false;
};
