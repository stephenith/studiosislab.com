#!/usr/bin/env node
/**
 * Product Delivery Engine verification
 * Run: npm run product:verify (from SOS/SAIOS/runtime)
 */
import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { ProductDeliveryEngine } from "./ProductDeliveryEngine.js";
import { resolveProductPaths } from "./paths.js";

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(msg);
}

async function main(): Promise<void> {
  const ts = String(Date.now());
  const verifyReportsDir = join(
    resolveProductPaths().repoRoot,
    "SOS",
    "07_LOGS",
    "saios",
    "product",
    "delivery-reports",
    "verify-runs",
    ts,
  );
  await mkdir(verifyReportsDir, { recursive: true });

  const engine = new ProductDeliveryEngine({ reportsDir: verifyReportsDir, batch_size: 10 });
  const objective = { raw_text: "Build 50 ATS Resume Templates." };
  const report = await engine.deliver(objective);
  const plan = report.plan;

  assert(report.total_features >= 5, `expected multiple features, got ${report.total_features}`);
  assert(report.total_jobs >= 100, `expected 100+ engineering jobs, got ${report.total_jobs}`);
  assert(report.total_batches >= 5, `expected parallel batches, got ${report.total_batches}`);
  assert(report.dependency_edge_count > 0, "expected dependency graph edges");
  assert(report.parallel_group_count >= 1, "expected parallel groups");
  assert(
    report.estimated_completion_order.length === report.total_jobs,
    "execution order should cover all jobs",
  );

  const featureNames = plan.features.map((f) => f.name);
  assert(featureNames.includes("Resume Templates"), "missing Resume Templates feature");
  assert(featureNames.includes("SEO Pages"), "missing SEO Pages feature");
  assert(featureNames.includes("Thumbnail Images"), "missing Thumbnail Images feature");
  assert(featureNames.includes("ATS Validation"), "missing ATS Validation feature");
  assert(featureNames.includes("Sample Profiles"), "missing Sample Profiles feature");

  assert(plan.epic.quantity === 50, `expected quantity 50, got ${plan.epic.quantity}`);
  assert(plan.batches.some((b) => b.parallel_safe), "expected at least one parallel-safe batch");
  assert(plan.dependencies.must_finish_first.length > 0, "expected must_finish_first chains");
  assert(Object.keys(plan.dependencies.blocked_jobs).length > 0, "expected blocked job map");

  const templateJobs = plan.jobs.filter((j) => j.feature_name === "Resume Templates");
  assert(templateJobs.length === 50, `expected 50 template jobs, got ${templateJobs.length}`);

  await rm(verifyReportsDir, { recursive: true, force: true });

  console.log(
    JSON.stringify(
      {
        pass: true,
        component: "product-delivery-engine",
        objective: objective.raw_text,
        epic_id: plan.epic.id,
        total_features: report.total_features,
        total_jobs: report.total_jobs,
        total_batches: report.total_batches,
        estimated_parallelism: report.estimated_parallelism,
        dependency_edges: report.dependency_edge_count,
        parallel_groups: report.parallel_group_count,
        critical_path_length: report.critical_path_length,
        features: featureNames,
        sample_batches: plan.batches.slice(0, 3).map((b) => b.name),
        checks: {
          multiple_features: report.total_features >= 5,
          jobs_over_100: report.total_jobs >= 100,
          parallel_batches: report.total_batches >= 5,
          dependency_graph: report.dependency_edge_count > 0,
          execution_order: report.estimated_completion_order.length === report.total_jobs,
        },
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
