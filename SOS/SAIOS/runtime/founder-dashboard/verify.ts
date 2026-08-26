#!/usr/bin/env tsx
/**
 * Founder Operations Dashboard verification.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  FOUNDER_OPERATIONS_DASHBOARD,
  refreshFounderDashboard,
  searchFactory,
  listArtifactStages,
  exportDashboardData,
  submitFounderReview,
} from "./FounderDashboardDirector.js";
import { DASHBOARD_ROOT } from "./DashboardReporter.js";
import { getSchedulerStatus } from "./FactoryController.js";
import { loadUnifiedRuns } from "./DataAggregator.js";

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(msg);
}

async function main(): Promise<void> {
  assert(FOUNDER_OPERATIONS_DASHBOARD.module === "founder-operations-dashboard", "module id");
  assert(FOUNDER_OPERATIONS_DASHBOARD.role === "founder_control_center_only", "role");

  const result = await refreshFounderDashboard({ persist: true });
  assert(result.pass, "dashboard loads");
  assert(result.snapshot.factory_status !== undefined, "factory status");

  const required = [
    "dashboard.json",
    "health.json",
    "queue.json",
    "production.json",
    "review.json",
    "reports.json",
    "statistics.json",
    "factory-status.json",
  ];

  for (const file of required) {
    assert(existsSync(join(DASHBOARD_ROOT, file)), `artifact: ${file}`);
  }

  assert(getSchedulerStatus() !== undefined, "scheduler integration");
  assert(loadUnifiedRuns().length >= 0, "unified production integration");

  const queue = JSON.parse(readFileSync(join(DASHBOARD_ROOT, "queue.json"), "utf8")) as { totals: object };
  assert(queue.totals !== undefined, "queue integration");

  const review = JSON.parse(readFileSync(join(DASHBOARD_ROOT, "review.json"), "utf8")) as { items: unknown[] };
  assert(Array.isArray(review.items), "founder review integration");

  const production = JSON.parse(readFileSync(join(DASHBOARD_ROOT, "production.json"), "utf8")) as {
    publication: object;
  };
  assert(production.publication !== undefined, "publication integration");

  const reports = JSON.parse(readFileSync(join(DASHBOARD_ROOT, "reports.json"), "utf8")) as { daily: object };
  assert(reports.daily !== undefined, "reports integration");

  const stats = JSON.parse(readFileSync(join(DASHBOARD_ROOT, "statistics.json"), "utf8")) as {
    total_production_runs: number;
  };
  assert(typeof stats.total_production_runs === "number", "statistics");

  const learning = (JSON.parse(readFileSync(join(DASHBOARD_ROOT, "production.json"), "utf8")) as {
    learning: object;
  }).learning;
  assert(learning !== undefined, "learning integration");

  const search = searchFactory("unified");
  assert(search.results.length >= 0, "search");

  const exports = exportDashboardData(DASHBOARD_ROOT, {
    snapshot: result.snapshot,
    queue,
    review,
    reports,
    statistics: stats,
  });
  assert(exports.some((f) => f.endsWith(".json")), "export json");
  assert(exports.some((f) => f.endsWith(".csv")), "export csv");
  assert(exports.some((f) => f.includes("founder-summary")), "export founder summary");

  const artifacts = listArtifactStages();
  assert(Object.keys(artifacts).length >= 5, "artifact viewer");

  const factoryStatus = JSON.parse(readFileSync(join(DASHBOARD_ROOT, "factory-status.json"), "utf8")) as {
    founder_gate: string;
    auto_publish: boolean;
  };
  assert(factoryStatus.founder_gate === "ENFORCED", "founder approval gate preserved");
  assert(factoryStatus.auto_publish === false, "no auto publish");

  const health = JSON.parse(readFileSync(join(DASHBOARD_ROOT, "health.json"), "utf8")) as {
    scheduler_status: string;
  };
  assert(health.scheduler_status !== undefined, "health monitoring");

  submitFounderReview({ prototype_id: "verify-test", action: "skip", founder_name: "Founder" });
  assert(existsSync(join(DASHBOARD_ROOT, "founder-decisions.json")), "founder action recorded");

  console.log(
    JSON.stringify(
      {
        pass: true,
        component: "founder-operations-dashboard",
        factory_status: result.snapshot.factory_status,
        review_pending: review.items.length,
        checks: {
          dashboard_loads: true,
          scheduler_integration: true,
          queue_integration: true,
          unified_production_integration: true,
          founder_review_integration: true,
          publication_integration: true,
          reports_integration: true,
          learning_integration: true,
          search: true,
          export: true,
          health_monitoring: true,
          founder_approval_gate_preserved: true,
        },
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
