#!/usr/bin/env node
/**
 * Business Execution Planner verification
 * Run: npm run product:business-verify (from SOS/SAIOS/runtime)
 */
import { BusinessExecutionPlanner } from "./BusinessExecutionPlanner.js";

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(msg);
}

const EXPECTED_PRIORITY_ORDER = [
  "Resume Templates",
  "SEO Landing Pages",
  "ATS Improvements",
  "Resume Assets",
  "Cover Letter",
  "Invoice Generator",
  "Portfolio Builder",
  "PDF Tools",
];

async function main(): Promise<void> {
  const planner = new BusinessExecutionPlanner({ batch_size: 10 });
  const objective = { raw_text: "Generate recurring revenue within 60 days." };
  const plan = planner.plan(objective);

  assert(plan.features.length === 8, `expected 8 prioritized features, got ${plan.features.length}`);
  assert(plan.total_jobs > 0, "expected engineering jobs");
  assert(plan.total_batches > 0, "expected parallel batches");
  assert(plan.business_impact.horizon_days === 60, "expected 60-day horizon");
  assert(
    plan.business_impact.objective_intents.includes("revenue"),
    "expected revenue intent detection",
  );

  const featureNames = plan.features.map((f) => f.name);
  for (let i = 0; i < EXPECTED_PRIORITY_ORDER.length; i++) {
    assert(
      featureNames[i] === EXPECTED_PRIORITY_ORDER[i],
      `priority ${i + 1}: expected ${EXPECTED_PRIORITY_ORDER[i]}, got ${featureNames[i]}`,
    );
  }

  for (const feature of plan.features) {
    assert(feature.revenue_impact_score > 0, `${feature.name} needs revenue impact`);
    assert(feature.traffic_impact_score > 0, `${feature.name} needs traffic impact`);
    assert(feature.priority_score > 0, `${feature.name} needs priority score`);
    assert(feature.estimated_jobs >= 1, `${feature.name} needs estimated jobs`);
  }

  assert(
    plan.expected_completion_order.length === plan.total_jobs,
    "expected completion order should cover all jobs",
  );
  assert(plan.dependencies.edges.length > 0, "expected dependency graph");
  assert(plan.batches.some((b) => b.parallel_safe), "expected parallel-safe batches");
  assert(Boolean(plan.business_impact.expected_revenue_path), "expected business impact path");

  const topFeature = plan.features[0]!;
  assert(topFeature.name === "Resume Templates", "Resume Templates should be priority 1");

  console.log(
    JSON.stringify(
      {
        pass: true,
        component: "business-execution-planner",
        objective: objective.raw_text,
        plan_id: plan.plan_id,
        horizon_days: plan.business_impact.horizon_days,
        intents: plan.business_impact.objective_intents,
        prioritized_features: plan.features.map((f) => ({
          rank: f.rank,
          name: f.name,
          priority_score: f.priority_score,
          revenue_impact: f.revenue_impact_score,
          traffic_impact: f.traffic_impact_score,
          jobs: f.estimated_jobs,
        })),
        total_jobs: plan.total_jobs,
        total_batches: plan.total_batches,
        dependency_edges: plan.dependencies.edges.length,
        business_impact: plan.business_impact,
        checks: {
          prioritized_features: true,
          execution_order: true,
          estimated_impact: true,
          dependency_graph: true,
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
