/**
 * CLI: npm run aios:export-stage -- --candidate-id=<id>
 *   or: npm run aios:export-stage -- --staging-package-id=<id>
 * Agent #243 — never publishes.
 */
import { resolve } from "node:path";
import dotenv from "dotenv";
import { exportStagedPackage } from "./ExportService.js";

const REPO = resolve(import.meta.dirname, "../../../..");
dotenv.config({ path: resolve(REPO, ".env.local") });

function arg(name: string): string | null {
  const pref = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(pref));
  return hit ? hit.slice(pref.length) : null;
}

async function main(): Promise<void> {
  process.env.SOS_AIOS_LIVE = "0";
  if (process.env.SOS_AIOS_LIVE === "1") {
    throw new Error("LIVE must be OFF");
  }
  const candidateId = arg("candidate-id");
  const stagingPackageId = arg("staging-package-id");
  if (!candidateId && !stagingPackageId) {
    console.error(
      "Usage: npm run aios:export-stage -- --candidate-id=<id> | --staging-package-id=<id>",
    );
    process.exit(1);
  }
  const result = await exportStagedPackage({
    candidate_id: candidateId,
    staging_package_id: stagingPackageId,
    actor: "cli",
  });
  console.log(JSON.stringify(result, null, 2));
  if (!result.ok) process.exit(2);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
