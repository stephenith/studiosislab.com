#!/usr/bin/env tsx
/**
 * Quality calibration v1 verification.
 */
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const SOS_ROOT = resolve(import.meta.dirname, "../../..");
const CAL_ROOT = join(SOS_ROOT, "07_LOGS/saios/quality-calibration-v1");

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(msg);
}

async function main(): Promise<void> {
  assert(existsSync(join(CAL_ROOT, "improvement-comparison.md")), "improvement-comparison.md");
  assert(existsSync(join(CAL_ROOT, "quality-delta.json")), "quality-delta.json");
  assert(existsSync(join(CAL_ROOT, "founder-calibration.json")), "founder-calibration.json");
  assert(existsSync(join(CAL_ROOT, "software-engineer-after", "template-preview.json")), "after template");

  const verification = JSON.parse(readFileSync(join(CAL_ROOT, "verification.json"), "utf8")) as {
    pass: boolean;
    before: { page_utilization: number };
    after: { page_utilization: number; visual: number; premium: number; render: number };
    delta: { page_utilization_delta: number; scores_now_realistic: boolean };
  };

  assert(verification.pass, "calibration mission pass");
  assert(verification.delta.page_utilization_delta > 0, "page utilization improved");
  assert(verification.after.page_utilization >= 0.75, "page utilization target");
  assert(verification.delta.scores_now_realistic, "realistic scores");

  console.log(
    JSON.stringify(
      {
        pass: true,
        component: "quality-calibration-v1",
        page_utilization_before: verification.before.page_utilization,
        page_utilization_after: verification.after.page_utilization,
        scores_after: {
          visual: verification.after.visual,
          premium: verification.after.premium,
          render: verification.after.render,
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
