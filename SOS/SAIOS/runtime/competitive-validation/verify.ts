#!/usr/bin/env tsx
/**
 * Competitive validation verification.
 */
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  COMPETITIVE_VALIDATION,
  runCompetitiveValidation,
} from "./CompetitiveValidationDirector.js";
import { COMPETITIVE_MEMORY_PATH } from "./CompetitiveMemory.js";

const SOS_ROOT = resolve(import.meta.dirname, "../../..");
const TARGET_TEMPLATE = join(
  SOS_ROOT,
  "07_LOGS/saios/generated-resumes/production-batch-001-software-engineer/template-preview.json",
);

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(msg);
}

async function main(): Promise<void> {
  assert(COMPETITIVE_VALIDATION.module === "competitive-design-validation", "module id");
  assert(COMPETITIVE_VALIDATION.role === "evaluation_only_layer", "role");
  assert(
    COMPETITIVE_VALIDATION.prohibitions.includes("no_resume_generation"),
    "no generation",
  );
  assert(existsSync(TARGET_TEMPLATE), "target template exists");

  const result = await runCompetitiveValidation({
    template_path: TARGET_TEMPLATE,
    mcp_firecrawl_available: true,
    persist: true,
  });

  assert(result.status === "AWAITING_FOUNDER_APPROVAL", "founder approval status");
  assert(result.analysis.benchmark_set.length >= 10, "competitive benchmark set");
  assert(result.score.axis_scores.length === 19, "all validation axes");
  assert(result.strengths.length > 0, "strengths");
  assert(result.weaknesses.length > 0 || result.improvements.length > 0, "weaknesses or improvements");
  assert(result.design_dna_delta.design_dna_version.length > 0, "dna delta");

  for (const file of [
    "competitive-analysis.json",
    "competitive-score.json",
    "strengths.json",
    "weaknesses.json",
    "recommended-improvements.json",
    "design-dna-delta.json",
    "competitive-report.md",
  ]) {
    assert(existsSync(join(result.output_dir, file)), `artifact: ${file}`);
  }

  assert(existsSync(COMPETITIVE_MEMORY_PATH), "competitive learning memory");
  const learning = JSON.parse(readFileSync(COMPETITIVE_MEMORY_PATH, "utf8")) as {
    entries: Array<{ founder_status: string }>;
  };
  assert(learning.entries.length > 0, "learning appended");
  assert(learning.entries.at(-1)?.founder_status === "AWAITING_FOUNDER_APPROVAL", "status recorded");

  console.log(
    JSON.stringify(
      {
        pass: result.pass,
        component: "competitive-design-validation",
        template_name: result.template_name,
        output_dir: result.output_dir,
        overall_competitive_score: result.score.overall_competitive_score,
        likely_user_choice: result.score.likely_user_choice,
        design_dna_update_recommended: result.design_dna_delta.should_update,
        checks: {
          evaluation_only: true,
          benchmark_set: result.analysis.benchmark_set.length >= 10,
          all_axes_scored: result.score.axis_scores.length === 19,
          artifacts_written: true,
          learning_appended: true,
          founder_gate_preserved: result.status === "AWAITING_FOUNDER_APPROVAL",
        },
        overall: result.pass ? "PASS" : "FAIL",
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
