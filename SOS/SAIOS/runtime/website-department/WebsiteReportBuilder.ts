/**
 * Persists Website Department reports with immutable run directories + latest projections.
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import type { WebsiteDepartmentResult, WebsiteStatus } from "./types.js";

const DEFAULT_REPO_ROOT = resolve(import.meta.dirname, "../../../..");

export function defaultWebsiteDepartmentRoot(repoRoot = DEFAULT_REPO_ROOT): string {
  return join(repoRoot, "SOS/07_LOGS/saios/website-department");
}

export const WEBSITE_DEPARTMENT_ROOT = defaultWebsiteDepartmentRoot();

const PROJECTION_FILES = [
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
] as const;

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
    `**Run ID:** ${result.run.run_id}`,
    `**Status:** ${result.status}`,
    `**Mode:** ${result.mode}`,
    `**Evidence kind:** ${result.run.evidence_kind}`,
    `**Base URL:** ${result.base_url ?? "static-only"}`,
    `**Repository commit:** ${result.run.repository_commit ?? "unknown"}`,
    "",
    "## Coverage honesty",
    "",
    `- browser_coverage: ${result.run.browser_coverage}`,
    `- auth_coverage: ${result.run.auth_coverage}`,
    `- mobile_coverage: ${result.run.mobile_coverage}`,
    `- download_coverage: ${result.run.download_coverage}`,
    "",
    "## Checks",
    "",
    ...Object.entries(result.checks).map(([k, v]) => `- ${k}: ${v ? "PASS" : "FAIL"}`),
    "",
    "## Routes",
    "",
    ...result.routes.map(
      (r) =>
        `- \`${r.path}\` — ${r.ok ? "OK" : "FAIL"} (${r.mode}, execution=${r.execution}, auth=${r.auth}${r.status_code ? `, ${r.status_code}` : ""}) — ${r.detail}`,
    ),
    "",
    "## Scenarios",
    "",
    ...result.scenarios.map(
      (s) =>
        `- ${s.pass ? "PASS" : "FAIL"} [${s.execution}] — ${s.label}: ${s.details}`,
    ),
    "",
    "## Alerts",
    "",
    ...(result.alerts.length
      ? result.alerts.map((a) => `- [${a.severity}] ${a.type}: ${a.title}`)
      : ["- None"]),
    "",
    "> Alerts are payloads only. Notification Department will send later.",
    "> Static evidence is not proof of browser, auth, mobile UX, or production health.",
    "",
  ];
  return lines.join("\n");
}

function atomicWriteFile(target: string, contents: string): void {
  const tmp = `${target}.${process.pid}.${Date.now()}.tmp`;
  writeFileSync(tmp, contents, "utf8");
  renameSync(tmp, target);
}

function writeReportBundle(dir: string, result: WebsiteDepartmentResult): void {
  mkdirSync(dir, { recursive: true });

  atomicWriteFile(
    join(dir, "website-health.json"),
    JSON.stringify(
      {
        generated_at: result.generated_at,
        run_id: result.run.run_id,
        status: result.status,
        mode: result.mode,
        base_url: result.base_url,
        checks: result.checks,
        alert_count: result.alerts.length,
        run: result.run,
        registry_example: result.registry_example,
      },
      null,
      2,
    ),
  );
  atomicWriteFile(
    join(dir, "route-health.json"),
    JSON.stringify({ generated_at: result.generated_at, run_id: result.run.run_id, routes: result.routes }, null, 2),
  );
  atomicWriteFile(
    join(dir, "scenario-results.json"),
    JSON.stringify(
      { generated_at: result.generated_at, run_id: result.run.run_id, scenarios: result.scenarios },
      null,
      2,
    ),
  );
  atomicWriteFile(join(dir, "seo-health.json"), JSON.stringify(result.seo, null, 2));
  atomicWriteFile(join(dir, "sitemap-health.json"), JSON.stringify(result.sitemap, null, 2));
  atomicWriteFile(join(dir, "mobile-health.json"), JSON.stringify(result.mobile, null, 2));
  atomicWriteFile(join(dir, "download-flow.json"), JSON.stringify(result.download_flow, null, 2));
  atomicWriteFile(
    join(dir, "runtime-errors.json"),
    JSON.stringify({ generated_at: result.generated_at, run_id: result.run.run_id, errors: result.runtime_errors }, null, 2),
  );
  atomicWriteFile(
    join(dir, "website-alerts.json"),
    JSON.stringify({ generated_at: result.generated_at, run_id: result.run.run_id, alerts: result.alerts }, null, 2),
  );
  atomicWriteFile(join(dir, "website-report.md"), renderWebsiteReport(result));
  atomicWriteFile(join(dir, "run-identity.json"), JSON.stringify(result.run, null, 2));
}

/**
 * Archive legacy root projection files once so historical July-8 style evidence is preserved
 * before future latest overwrites. Idempotent.
 */
export function archiveRootProjectionsIfNeeded(outputRoot: string): string | null {
  const archiveMarker = join(outputRoot, "archive", "pre-revival-root-projections", ".archived");
  if (existsSync(archiveMarker)) return null;

  const hasRoot = PROJECTION_FILES.some((f) => existsSync(join(outputRoot, f)));
  if (!hasRoot) return null;

  const dest = join(outputRoot, "archive", "pre-revival-root-projections");
  mkdirSync(dest, { recursive: true });
  for (const f of PROJECTION_FILES) {
    const src = join(outputRoot, f);
    if (existsSync(src)) {
      copyFileSync(src, join(dest, f));
    }
  }
  writeFileSync(
    archiveMarker,
    JSON.stringify({ archived_at: new Date().toISOString(), files: PROJECTION_FILES }, null, 2),
  );
  return dest;
}

export function persistWebsiteReports(
  result: WebsiteDepartmentResult,
  options?: {
    output_root?: string;
    update_latest?: boolean;
    update_root_projections?: boolean;
    protect_existing_root?: boolean;
  },
): { run_dir: string; latest_dir: string; files: string[] } {
  const outputRoot = options?.output_root ?? result.output_dir ?? WEBSITE_DEPARTMENT_ROOT;
  mkdirSync(outputRoot, { recursive: true });

  if (options?.protect_existing_root !== false && options?.update_root_projections) {
    archiveRootProjectionsIfNeeded(outputRoot);
  }

  const runDir = join(outputRoot, "runs", result.run.run_id);
  writeReportBundle(runDir, result);

  const latestDir = join(outputRoot, "latest");
  if (options?.update_latest !== false) {
    writeReportBundle(latestDir, result);
  }

  if (options?.update_root_projections) {
    // Compatibility projections for existing consumers of root filenames.
    writeReportBundle(outputRoot, result);
  }

  const files = PROJECTION_FILES.map((f) => join(runDir, f));
  return { run_dir: runDir, latest_dir: latestDir, files };
}

export function readFileBytes(path: string): Buffer {
  return readFileSync(path);
}
