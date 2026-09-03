/**
 * Website Department — shared types.
 * Phase 1 core revival: run-identity based, detect-only.
 */

export type WebsiteStatus = "HEALTHY" | "DEGRADED" | "DOWN" | "BLOCKED";

export type CheckSeverity = "critical" | "warning" | "info";

/** How far a check was actually executed. */
export type CoverageExecution =
  | "executed"
  | "not_run"
  | "unsupported"
  | "static_evidence_only";

export type EvidenceKind = "static" | "live_http" | "browser";

export type RouteAuthClass = "public" | "auth_required" | "mixed" | "unknown";

export type RouteDefinition = {
  id: string;
  path: string;
  label: string;
  critical: boolean;
  type: "page" | "api" | "meta";
  /** Source file(s) that must exist for static evidence. */
  source_files: string[];
  auth: RouteAuthClass;
  /** Optional dynamic example notes (not proof of live behaviour). */
  notes?: string;
};

export type RouteHealthResult = {
  route_id: string;
  path: string;
  ok: boolean;
  status_code: number | null;
  latency_ms: number | null;
  mode: "live" | "static";
  detail: string;
  execution: CoverageExecution;
  auth: RouteAuthClass;
  source_files_ok: boolean;
};

export type ScenarioResult = {
  id: string;
  label: string;
  pass: boolean;
  severity: CheckSeverity;
  details: string;
  execution: CoverageExecution;
  evidence?: Record<string, unknown>;
};

export type WebsiteAlert = {
  id: string;
  type:
    | "route_down"
    | "api_failure"
    | "template_not_loading"
    | "editor_failure"
    | "sitemap_missing"
    | "seo_route_missing"
    | "mobile_layout_failure"
    | "runtime_js_error"
    | "download_flow_failure"
    | "coverage_gap";
  severity: CheckSeverity;
  title: string;
  message: string;
  route?: string;
  created_at: string;
  channel_ready: false;
  payload: Record<string, unknown>;
};

export type WebsiteRunIdentity = {
  run_id: string;
  mode: "static" | "live" | "hybrid" | "verification_only";
  started_at: string;
  completed_at: string | null;
  repository_commit: string | null;
  evidence_kind: EvidenceKind;
  browser_coverage: CoverageExecution;
  auth_coverage: CoverageExecution;
  mobile_coverage: CoverageExecution;
  download_coverage: CoverageExecution;
};

export type WebsiteDepartmentOptions = {
  base_url?: string;
  mode?: "auto" | "static" | "live";
  catalog_id?: string;
  persist?: boolean;
  /**
   * Verification-only: static, no network, persist false, no project-state write,
   * no production evidence write. Allowed while department is disabled.
   */
  verification_only?: boolean;
  /** Inject repo root (tests). */
  repo_root?: string;
  /** Inject evidence output root (tests). Defaults to SOS/07_LOGS/... */
  output_root?: string;
  /** Inject project-state path for merge unit tests only. Never the real file in verification_only. */
  project_state_path?: string | null;
  /** Allow network probes. Forced false in verification_only. */
  allow_network?: boolean;
  /** Force treat department as enabled/disabled (tests). */
  force_enabled?: boolean | null;
};

export type WebsiteDepartmentResult = {
  generated_at: string;
  status: WebsiteStatus;
  mode: "static" | "live" | "hybrid" | "verification_only";
  base_url: string | null;
  run: WebsiteRunIdentity;
  routes: RouteHealthResult[];
  scenarios: ScenarioResult[];
  seo: Record<string, unknown>;
  sitemap: Record<string, unknown>;
  mobile: Record<string, unknown>;
  download_flow: Record<string, unknown>;
  runtime_errors: string[];
  alerts: WebsiteAlert[];
  checks: Record<string, boolean>;
  output_dir: string;
  run_dir: string | null;
  persisted: boolean;
  project_state_written: boolean;
  registry_example: {
    template_id: string | null;
    seo_slug: string | null;
  };
};
