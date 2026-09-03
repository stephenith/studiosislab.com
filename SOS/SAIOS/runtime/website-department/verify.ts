#!/usr/bin/env tsx
/**
 * Website Department — verification-only entry (safe while disabled).
 * Does not mutate Agent numbers, project-state, or production evidence.
 */
import { runWebsiteDepartment, WEBSITE_DEPARTMENT } from "./WebsiteDepartmentDirector.js";
import { buildRouteRegistry, FORBIDDEN_LEGACY_CATALOG, FORBIDDEN_LEGACY_SLUG } from "./WebsiteRouteRegistry.js";

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(msg);
}

async function main(): Promise<void> {
  assert(WEBSITE_DEPARTMENT.module === "website-department", "module id");
  assert(WEBSITE_DEPARTMENT.identity === "run_id", "run identity (not agent number)");
  assert(!("agent" in WEBSITE_DEPARTMENT), "must not require Agent #100");

  const registry = buildRouteRegistry();
  assert(registry.routes.length >= 8, "route registry size");
  assert(
    !registry.routes.some((r) => r.path.includes(FORBIDDEN_LEGACY_SLUG)),
    "legacy SEO slug absent",
  );
  assert(
    registry.example.seo_slug !== FORBIDDEN_LEGACY_SLUG,
    "derived slug is not legacy senior-software-engineer-resume",
  );

  const result = await runWebsiteDepartment({
    verification_only: true,
    persist: false,
    allow_network: false,
    mode: "static",
  });

  assert(result.mode === "verification_only", "verification_only mode");
  assert(result.persisted === false, "no persist");
  assert(result.project_state_written === false, "no project-state write");
  assert(result.run.run_id.startsWith("webrun-"), "run_id format");
  assert(result.run.browser_coverage === "not_run", "browser not_run");
  assert(result.run.auth_coverage === "not_run", "auth not_run");
  assert(
    result.scenarios.some((s) => s.id === "browser_journey" && s.execution === "not_run"),
    "browser scenario NOT_RUN",
  );
  assert(result.checks.route_registry, "route registry check");
  assert(result.checks.website_health_checker, "website health checker");
  assert(result.checks.browser_not_falsely_claimed, "browser honesty");

  // Soft note: operational catalog id may still exist in repo data; registry must not hardcode it.
  void FORBIDDEN_LEGACY_CATALOG;

  console.log(
    JSON.stringify(
      {
        pass: true,
        component: "website-department",
        identity: "run_id",
        run_id: result.run.run_id,
        status: result.status,
        mode: result.mode,
        persisted: result.persisted,
        project_state_written: result.project_state_written,
        registry_example: result.registry_example,
        routes_ok: result.routes.filter((r) => r.ok).length,
        routes_total: result.routes.length,
        scenarios_pass: result.scenarios.filter((s) => s.pass).length,
        scenarios_total: result.scenarios.length,
        alerts: result.alerts.length,
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
