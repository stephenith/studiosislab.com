/**
 * Website Department Director — orchestration entry point.
 * AGENT #100 — first non-resume AI OS department.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { ErrorCollector } from "./ErrorCollector.js";
import { buildWebsiteAlerts } from "./WebsiteAlertBuilder.js";
import { checkWebsiteRoutes } from "./WebsiteHealthChecker.js";
import {
  classifyWebsiteStatus,
  persistWebsiteReports,
  WEBSITE_DEPARTMENT_ROOT,
} from "./WebsiteReportBuilder.js";
import { runWebsiteScenarios } from "./WebsiteScenarioRunner.js";
import { buildRouteRegistry } from "./WebsiteRouteRegistry.js";
import type { WebsiteDepartmentOptions, WebsiteDepartmentResult } from "./types.js";

export const WEBSITE_DEPARTMENT = {
  module: "website-department",
  version: "1.0.0",
  agent: "100",
  role: "ai_os_website_health_monitoring",
  prohibitions: [
    "no_resume_generation",
    "no_design_intelligence_mutation",
    "no_publication_execution",
    "no_live_notifications",
  ],
} as const;

const REPO_ROOT = resolve(import.meta.dirname, "../../../..");
const STATE_PATH = join(REPO_ROOT, "SOS/project-state.json");

type ProjectState = {
  generated_at: string;
  latest_agent: string;
  next_agent: string;
  history?: Array<{ at: string; type: string; summary: string; ref: string }>;
  operations?: Record<string, unknown>;
};

export async function runWebsiteDepartment(
  options: WebsiteDepartmentOptions = {},
): Promise<WebsiteDepartmentResult> {
  const catalogId = options.catalog_id ?? "t094";
  const persist = options.persist !== false;
  const errors = new ErrorCollector();

  const routeCheck = await checkWebsiteRoutes(options);
  const scenarioPack = runWebsiteScenarios(catalogId);
  const registry = buildRouteRegistry({ catalog_id: catalogId });

  if (registry.length < 8) errors.add("Route registry incomplete");

  const alerts = buildWebsiteAlerts({
    routes: routeCheck.results,
    scenarios: scenarioPack.scenarios,
    runtime_errors: errors.list(),
  });

  const checks = {
    route_registry: registry.length >= 8,
    website_health_checker: routeCheck.results.length >= 8,
    resume_gallery_check: scenarioPack.modules.gallery.pass,
    runtime_catalog_check: scenarioPack.modules.runtime_catalog.pass,
    editor_check: scenarioPack.modules.editor.pass,
    seo_check: scenarioPack.modules.seo.pass,
    sitemap_check: scenarioPack.modules.sitemap.pass,
    mobile_check: scenarioPack.modules.mobile.pass,
    download_flow_check: scenarioPack.modules.download.pass,
    alert_payload_generation: true,
    reports_generated: persist,
  };

  const criticalScenarioFail = scenarioPack.scenarios.some(
    (s) => s.severity === "critical" && !s.pass,
  );
  const routesOk = routeCheck.results.every((r) => r.ok);
  const status = classifyWebsiteStatus({
    routes_ok: routesOk,
    critical_scenarios_ok: !criticalScenarioFail,
    has_critical_alerts: alerts.some((a) => a.severity === "critical"),
  });

  const result: WebsiteDepartmentResult = {
    generated_at: new Date().toISOString(),
    status,
    mode: routeCheck.mode,
    base_url: routeCheck.base_url,
    routes: routeCheck.results,
    scenarios: scenarioPack.scenarios,
    seo: scenarioPack.modules.seo.report,
    sitemap: scenarioPack.modules.sitemap.report,
    mobile: scenarioPack.modules.mobile.report,
    download_flow: scenarioPack.modules.download.report,
    runtime_errors: errors.list(),
    alerts,
    checks,
    output_dir: WEBSITE_DEPARTMENT_ROOT,
  };

  if (persist) {
    persistWebsiteReports(result);
    updateProjectState(result);
  }

  return result;
}

function updateProjectState(result: WebsiteDepartmentResult): void {
  if (!existsSync(STATE_PATH)) {
    throw new Error("SOS/project-state.json missing");
  }
  const state = JSON.parse(readFileSync(STATE_PATH, "utf8")) as ProjectState;
  if (state.next_agent !== "100" && state.latest_agent !== "100") {
    throw new Error(`Expected agent #100, found latest=${state.latest_agent} next=${state.next_agent}`);
  }

  const now = new Date().toISOString();
  const updated: ProjectState = {
    ...state,
    latest_agent: "100",
    next_agent: "101",
    generated_at: now,
    operations: {
      ...(state.operations ?? {}),
      website_department: {
        last_run: now,
        status: result.status,
        mode: result.mode,
        alert_count: result.alerts.length,
        route_failures: result.routes.filter((r) => !r.ok).length,
        output_dir: "SOS/07_LOGS/saios/website-department",
      },
    },
    history: [
      ...(state.history ?? []),
      {
        at: now,
        type: "website_department",
        summary: `Agent #100: Website Department ${result.status} (${result.mode})`,
        ref: "SOS/07_LOGS/saios/website-department/website-health.json",
      },
    ],
  };
  writeFileSync(STATE_PATH, JSON.stringify(updated, null, 2));
}

export { STATE_PATH, WEBSITE_DEPARTMENT_ROOT };
