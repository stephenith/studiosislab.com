/**
 * Persists Website Department reports.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import type { WebsiteDepartmentResult, WebsiteStatus } from "./types.js";

const REPO_ROOT = resolve(import.meta.dirname, "../../../..");
export const WEBSITE_DEPARTMENT_ROOT = join(
  REPO_ROOT,
  "SOS/07_LOGS/saios/website-department",
);

export function classifyWebsiteStatus(input: {
  routes_ok: boolean;
  critical_scenarios_ok: boolean;
  has_critical_alerts: boolean;
  blocked?: boolean;
}): WebsiteStatus {
  if (input.blocked) return "BLOCKED";
  if (!input.routes_ok && input.has_critical_alerts) return "DOWN";
  if (!input.critical_scenarios_ok || input.has_critical_alerts) return "DEGRADED";
  if (!input.routes_ok) return "DEGRADED";
  return "HEALTHY";
}

export function renderWebsiteReport(result: WebsiteDepartmentResult): string {
  const lines = [
    "# Website Department Health Report",
    "",
    `**Generated:** ${result.generated_at}`,
    `**Status:** ${result.status}`,
    `**Mode:** ${result.mode}`,
    `**Base URL:** ${result.base_url ?? "static-only"}`,
    "",
    "## Checks",
    "",
    ...Object.entries(result.checks).map(([k, v]) => `- ${k}: ${v ? "PASS" : "FAIL"}`),
    "",
    "## Routes",
    "",
    ...result.routes.map(
      (r) =>
        `- \`${r.path}\` — ${r.ok ? "OK" : "FAIL"} (${r.mode}${r.status_code ? `, ${r.status_code}` : ""}) — ${r.detail}`,
    ),
    "",
    "## Scenarios",
    "",
    ...result.scenarios.map((s) => `- ${s.pass ? "PASS" : "FAIL"} — ${s.label}: ${s.details}`),
    "",
    "## Alerts",
    "",
    ...(result.alerts.length
      ? result.alerts.map((a) => `- [${a.severity}] ${a.type}: ${a.title}`)
      : ["- None"]),
    "",
    "> Alerts are payloads only. Notification Department will send later.",
    "",
  ];
  return lines.join("\n");
}

export function persistWebsiteReports(result: WebsiteDepartmentResult): string[] {
  mkdirSync(WEBSITE_DEPARTMENT_ROOT, { recursive: true });
  const files = {
    health: join(WEBSITE_DEPARTMENT_ROOT, "website-health.json"),
    routes: join(WEBSITE_DEPARTMENT_ROOT, "route-health.json"),
    scenarios: join(WEBSITE_DEPARTMENT_ROOT, "scenario-results.json"),
    seo: join(WEBSITE_DEPARTMENT_ROOT, "seo-health.json"),
    sitemap: join(WEBSITE_DEPARTMENT_ROOT, "sitemap-health.json"),
    mobile: join(WEBSITE_DEPARTMENT_ROOT, "mobile-health.json"),
    download: join(WEBSITE_DEPARTMENT_ROOT, "download-flow.json"),
    errors: join(WEBSITE_DEPARTMENT_ROOT, "runtime-errors.json"),
    alerts: join(WEBSITE_DEPARTMENT_ROOT, "website-alerts.json"),
    report: join(WEBSITE_DEPARTMENT_ROOT, "website-report.md"),
  };

  writeFileSync(
    files.health,
    JSON.stringify(
      {
        generated_at: result.generated_at,
        status: result.status,
        mode: result.mode,
        base_url: result.base_url,
        checks: result.checks,
        alert_count: result.alerts.length,
      },
      null,
      2,
    ),
  );
  writeFileSync(files.routes, JSON.stringify({ generated_at: result.generated_at, routes: result.routes }, null, 2));
  writeFileSync(
    files.scenarios,
    JSON.stringify({ generated_at: result.generated_at, scenarios: result.scenarios }, null, 2),
  );
  writeFileSync(files.seo, JSON.stringify(result.seo, null, 2));
  writeFileSync(files.sitemap, JSON.stringify(result.sitemap, null, 2));
  writeFileSync(files.mobile, JSON.stringify(result.mobile, null, 2));
  writeFileSync(files.download, JSON.stringify(result.download_flow, null, 2));
  writeFileSync(
    files.errors,
    JSON.stringify({ generated_at: result.generated_at, errors: result.runtime_errors }, null, 2),
  );
  writeFileSync(
    files.alerts,
    JSON.stringify({ generated_at: result.generated_at, alerts: result.alerts }, null, 2),
  );
  writeFileSync(files.report, renderWebsiteReport(result));

  return Object.values(files);
}
