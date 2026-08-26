#!/usr/bin/env tsx
/**
 * Self-test — simulates 10 founder reviews through the learning pipeline.
 */
import { existsSync } from "node:fs";
import { join } from "node:path";
import { RESUME_LEARNING_WORKER } from "./index.js";
import { runLearningEngine } from "./learning-engine.js";
import { LEARNING_ROOT } from "./design-memory.js";
import { parseFeedback } from "./feedback-parser.js";

const SIMULATED_REVIEWS = [
  { raw: "Spacing is too tight.", template_id: "modern-ats-professional-v1", founder_decision: "revision" as const },
  { raw: "Header feels crowded.", template_id: "modern-ats-professional-v1", founder_decision: "revision" as const },
  { raw: "Use less blue.", template_id: "modern-ats-professional-v1", founder_decision: "revision" as const },
  { raw: "Better typography.", template_id: "corporate-clean-v2", founder_decision: "revision" as const },
  { raw: "Improve ATS.", template_id: "corporate-clean-v2", founder_decision: "revision" as const },
  { raw: "Looks outdated.", template_id: "executive-serif-v1", founder_decision: "rejected" as const },
  { raw: "Needs more whitespace.", template_id: "executive-serif-v1", founder_decision: "revision" as const },
  { raw: "Move skills higher.", template_id: "modern-ats-professional-v1", founder_decision: "revision" as const },
  { raw: "Too many icons.", template_id: "visual-bold-v1", founder_decision: "rejected" as const },
  { raw: "Looks too plain.", template_id: "modern-ats-professional-v1", founder_decision: "revision" as const },
];

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(msg);
}

async function main(): Promise<void> {
  assert(RESUME_LEARNING_WORKER.worker_type === "resume-learning-worker", "worker type");
  assert(RESUME_LEARNING_WORKER.constraints.some((c) => c.includes("src/")), "src constraint");

  for (const review of SIMULATED_REVIEWS) {
    const parsed = parseFeedback(review);
    assert(parsed.categories.length > 0, `parses: ${review.raw}`);
    assert(parsed.signals.length > 0, `signals: ${review.raw}`);
  }

  const result = runLearningEngine({
    feedback: SIMULATED_REVIEWS,
    templates_generated_delta: 10,
    persist: true,
  });

  assert(result.feedback_processed === 10, "10 founder reviews processed");
  assert(result.patterns_extracted > 0, "patterns extracted");
  assert(result.rules_generated > 0, "learned rules generated");
  assert(result.memory_updated, "design memory persisted");
  assert(result.pass, "overall learning pass");

  const requiredFiles = [
    "feedback.json",
    "learned-patterns.json",
    "confidence.json",
    "quality-history.json",
    "design-memory.json",
    "learned-rules.json",
    "report.md",
  ];
  for (const file of requiredFiles) {
    assert(existsSync(join(LEARNING_ROOT, file)), `artifact exists: ${file}`);
  }

  assert(result.learned_rules.base_standards_preserved === true, "base standards preserved");
  assert(result.confidence_scores.length > 0, "confidence scores generated");
  assert(
    result.confidence_scores.every((c) => c.overall_confidence >= 0 && c.overall_confidence <= 100),
    "confidence in 0-100 range",
  );

  console.log(
    JSON.stringify(
      {
        pass: true,
        component: "resume-learning-worker",
        reviews_simulated: 10,
        patterns_extracted: result.patterns_extracted,
        rules_generated: result.rules_generated,
        approval_percentage: result.quality.approval_percentage,
        memory_feedback_count: result.memory.feedback_count,
        sample_confidence: result.confidence_scores[0],
        output_dir: result.output_dir,
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
