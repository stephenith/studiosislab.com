#!/usr/bin/env tsx
/**
 * Production Dashboard verification.
 * AGENT #096
 */
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { summarizeQueue } from "./DashboardBuilder.js";
import { DASHBOARD_DIR, REPORT_PATH } from "./DashboardReporter.js";
import {
  PRODUCTION_DASHBOARD,
  runProductionDashboard,
  STATE_PATH,
} from "./ProductionDashboardManager.js";
import type { ProductionDashboard } from "./types.js";

const REPO_ROOT = resolve(import.meta.dirname, "../../../..");
const SOS_ROOT = join(REPO_ROOT, "SOS");

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(msg);
}

function main(): void {
  assert(PRODUCTION_DASHBOARD.module === "production-dashboard", "module id");
  assert(PRODUCTION_DASHBOARD.agent === "096", "agent number");

  const preState = JSON.parse(readFileSync(STATE_PATH, "utf8")) as {
    next_agent: string;
    latest_agent: string;
    latest_release: string;
    latest_catalog: string;
    latest_founder_review: string;
    latest_design_dna: string;
    latest_batch: string;
  };

  assert(preState.next_agent === "096", "pre-flight: next agent must be 096");

  const { dashboard, artifacts } = runProductionDashboard();

  const requiredFiles = [
    join(DASHBOARD_DIR, "dashboard.json"),
    join(DASHBOARD_DIR, "dashboard.md"),
    join(DASHBOARD_DIR, "batch-health.json"),
    join(DASHBOARD_DIR, "queue.json"),
    join(DASHBOARD_DIR, "publication-status.json"),
    join(DASHBOARD_DIR, "factory-health.json"),
    REPORT_PATH,
  ];
  for (const file of requiredFiles) {
    assert(existsSync(file), `artifact exists: ${file}`);
  }

  const saved = JSON.parse(readFileSync(STATE_PATH, "utf8")) as {
    latest_agent: string;
    next_agent: string;
    operations: { production_dashboard: Record<string, unknown> };
    history: Array<{ type: string }>;
  };

  assert(saved.latest_agent === "096", "project state latest_agent updated");
  assert(saved.next_agent === "097", "project state next_agent updated");
  assert(saved.operations?.production_dashboard?.last_run, "operations.production_dashboard populated");
  assert(
    saved.history.some((h) => h.type === "production_dashboard"),
    "history append production_dashboard",
  );

  const manifest = JSON.parse(
    readFileSync(join(REPO_ROOT, "templates.manifest.json"), "utf8"),
  ) as { templates: Array<{ id: string; status: string }> };
  const t094 = manifest.templates.find((t) => t.id === "t094");
  assert(t094?.status === "published", "catalog consistency: t094 published in manifest");

  const releaseHistory = JSON.parse(
    readFileSync(
      join(SOS_ROOT, "07_LOGS/saios/publication/release-manager/release-history.json"),
      "utf8",
    ),
  ) as Array<{ release_id: string; catalog_id: string; status: string }>;
  const liveRelease = releaseHistory.find((r) => r.status === "released");
  assert(liveRelease?.release_id === preState.latest_release, "release consistency");
  assert(liveRelease?.catalog_id === preState.latest_catalog, "release catalog consistency");

  const queueSummary = summarizeQueue(dashboard.queue);
  assert(dashboard.queue.length > 0, "production queue integrity: templates discovered");
  assert(
    dashboard.factory_health.templates_generated > 0,
    "batch completeness: generated templates tracked",
  );

  const batch001 = dashboard.queue.filter((r) => r.batch_id === preState.latest_batch);
  assert(batch001.length >= 10, "batch completeness: production-batch-001 templates");

  const founderReviews = existsSync(join(SOS_ROOT, "07_LOGS/saios/founder-critic/reviews"));
  assert(founderReviews, "founder review consistency: reviews dir exists");
  assert(
    dashboard.queue.some((r) => r.latest_review === preState.latest_founder_review),
    "founder review consistency: FR referenced on records",
  );

  const runtimeCatalogPath = join(REPO_ROOT, "src/lib/resumeCatalogRuntime.ts");
  assert(existsSync(runtimeCatalogPath), "runtime catalog module exists");

  const stalePublished = dashboard.queue.filter(
    (r) => r.current_stage === "published" && r.freshness.stale,
  );
  assert(stalePublished.length === 0, "no stale published templates");

  const parsedDashboard = JSON.parse(
    readFileSync(join(DASHBOARD_DIR, "dashboard.json"), "utf8"),
  ) as ProductionDashboard;
  assert(parsedDashboard.factory_health.current_release === preState.latest_release, "dashboard integrity");

  const checks = {
    factory_state_consistency: saved.latest_agent === "096" && saved.next_agent === "097",
    production_queue_integrity: dashboard.queue.length > 0,
    batch_completeness: batch001.length >= 10,
    publication_freshness: stalePublished.length === 0,
    release_consistency: liveRelease?.release_id === preState.latest_release,
    founder_review_consistency: preState.latest_founder_review.startsWith("FR#"),
    catalog_consistency: t094?.status === "published",
    runtime_catalog_consistency: existsSync(runtimeCatalogPath),
    dashboard_integrity: parsedDashboard.generated_at === dashboard.generated_at,
    no_stale_published: stalePublished.length === 0,
  };

  assert(Object.values(checks).every(Boolean), "all verification checks");

  console.log(
    JSON.stringify(
      {
        pass: true,
        component: "production-dashboard",
        agent: "096",
        dashboard_dir: artifacts.dashboard_dir,
        report_path: artifacts.report_path,
        factory_health: dashboard.factory_health,
        batch_health: dashboard.batch_health,
        queue_summary: queueSummary,
        publication_ready: dashboard.queue.filter((r) => r.current_stage === "ready_to_publish")
          .length,
        pending_founder: dashboard.queue.filter((r) => r.current_stage === "founder_review").length,
        issues_count: dashboard.issues.length,
        checks,
      },
      null,
      2,
    ),
  );
}

main();
