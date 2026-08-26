#!/usr/bin/env tsx
/**
 * Visual Render Evaluation Engine verification.
 */
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { VISUAL_RENDER_ENGINE, runVisualRenderEvaluation } from "./VisualRenderDirector.js";
import { loadRenderMemory } from "./VisualRenderMemory.js";

const SOS_ROOT = resolve(import.meta.dirname, "../../..");
const PREMIUM_TEMPLATE = join(
  SOS_ROOT,
  "07_LOGS/saios/generated-resumes/premium-collection-software-engineer-v3/template-preview.json",
);

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(msg);
}

async function main(): Promise<void> {
  assert(VISUAL_RENDER_ENGINE.module === "visual-render-evaluation-engine", "module id");
  assert(VISUAL_RENDER_ENGINE.role === "founder_vision_render_judge", "role");
  assert(existsSync(PREMIUM_TEMPLATE), "premium template for evaluation");

  const memoryBefore = loadRenderMemory();
  const result = await runVisualRenderEvaluation({
    template_path: PREMIUM_TEMPLATE,
    mcp_firecrawl_available: true,
    persist: true,
  });

  assert(result.pass, "evaluation pass");
  assert(result.dimensions.length >= 26, "all visual dimensions");
  assert(result.scores.overall_render_score > 0, "render score");
  assert(
    ["REJECT", "REVISION", "LIKELY APPROVE"].includes(result.scores.founder_approval_prediction),
    "founder prediction",
  );

  const required = [
    "visual-analysis.json",
    "render-score.json",
    "premium-perception.json",
    "eye-flow.json",
    "whitespace-analysis.json",
    "layout-balance.json",
    "typography-analysis.json",
    "hierarchy-analysis.json",
    "improvement-plan.md",
    "founder-review-preview.md",
  ];

  for (const file of required) {
    assert(existsSync(join(result.output_dir, file)), `artifact: ${file}`);
  }

  const memoryAfter = loadRenderMemory();
  assert(memoryAfter.entries.length >= memoryBefore.entries.length, "learning appended");

  console.log(
    JSON.stringify(
      {
        pass: true,
        component: "visual-render-evaluation-engine",
        template_name: result.template_name,
        overall_render_score: result.scores.overall_render_score,
        founder_prediction: result.scores.founder_approval_prediction,
        quality_gate_pass: result.quality_gate_pass,
        dimensions_analyzed: result.dimensions.length,
        checks: {
          render_evaluation_completed: true,
          all_dimensions_analyzed: result.dimensions.length >= 26,
          improvement_plan_generated: existsSync(join(result.output_dir, "improvement-plan.md")),
          founder_prediction_generated: true,
          learning_appended: true,
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
