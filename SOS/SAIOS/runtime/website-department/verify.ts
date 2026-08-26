#!/usr/bin/env tsx
/**
 * Website Department verification.
 * AGENT #100
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { buildRouteRegistry } from "./WebsiteRouteRegistry.js";
import {
  runWebsiteDepartment,
  STATE_PATH,
  WEBSITE_DEPARTMENT,
  WEBSITE_DEPARTMENT_ROOT,
} from "./WebsiteDepartmentDirector.js";

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(msg);
}

async function main(): Promise<void> {
  assert(WEBSITE_DEPARTMENT.module === "website-department", "module id");
  assert(WEBSITE_DEPARTMENT.agent === "100", "agent number");

  const preState = JSON.parse(readFileSync(STATE_PATH, "utf8")) as {
    next_agent: string;
    latest_agent: string;
    factory_v1?: { status?: string };
    latest_catalog: string;
    latest_release: string;
  };
  assert(
    preState.next_agent === "100" || preState.latest_agent === "100",
    "pre-flight: expected agent #100",
  );
  assert(preState.factory_v1?.status === "STABLE", "Resume Factory V1 locked/stable");

  const registry = buildRouteRegistry();
  assert(registry.length >= 8, "route registry");

  const result = await runWebsiteDepartment({ mode: "auto", catalog_id: "t094", persist: true });

  const required = [
    "website-health.json",
    "route-health.json",
    "scenario-results.json",
    "seo-health.json",
    "sitemap-health.json",
    "mobile-health.json",
    "download-flow.json",
    "runtime-errors.json",
    "website-alerts.json",
    "website-report.md",
  ];
  for (const file of required) {
    assert(existsSync(join(WEBSITE_DEPARTMENT_ROOT, file)), `report exists: ${file}`);
  }

  const saved = JSON.parse(readFileSync(STATE_PATH, "utf8")) as {
    latest_agent: string;
    next_agent: string;
    operations: { website_department: Record<string, unknown> };
  };
  assert(saved.latest_agent === "100", "project state latest_agent");
  assert(saved.next_agent === "101", "project state next_agent");
  assert(saved.operations?.website_department?.last_run, "operations.website_department");

  assert(result.checks.route_registry, "route registry check");
  assert(result.checks.website_health_checker, "website health checker");
  assert(result.checks.resume_gallery_check, "resume gallery check");
  assert(result.checks.runtime_catalog_check, "runtime catalog check");
  assert(result.checks.editor_check, "editor check");
  assert(result.checks.seo_check, "seo check");
  assert(result.checks.sitemap_check, "sitemap check");
  assert(result.checks.mobile_check, "mobile check");
  assert(result.checks.download_flow_check, "download flow check");
  assert(result.checks.alert_payload_generation, "alert payload generation");
  assert(result.checks.reports_generated, "reports generated");
  assert(Array.isArray(result.alerts), "alerts array");

  console.log(
    JSON.stringify(
      {
        pass: true,
        component: "website-department",
        agent: "100",
        status: result.status,
        mode: result.mode,
        output_dir: WEBSITE_DEPARTMENT_ROOT,
        routes_ok: result.routes.filter((r) => r.ok).length,
        routes_total: result.routes.length,
        scenarios_pass: result.scenarios.filter((s) => s.pass).length,
        scenarios_total: result.scenarios.length,
        alerts: result.alerts.length,
        checks: result.checks,
        overall: "PASS",
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error(JSON.stringify({ pass: false, error: String(err) }, null, 2));
  process.exit(1);
});
