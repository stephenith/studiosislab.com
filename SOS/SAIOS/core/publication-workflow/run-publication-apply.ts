/**
 * CLI: npm run aios:publication:apply -- --plan-id=<id> --confirm=PUBLISH_PLAN_<id>
 *
 * Default: dry-run only (re-verify + lock simulation).
 * Real writes require --execute AND SOS_AIOS_PUBLICATION_APPLY=1 AND LIVE OFF.
 * This implementation never commits/pushes during SAFE WRITE.
 */
import { applyPublicationPlan } from "./PublicationApplyService.js";

function arg(name: string): string | null {
  const pref = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(pref));
  return hit ? hit.slice(pref.length) : null;
}

function hasFlag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

async function main(): Promise<void> {
  const planId = arg("plan-id");
  const confirm = arg("confirm");
  if (!planId || !confirm) {
    console.error(
      "Usage: npm run aios:publication:apply -- --plan-id=<id> --confirm=PUBLISH_PLAN_<id> [--execute]",
    );
    process.exit(1);
  }

  const result = await applyPublicationPlan({
    plan_id: planId,
    confirm_phrase: confirm,
    execute_writes: hasFlag("execute"),
    actor: "founder",
  });

  console.log(
    JSON.stringify(
      {
        ok: result.ok,
        plan_id: result.plan?.plan_id ?? planId,
        plan_status: result.plan?.status ?? null,
        apply: result.apply,
        publication_allowed: false,
        live: false,
      },
      null,
      2,
    ),
  );

  if (!result.ok && result.apply.status !== "DRY_RUN") {
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
