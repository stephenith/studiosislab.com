/**
 * Website Department Director — orchestration entry point.
 * Phase 2A: outcome model, root projections, escape-hatch hardening, findings, lock.
 *
 * Operational execution must go through this director (not raw helpers).
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { ErrorCollector } from "./ErrorCollector.js";
import { buildWebsiteAlerts } from "./WebsiteAlertBuilder.js";
import { criticalActionableFailures } from "./WebsiteCheckHelpers.js";
import {
  assertPersistSafety,
  readWebsiteEnablement,
  resolveExecutionGate,
} from "./WebsiteDepartmentPolicy.js";
import {
  assertNoAgentMutation,
  mergeWebsiteDepartmentProjection,
  type ProjectStateLike,
} from "./WebsiteProjectStateProjection.js";
import { applyFindingObservations } from "./WebsiteFindingLedger.js";
import {
  beginWebsiteRunIdentity,
  completeWebsiteRunIdentity,
} from "./WebsiteRunIdentity.js";
import { acquireWebsiteRunLock } from "./WebsiteRunLock.js";
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
  version: "1.2.0-phase2a",
  role: "ai_os_website_health_monitoring",
  identity: "run_id",
  prohibitions: [
    "no_resume_generation",
    "no_design_intelligence_mutation",
    "no_publication_execution",
    "no_live_notifications",
    "no_agent_number_mutation",
    "no_autonomous_website_changes",
    "no_browser_automation_until_phase2b",
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

  let persistPlan: ReturnType<typeof assertPersistSafety> | null = null;
  if (persist) {
    persistPlan = assertPersistSafety({ options, repo_root: repoRoot, enablement });
  }

  let lockRelease: (() => void) | null = null;

  let run = beginWebsiteRunIdentity({
    mode: verificationOnly ? "verification_only" : modePref === "live" ? "live" : "static",
    evidence_kind: allowNetwork && modePref !== "static" ? "live_http" : "static",
    repo_root: repoRoot,
    browser_coverage: "not_run",
    auth_coverage: "not_run",
    mobile_coverage: "static_evidence_only",
    download_coverage: "static_evidence_only",
  });

  try {
    if (persist && options.acquire_run_lock && persistPlan) {
      const lock = acquireWebsiteRunLock({
        output_root: persistPlan.output_root,
        run_id: run.run_id,
      });
      lockRelease = lock.release;
    }

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

    const routesOk = routeCheck.results.every((r) => r.outcome !== "fail");
    const status = classifyWebsiteStatus({
      routes_ok: routesOk,
      critical_scenarios_ok: !criticalActionableFailures(scenarioPack.scenarios),
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
      evidence_kind:
        routeCheck.mode === "live" || routeCheck.mode === "hybrid" ? "live_http" : "static",
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
        (s) => s.id === "browser_journey" && s.outcome === "not_run" && s.pass === false,
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
      output_dir: persistPlan?.output_root ?? "(verification_only_no_output)",
      run_dir: null,
      persisted: false,
      project_state_written: false,
      registry_example: {
        template_id: registryPack.example.template_id,
        seo_slug: registryPack.example.seo_slug,
      },
    };

    if (persist && persistPlan) {
      const written = persistWebsiteReports(result, {
        authorization: persistPlan,
        update_latest: true,
        protect_existing_root: true,
      });
      result.run_dir = written.run_dir;
      result.output_dir = persistPlan.output_root;
      result.persisted = true;

      if (options.update_findings) {
        const observations = scenarioPack.scenarios
          .filter((s) => s.outcome === "fail")
          .map((s) => ({
            environment: "local-static",
            journey_id: s.id,
            route_pattern: s.id,
            viewport_class: "n/a" as const,
            check_type: "scenario",
            message_or_selector: s.details,
            severity: s.severity,
            evidence_ref: `${written.run_dir}/scenario-results.json#${s.id}`,
            run_id: result.run.run_id,
          }));

        const evaluated_checks = scenarioPack.scenarios.map((s) => {
          const evaluation =
            s.outcome === "pass"
              ? ("pass" as const)
              : s.outcome === "fail"
                ? ("fail" as const)
                : s.outcome === "not_run"
                  ? ("not_run" as const)
                  : s.outcome === "unsupported"
                    ? ("unsupported" as const)
                    : ("incomplete" as const);
          return {
            environment: "local-static",
            journey_id: s.id,
            route_pattern: s.id,
            viewport_class: "n/a" as const,
            check_type: "scenario",
            evaluation,
          };
        });

        const delta = applyFindingObservations({
          output_root: persistPlan.output_root,
          run_id: result.run.run_id,
          observations,
          evaluated_checks,
        });
        result.findings_delta = {
          created: delta.created,
          recurring: delta.recurring,
          resolved: delta.resolved,
          reopened: delta.reopened,
          suppressed_hits: delta.suppressed_hits,
        };
      }

      if (
        options.project_state_path &&
        options.project_state_path !== STATE_PATH &&
        !verificationOnly &&
        enablement.source !== "test_bypass"
      ) {
        writeProjectedState(options.project_state_path, result);
        result.project_state_written = true;
      }
    }

    return result;
  } finally {
    lockRelease?.();
  }
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

export { STATE_PATH, WEBSITE_DEPARTMENT_ROOT, DEFAULT_REPO_ROOT, defaultWebsiteDepartmentRoot };
