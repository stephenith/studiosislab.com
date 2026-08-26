#!/usr/bin/env tsx
/**
 * Resume Learning Engine — ingest founder feedback and update learning memory.
 *
 * Usage:
 *   npm run learn
 *   npm run learn -- --feedback="Spacing is too tight." --template=modern-ats-professional-v1
 */
import { runLearningEngine } from "./learning-engine.js";

async function main(): Promise<void> {
  const feedbackArg = process.argv.find((a) => a.startsWith("--feedback="));
  const templateArg = process.argv.find((a) => a.startsWith("--template="));
  const decisionArg = process.argv.find((a) => a.startsWith("--decision="));

  if (!feedbackArg) {
    console.log("[learning] No --feedback= provided. Run npm run learning:verify for self-test.");
    process.exit(0);
  }

  const raw = feedbackArg.slice("--feedback=".length);
  const template_id = templateArg?.slice("--template=".length) ?? "unknown-template";
  const founder_decision = decisionArg?.slice("--decision=".length) as
    | "approved"
    | "rejected"
    | "revision"
    | undefined;

  console.log("[learning] Processing founder feedback…");
  const result = runLearningEngine({
    feedback: [{ raw, template_id, founder_decision }],
    persist: true,
  });

  console.log(`[learning] Feedback processed: ${result.feedback_processed}`);
  console.log(`[learning] Patterns extracted: ${result.patterns_extracted}`);
  console.log(`[learning] Rules generated: ${result.rules_generated}`);
  console.log(`[learning] Reports: ${result.output_dir}`);
  console.log(
    `[learning] Confidence for ${result.confidence_scores[0]?.template_id}: ${result.confidence_scores[0]?.overall_confidence}`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
