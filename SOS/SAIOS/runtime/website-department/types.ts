/**
 * Website Department — shared types.
 * Phase 2A: outcome model, hardened options, finding ledger types.
 */

export type WebsiteStatus = "HEALTHY" | "DEGRADED" | "DOWN" | "BLOCKED";

export type CheckSeverity = "critical" | "warning" | "info";

/** Authoritative check result — never use pass:true for not_run/unsupported. */
export type WebsiteCheckOutcome = "pass" | "fail" | "not_run" | "unsupported";

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
  source_files: string[];
  auth: RouteAuthClass;
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
  outcome: WebsiteCheckOutcome;
  auth: RouteAuthClass;
  source_files_ok: boolean;
};

export type ScenarioResult = {
  id: string;
  label: string;
  /** True only when outcome === "pass". Never true for not_run/unsupported. */
  pass: boolean;
  outcome: WebsiteCheckOutcome;
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
  /** Inject evidence output root (tests / gated persist). */
  output_root?: string;
  /** Inject project-state path for merge unit tests only. Never the real file in verification_only. */
  project_state_path?: string | null;
  /** Allow network probes. Forced false in verification_only and test bypass. */
  allow_network?: boolean;
  /**
   * Test-only enablement override. Requires SOS_WEBSITE_DEPT_TEST_BYPASS=1
   * and a non-production output_root. Does not authorize network or production evidence.
   */
  force_enabled?: boolean | null;
  /**
   * Explicit permission to write under the real Website Department evidence root.
   * Requires department enabled and director gate. Never set by test bypass.
   */
  allow_production_evidence?: boolean;
  /** Apply finding ledger updates when persisting (temp roots in Phase 2A tests). */
  update_findings?: boolean;
  /** Acquire Website-local single-run lock under output_root. */
  acquire_run_lock?: boolean;
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
  findings_delta?: {
    created: number;
    recurring: number;
    resolved: number;
    reopened: number;
    suppressed_hits: number;
  };
};

export type WebsiteFindingStatus = "OPEN" | "RECURRING" | "RESOLVED" | "SUPPRESSED";

export type WebsiteFindingViewport = "desktop" | "mobile" | "unknown" | "n/a";

export type WebsiteFinding = {
  finding_id: string;
  fingerprint: string;
  environment: string;
  journey_id: string;
  route_pattern: string;
  viewport_class: WebsiteFindingViewport;
  check_type: string;
  normalized_message: string;
  severity: CheckSeverity;
  status: WebsiteFindingStatus;
  ownership: "website-department";
  first_seen_at: string;
  first_seen_run_id: string;
  last_seen_at: string;
  last_seen_run_id: string;
  occurrence_count: number;
  consecutive_absent_applicable_runs: number;
  evidence_refs: string[];
  reopen_count: number;
  suppression: null | {
    actor: string;
    reason: string;
    suppressed_at: string;
    expires_at: string | null;
  };
  resolution: null | {
    resolved_at: string;
    resolved_after_run_id: string;
    note: string;
  };
};

export type WebsiteFindingIndex = {
  version: 1;
  updated_at: string;
  findings: Array<{
    finding_id: string;
    fingerprint: string;
    status: WebsiteFindingStatus;
    last_seen_at: string;
    occurrence_count: number;
  }>;
};
