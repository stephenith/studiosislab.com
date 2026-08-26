/**
 * Builds alert payloads (no live sending).
 */
import type { RouteHealthResult, ScenarioResult, WebsiteAlert } from "./types.js";

function alertId(type: string, key: string): string {
  return `web-${type}-${key}`.replace(/[^a-zA-Z0-9_-]/g, "-");
}

export function buildWebsiteAlerts(input: {
  routes: RouteHealthResult[];
  scenarios: ScenarioResult[];
  runtime_errors: string[];
}): WebsiteAlert[] {
  const now = new Date().toISOString();
  const alerts: WebsiteAlert[] = [];

  for (const route of input.routes) {
    if (route.ok) continue;
    const isApi = route.path.startsWith("/api/");
    alerts.push({
      id: alertId(isApi ? "api" : "route", route.route_id),
      type: isApi ? "api_failure" : "route_down",
      severity: "critical",
      title: isApi ? `API failure: ${route.path}` : `Route down: ${route.path}`,
      message: route.detail,
      route: route.path,
      created_at: now,
      channel_ready: false,
      payload: { route },
    });
  }

  for (const scenario of input.scenarios) {
    if (scenario.pass) continue;
    let type: WebsiteAlert["type"] = "runtime_js_error";
    if (scenario.id.includes("editor")) type = "editor_failure";
    else if (scenario.id.includes("thumb") || scenario.id.includes("gallery") || scenario.id.includes("fabric"))
      type = "template_not_loading";
    else if (scenario.id.includes("sitemap")) type = "sitemap_missing";
    else if (scenario.id.includes("seo")) type = "seo_route_missing";
    else if (scenario.id.includes("mobile")) type = "mobile_layout_failure";
    else if (scenario.id.includes("download")) type = "download_flow_failure";
    else if (scenario.id.includes("catalog") || scenario.id.includes("api")) type = "api_failure";

    alerts.push({
      id: alertId(type, scenario.id),
      type,
      severity: scenario.severity,
      title: `Scenario failed: ${scenario.label}`,
      message: scenario.details,
      created_at: now,
      channel_ready: false,
      payload: { scenario },
    });
  }

  for (const [index, err] of input.runtime_errors.entries()) {
    alerts.push({
      id: alertId("runtime", String(index)),
      type: "runtime_js_error",
      severity: "warning",
      title: "Runtime error captured",
      message: err,
      created_at: now,
      channel_ready: false,
      payload: { error: err },
    });
  }

  return alerts;
}
