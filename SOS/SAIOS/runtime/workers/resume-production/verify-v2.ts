#!/usr/bin/env tsx
/**
 * V2 verification — one complete generation cycle through mandatory pipeline.
 */
import { existsSync } from "node:fs";
import { join } from "node:path";
import { runProductionV2 } from "./production-pipeline.js";
import { RESUME_PRODUCTION_WORKER } from "./index.js";

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(msg);
}

async function main(): Promise<void> {
  assert(RESUME_PRODUCTION_WORKER.version === "2.0.0", "worker v2");
  assert(RESUME_PRODUCTION_WORKER.capabilities.includes("v2-production-pipeline"), "v2 capability");

  const result = await runProductionV2({
    objective: "Generate a modern ATS professional resume for software engineer founder review.",
    mcp_firecrawl_available: true,
    learning_persist: false,
  });

  const dir = result.output_dir;

  assert(result.pass, "overall pass");
  assert(result.worker_version === "2.0.0", "v2 version");
  assert(result.status === "AWAITING_FOUNDER_APPROVAL", "awaiting founder");
  assert(result.confidence.overall_confidence >= 95, "confidence target");
  assert(result.confidence.target_met, "target met");
  assert(result.qa_pass, "qa pass");

  const required = [
    "research-report.md",
    "design-plan.json",
    "design-review-1.md",
    "design-review-2.md",
    "validation.json",
    "confidence.json",
    "generation-report.md",
    "thumbnail-analysis.json",
    "final-summary.md",
    "template-preview.json",
    "thumbnail.png",
    "localhost/review.json",
  ];

  for (const file of required) {
    assert(existsSync(join(dir, file)), `artifact: ${file}`);
  }

  assert(result.local_review_command.includes("review:template"), "review command");

  console.log(
    JSON.stringify(
      {
        pass: true,
        component: "resume-production-worker-v2",
        prototype_id: result.prototype_id,
        output_dir: result.output_dir,
        overall_confidence: result.confidence.overall_confidence,
        qa_pass: result.qa_pass,
        duplicate_redesigns: result.duplicate_redesigns,
        checks: {
          research: true,
          planning: existsSync(join(dir, "design-plan.json")),
          generation: existsSync(join(dir, "template-preview.json")),
          validation: existsSync(join(dir, "validation.json")),
          qa: result.qa_pass,
          local_review: existsSync(join(dir, "localhost/review.json")),
          founder_gate: result.status === "AWAITING_FOUNDER_APPROVAL",
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
