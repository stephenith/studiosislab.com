/**
 * CLI: npm run aios:publication:verify -- --plan-id=<id>
 * Batch verification — any failure invalidates the entire plan.
 */
import { verifyPublicationPlan } from "./PublicationVerifyService.js";

function arg(name: string): string | null {
  const pref = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(pref));
  return hit ? hit.slice(pref.length) : null;
}

function main(): void {
  const planId = arg("plan-id");
  if (!planId) {
    console.error(
      "Usage: npm run aios:publication:verify -- --plan-id=<plan-id>",
    );
    process.exit(1);
  }
  const report = verifyPublicationPlan(planId);
  console.log(JSON.stringify(report, null, 2));
  if (!report.pass) {
    console.error(`\nVERIFY FAILED for ${planId}`);
    for (const e of report.errors) console.error(`  - ${e}`);
    process.exit(1);
  }
  console.error(`\nVERIFY PASS for ${planId} (${report.eligible_count} entries)`);
}

main();
