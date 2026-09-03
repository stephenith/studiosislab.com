/**
 * Website Department Director — orchestration entry point.
 * Phase 1 core revival: run-identity based; no Agent-number coupling.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { ErrorCollector } from "./ErrorCollector.js";
import { buildWebsiteAlerts } from "./WebsiteAlertBuilder.js";
import {
  resolveExecutionGate,
  readWebsiteEnablement,
} from "./WebsiteDepartmentPolicy.js";
import {
  assertNoAgentMutation,
  mergeWebsiteDepartmentProjection,
  type ProjectStateLike,
} from "./WebsiteProjectStateProjection.js";
import {
  beginWebsiteRunIdentity,
  completeWebsiteRunIdentity,
} from "./WebsiteRunIdentity.js";
import { checkWebsiteRoutes } from "./WebsiteHealthChecker.js";
import {
  classifyWebsiteStatus,
  defaultWebsiteDepartmentRoot,
  persistWebsiteReports,
  WEBSITE_DEPARTMENT_ROOT,
} from "./WebsiteReportBuilder.js";
import { runWebsiteScenarios } from "./WebsiteScenarioRunner.js";
import { buildRouteRegistry } from "./WebsiteRouteRegistry.js";
import type { WebsiteDepartmentOptions, WebsiteDepartmentResult } from "./types.js";

export const WEBSITE_DEPARTMENT = {
  module: "website-department",
  version: "1.1.0-phase1-core",
  role: "ai_os_website_health_monitoring",
  identity: "run_id",
  prohibitions: [
    "no_resume_generation",
    "no_design_intelligence_mutation",
    "no_publication_execution",
    "no_live_notifications",
    "no_agent_number_mutation",
    "no_autonomous_website_changes",
    "no_browser_automation_phase1",
  ],
} as const;

const DEFAULT_REPO_ROOT = resolve(import.meta.dirname, "../../../..");
const STATE_PATH = join(DEFAULT_REPO_ROOT, "SOS/project-state.json");

export async function runWebsiteDepartment(
  options: WebsiteDepartmentOptions = {},
): Promise<WebsiteDepartmentResult> {
  const repoRoot = options.repo_root ?? DEFAULT_REPO_ROOT;
  const enablement = readWebsiteEnablement({
    repo_root: repoRoot,
    project_state_path: options.project_state_path,
    force_enabled: options.force_enabled,
  });
  const gate = resolveExecutionGate({ enablement, options });

  if (!gate.allowed) {
    throw new Error(
      `Website Department operational execution blocked (fail-closed): ${gate.detail}`,
    );
  }

  const verificationOnly = gate.verification_only;
  const persist = gate.persist && !verificationOnly;
  const allowNetwork = gate.allow_network && !verificationOnly;
  const modePref = gate.mode;

  const outputRoot =
    options.output_root ??
    (verificationOnly ? "" : defaultWebsiteDepartmentRoot(repoRoot));

  // Persist against production evidence root is intentionally not exercised in Phase 1.
  // Callers that set persist + enabled must inject output_root for safety in tests.
  if (persist && !options.output_root) {
    throw new Error(
      "Persisted Website Department runs require an explicit output_root until Phase 2 approval (protects July 8 evidence)",
    );
  }

  let run = beginWebsiteRunIdentity({
    mode: verificationOnly ? "verification_only" : modePref === "live" ? "live" : "static",
    evidence_kind: allowNetwork && modePref !== "static" ? "live_http" : "static",
    repo_root: repoRoot,
    browser_coverage: "not_run",
    auth_coverage: "not_run",
    mobile_coverage: "static_evidence_only",
    download_coverage: "static_evidence_only",
  });

  const errors = new ErrorCollector();
  const registryPack = buildRouteRegistry({ repo_root: repoRoot });
  const templateId = options.catalog_id ?? registryPack.example.template_id ?? undefined;
  const seoSlug = registryPack.example.seo_slug;

  if (registryPack.routes.length < 8) {
    errors.add("Route registry incomplete");
  }

  const routeCheck = await checkWebsiteRoutes({
    ...options,
    repo_root: repoRoot,
    mode: modePref,
    allow_network: allowNetwork,
    catalog_id: templateId,
    verification_only: verificationOnly,
  });

  const scenarioPack = runWebsiteScenarios({
    repo_root: repoRoot,
    template_id: templateId ?? null,
    seo_slug: seoSlug,
  });

  const alerts = buildWebsiteAlerts({
    routes: routeCheck.results,
    scenarios: scenarioPack.scenarios,
    runtime_errors: errors.list(),
  });

  const executedCriticalFail = scenarioPack.scenarios.some(
    (s) =>
      s.severity === "critical" &&
      !s.pass &&
      (s.execution === "executed" || s.execution === "static_evidence_only"),
  );
  const routesOk = routeCheck.results.every((r) => r.ok);
  const status = classifyWebsiteStatus({
    routes_ok: routesOk,
    critical_scenarios_ok: !executedCriticalFail,
    has_critical_alerts: alerts.some((a) => a.severity === "critical"),
  });

  const resultMode = verificationOnly
    ? ("verification_only" as const)
    : routeCheck.mode === "live"
      ? ("live" as const)
      : routeCheck.mode === "hybrid"
        ? ("hybrid" as const)
        : ("static" as const);

  run = completeWebsiteRunIdentity(run, {
    mode: resultMode,
    evidence_kind: routeCheck.mode === "live" || routeCheck.mode === "hybrid" ? "live_http" : "static",
    browser_coverage: "not_run",
    auth_coverage: "not_run",
    mobile_coverage: "static_evidence_only",
    download_coverage: "static_evidence_only",
  });

  const checks = {
    route_registry: registryPack.routes.length >= 8,
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
    browser_not_falsely_claimed: scenarioPack.scenarios.some(
      (s) => s.id === "browser_journey" && s.execution === "not_run",
    ),
    no_legacy_senior_slug: !registryPack.routes.some((r) =>
      r.path.includes("senior-software-engineer-resume"),
    ),
  };

  const result: WebsiteDepartmentResult = {
    generated_at: run.completed_at ?? new Date().toISOString(),
    status,
    mode: resultMode,
    base_url: routeCheck.base_url,
    run,
    routes: routeCheck.results,
    scenarios: scenarioPack.scenarios,
    seo: scenarioPack.modules.seo.report,
    sitemap: scenarioPack.modules.sitemap.report,
    mobile: scenarioPack.modules.mobile.report,
    download_flow: scenarioPack.modules.download.report,
    runtime_errors: errors.list(),
    alerts,
    checks,
    output_dir: outputRoot || "(verification_only_no_output)",
    run_dir: null,
    persisted: false,
    project_state_written: false,
    registry_example: {
      template_id: registryPack.example.template_id,
      seo_slug: registryPack.example.seo_slug,
    },
  };

  if (persist && options.output_root) {
    const written = persistWebsiteReports(result, {
      output_root: options.output_root,
      update_latest: true,
      // Never overwrite real production root projections in Phase 1 path.
      update_root_projections: false,
      protect_existing_root: true,
    });
    result.run_dir = written.run_dir;
    result.output_dir = options.output_root;
    result.persisted = true;

    // Project-state write only when explicitly enabled AND a non-null injectable path is provided.
    // Real SOS/project-state.json is never written from verification_only or Phase 1 default path.
    if (
      options.project_state_path &&
      options.project_state_path !== STATE_PATH &&
      !verificationOnly
    ) {
      writeProjectedState(options.project_state_path, result);
      result.project_state_written = true;
    }
  }

  return result;
}

function writeProjectedState(path: string, result: WebsiteDepartmentResult): void {
  if (!existsSync(path)) {
    throw new Error(`project-state path missing: ${path}`);
  }
  const before = JSON.parse(readFileSync(path, "utf8")) as ProjectStateLike;
  const after = mergeWebsiteDepartmentProjection(before, result);
  assertNoAgentMutation(before, after);
  writeFileSync(path, JSON.stringify(after, null, 2));
}

export { STATE_PATH, WEBSITE_DEPARTMENT_ROOT, DEFAULT_REPO_ROOT };
