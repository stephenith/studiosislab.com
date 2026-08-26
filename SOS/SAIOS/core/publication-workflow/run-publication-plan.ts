/**
 * CLI: npm run aios:publication:plan
 * Discovers all eligible staged candidates and writes an immutable plan.
 * No website writes. No catalogue reservations.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { createPublicationPlan } from "./PublicationPlanService.js";

const REPO = resolve(import.meta.dirname, "../../../..");

function main(): void {
  const { plan, idempotent, omitted_eligible } = createPublicationPlan();
  if (omitted_eligible.length > 0) {
    console.error(
      JSON.stringify(
        { ok: false, error: "omission", omitted_eligible },
        null,
        2,
      ),
    );
    process.exit(1);
  }

  const outDir = join(REPO, "SOS/07_LOGS/saios/publication/plans");
  mkdirSync(outDir, { recursive: true });
  const summaryPath = join(outDir, "last-plan-summary.json");
  const summary = {
    ok: true,
    idempotent,
    plan_id: plan.plan_id,
    status: plan.status,
    entry_count: plan.entries.length,
    entries: plan.entries.map((e) => ({
      candidate_id: e.candidate_id,
      title: e.title,
      staging_package_id: e.staging_package_id,
      proposed_catalogue_id: e.proposed_catalogue_id,
      decision_id: e.decision_id,
    })),
    excluded_count: plan.excluded.length,
    warnings: plan.warnings,
    confirm_phrase: plan.confirm_phrase,
    website_writes: false,
    reservations_created: false,
    publication_allowed: false,
    live: false,
  };
  writeFileSync(summaryPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");

  console.log(JSON.stringify(summary, null, 2));
  console.error(
    `\nPlan ${plan.plan_id} (${idempotent ? "idempotent" : "created"}) — ${plan.entries.length} eligible resume template(s).`,
  );
  for (const e of plan.entries) {
    console.error(
      `  - ${e.proposed_catalogue_id} · ${e.title} · ${e.candidate_id}`,
    );
  }
  for (const w of plan.warnings) {
    console.error(`  warning: ${w}`);
  }
}

main();
