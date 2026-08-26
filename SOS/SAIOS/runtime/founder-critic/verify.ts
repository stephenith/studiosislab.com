#!/usr/bin/env tsx
/**
 * Founder AI Design Critic verification.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { FOUNDER_AI_DESIGN_CRITIC, runFounderCritic } from "./FounderCriticDirector.js";
import { loadBenchmarkDatabase } from "../benchmark/BenchmarkDatabase.js";
import { loadBrainMemory } from "../design-brain/DesignMemory.js";
import { loadDesignMemory } from "../workers/resume-learning/design-memory.js";
import { CRITIC_OUTPUT_ROOT } from "./CriticReporter.js";

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(msg);
}

async function main(): Promise<void> {
  assert(FOUNDER_AI_DESIGN_CRITIC.module === "founder-ai-design-critic", "module id");
  assert(FOUNDER_AI_DESIGN_CRITIC.role === "founder_quality_gate", "role");
  assert(FOUNDER_AI_DESIGN_CRITIC.prohibitions.includes("no_production_worker"), "not a worker");

  const benchmark = loadBenchmarkDatabase();
  assert(benchmark === null || benchmark.principle_count > 0, "benchmark integration");

  const brain = loadBrainMemory();
  assert(brain.version, "design brain memory");

  const learning = loadDesignMemory();
  assert(learning.version, "learning integration");

  const result = await runFounderCritic({ persist: true });

  assert(result.pass, "critic run pass");
  assert(result.predictions.founder_approval_probability > 0, "founder prediction");
  assert(result.predictions.user_click_probability > 0, "click prediction");
  assert(result.predictions.user_download_probability > 0, "download prediction");
  assert(result.predictions.premium_perception > 0, "premium prediction");
  assert(result.approval.founder_approval_mandatory, "never auto-approve");
  assert(result.approval.policy_band !== undefined, "approval recommendation");

  const required = [
    "founder-review.json",
    "founder-prediction.json",
    "improvement-plan.json",
    "visual-strengths.json",
    "visual-weaknesses.json",
    "approval-recommendation.json",
    "comparison-report.json",
    "critic-report.md",
  ];

  for (const file of required) {
    assert(existsSync(join(result.output_dir, file)), `artifact: ${file}`);
  }

  const comparison = JSON.parse(
    readFileSync(join(result.output_dir, "comparison-report.json"), "utf8"),
  );
  assert(comparison.never_self_only === true, "comparison engine");
  assert(comparison.corpus_comparisons.length > 0, "corpus comparison");

  const plan = JSON.parse(
    readFileSync(join(result.output_dir, "improvement-plan.json"), "utf8"),
  );
  assert(plan.recommendations.length > 0, "improvement planning");

  console.log(
    JSON.stringify(
      {
        pass: true,
        component: "founder-ai-design-critic",
        prototype_id: result.prototype_id,
        output_dir: result.output_dir,
        overall_score: result.overall_score,
        policy_band: result.approval.policy_band,
        ready_for_founder_review: result.ready_for_founder_review,
        founder_approval_probability: result.predictions.founder_approval_probability,
        premium_perception: result.predictions.premium_perception,
        checks: {
          benchmark_integration: true,
          design_brain_integration: true,
          learning_integration: true,
          founder_prediction: true,
          click_prediction: true,
          download_prediction: true,
          premium_prediction: true,
          comparison_engine: true,
          improvement_planning: true,
          approval_recommendation: true,
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
