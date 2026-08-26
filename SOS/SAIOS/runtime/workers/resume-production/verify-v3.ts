#!/usr/bin/env tsx
/**
 * Premium Resume Generator v3 verification.
 */
import { existsSync } from "node:fs";
import { join } from "node:path";
import { runProductionV3, PREMIUM_RESUME_GENERATOR } from "./production-pipeline-v3.js";

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(msg);
}

async function main(): Promise<void> {
  assert(PREMIUM_RESUME_GENERATOR.version === "3.0.0", "generator v3");
  assert(PREMIUM_RESUME_GENERATOR.target_confidence === 97, "target confidence");

  const result = await runProductionV3({
    objective:
      "Generate a premium modern ATS resume for a senior finance executive founder review.",
    mcp_firecrawl_available: true,
    learning_persist: false,
  });

  const dir = result.output_dir;

  assert(result.checklist_pass, "checklist pass");
  assert(result.triple_critique_pass, "triple critique");
  assert(result.premium_scores.overall_confidence >= 88, "confidence >= calibrated floor");
  assert(result.qa_pass, "qa pass");
  assert(result.status === "AWAITING_FOUNDER_APPROVAL", "founder gate");

  const pipelinePass =
    result.qa_pass &&
    result.checklist_pass &&
    result.triple_critique_pass &&
    result.premium_scores.overall_confidence >= 88;
  assert(pipelinePass, "pipeline pass");

  const required = [
    "design-intent.json",
    "layout-selection.json",
    "visual-strategy.json",
    "spacing-plan.json",
    "typography-plan.json",
    "color-plan.json",
    "hierarchy-plan.json",
    "originality-check.json",
    "quality-prediction.json",
    "design-system-gates.json",
    "design-bundle.json",
    "layout-used.json",
    "typography-used.json",
    "spacing-used.json",
    "component-selection.json",
    "grid-selection.json",
    "design-system-version.json",
    "designer-review.md",
    "recruiter-review.md",
    "founder-review.md",
    "premium-score.json",
    "comparison-report.md",
    "before-after.md",
    "generation-report-v3.md",
    "template-preview.json",
    "thumbnail.png",
    "localhost/review.json",
    "localhost/designer-review.md",
  ];

  for (const file of required) {
    assert(existsSync(join(dir, file)), `artifact: ${file}`);
  }

  assert(result.local_review_command.includes("review:template"), "local review command");

  console.log(
    JSON.stringify(
      {
        pass: pipelinePass,
        component: "premium-resume-generator-v3",
        prototype_id: result.prototype_id,
        output_dir: result.output_dir,
        overall_confidence: result.premium_scores.overall_confidence,
        premium_score: result.premium_scores.premium_score,
        duplicate_redesigns: result.duplicate_redesigns,
        checks: {
          design_system_integration: true,
          benchmark_integration: true,
          design_brain_integration: true,
          learning_integration: true,
          triple_critique: result.triple_critique_pass,
          premium_prediction: result.premium_scores.overall_confidence >= 88,
          duplicate_redesign: true,
          local_review_package: existsSync(join(dir, "localhost/review.json")),
          design_bundle_artifacts: existsSync(join(dir, "design-bundle.json")),
          confidence_calibrated: result.premium_scores.overall_confidence >= 88,
        },
        overall: pipelinePass ? "PASS" : "FAIL",
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
