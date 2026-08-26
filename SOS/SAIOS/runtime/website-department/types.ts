/**
 * Website Department — shared types.
 * AGENT #100 — AI OS Website Department V1
 */

export type WebsiteStatus = "HEALTHY" | "DEGRADED" | "DOWN" | "BLOCKED";

export type CheckSeverity = "critical" | "warning" | "info";

export type RouteDefinition = {
  id: string;
  path: string;
  label: string;
  critical: boolean;
  type: "page" | "api" | "asset";
};

export type RouteHealthResult = {
  route_id: string;
  path: string;
  ok: boolean;
  status_code: number | null;
  latency_ms: number | null;
  mode: "live" | "static";
  detail: string;
};

export type ScenarioResult = {
  id: string;
  label: string;
  pass: boolean;
  severity: CheckSeverity;
  details: string;
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
    | "download_flow_failure";
  severity: CheckSeverity;
  title: string;
  message: string;
  route?: string;
  created_at: string;
  channel_ready: false;
  payload: Record<string, unknown>;
};

export type WebsiteDepartmentOptions = {
  base_url?: string;
  mode?: "auto" | "static" | "live";
  catalog_id?: string;
  persist?: boolean;
};

export type WebsiteDepartmentResult = {
  generated_at: string;
  status: WebsiteStatus;
  mode: "static" | "live" | "hybrid";
  base_url: string | null;
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
};
