#!/usr/bin/env tsx
/**
 * Production Batch 001 verification.
 */
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { BATCH_ID, BATCH_ROLES, QUALITY_THRESHOLDS } from "./batch.js";
import type { BatchTemplateResult } from "./mission.js";

const SOS_ROOT = resolve(import.meta.dirname, "../../..");
const BATCH_ROOT = join(SOS_ROOT, "07_LOGS/saios", BATCH_ID);
const GENERATED_ROOT = join(SOS_ROOT, "07_LOGS/saios/generated-resumes");

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(msg);
}

async function main(): Promise<void> {
  assert(existsSync(join(BATCH_ROOT, "batch-summary.json")), "batch-summary.json");
  assert(existsSync(join(BATCH_ROOT, "batch-report.md")), "batch-report.md");
  assert(existsSync(join(BATCH_ROOT, "review-order.json")), "review-order.json");
  assert(existsSync(join(BATCH_ROOT, "recommended-review-sequence.json")), "recommended-review-sequence.json");

  const summary = JSON.parse(readFileSync(join(BATCH_ROOT, "batch-summary.json"), "utf8")) as {
    template_count: number;
    auto_publish: boolean;
    status: string;
  };
  assert(summary.template_count === 10, "10 templates in summary");
  assert(summary.auto_publish === false, "no auto publish");
  assert(summary.status === "AWAITING_FOUNDER_APPROVAL", "founder approval required");

  const results: BatchTemplateResult[] = [];
  for (const role of BATCH_ROLES) {
    const prototype_dir = join(GENERATED_ROOT, `${BATCH_ID}-${role.slug}`);
    const resultPath = join(BATCH_ROOT, "templates", role.slug, "result.json");
    assert(existsSync(resultPath), `result.json for ${role.slug}`);

    const entry = JSON.parse(readFileSync(resultPath, "utf8")) as BatchTemplateResult;
    results.push(entry);

    assert(existsSync(join(prototype_dir, "template-preview.json")), `template-preview ${role.slug}`);
    assert(entry.qa_pass, `QA passed ${role.slug}`);
    assert(entry.render_pass, `Visual render passed ${role.slug}`);
    assert(entry.critic_pass, `Founder critic ${role.slug}`);
    assert(entry.publication_pass, `Publication package ${role.slug}`);
    assert(entry.awaiting_founder, `awaiting founder ${role.slug}`);
    assert(entry.scores.render >= QUALITY_THRESHOLDS.visual_render, `render score ${role.slug}`);
    assert(existsSync(join(SOS_ROOT, "07_LOGS/saios/qa", entry.prototype_id, "validation.json")), `QA artifacts ${role.slug}`);
  }

  assert(results.length === 10, "10 templates generated");

  const reviewOrder = JSON.parse(readFileSync(join(BATCH_ROOT, "review-order.json"), "utf8")) as {
    review_order: string[];
  };
  assert(reviewOrder.review_order.length === 10, "review order length");

  const fingerprints = new Set(results.map((r) => r.composition_fingerprint));
  assert(fingerprints.size === 10, "visually unique compositions");

  console.log(
    JSON.stringify(
      {
        pass: true,
        component: "production-batch-001",
        batch_id: BATCH_ID,
        templates_generated: results.length,
        templates_passed: results.filter(
          (r) => r.qa_pass && r.render_pass && r.critic_pass && r.publication_pass,
        ).length,
        checks: {
          ten_templates_generated: results.length === 10,
          qa_passed: results.every((r) => r.qa_pass),
          visual_render_passed: results.every((r) => r.render_pass),
          founder_critic_completed: results.every((r) => r.critic_pass),
          publication_package_prepared: results.every((r) => r.publication_pass),
          founder_approval_required: summary.status === "AWAITING_FOUNDER_APPROVAL",
          visually_unique: fingerprints.size === 10,
        },
        review_order: reviewOrder.review_order,
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
