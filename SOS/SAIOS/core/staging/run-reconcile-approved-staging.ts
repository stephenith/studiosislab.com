/**
 * CLI: npm run aios:staging:reconcile-approved -- [--execute]
 *
 * Historical APPROVED_NOT_STAGED → stageApprovedCandidate (idempotent).
 * Default: dry-run only. Never publishes. LIVE must be OFF.
 *
 * Watched use after VPS deploy:
 *   SOS_AIOS_LIVE=0 npm run aios:staging:reconcile-approved
 *   SOS_AIOS_LIVE=0 npm run aios:staging:reconcile-approved -- --execute
 */
import { resolve } from "node:path";
import dotenv from "dotenv";
import { reconcileApprovedNotStaged } from "./ApprovalStagingHandoff.js";

const REPO = resolve(import.meta.dirname, "../../../..");
dotenv.config({ path: resolve(REPO, ".env.local") });

async function main(): Promise<void> {
  process.env.SOS_AIOS_LIVE = "0";
  if (process.env.SOS_AIOS_LIVE === "1") {
    throw new Error("LIVE must be OFF");
  }
  const execute = process.argv.includes("--execute");
  const result = await reconcileApprovedNotStaged({
    execute,
    actor: "cli-reconcile-approved-staging",
  });
  console.log(JSON.stringify(result, null, 2));
  if (execute && result.staged.some((s) => !s.ok)) process.exit(2);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
