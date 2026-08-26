/**
 * CLI: npm run aios:assets -- --export-package-id=<id>
 *   or: npm run aios:assets -- --candidate-id=<id>
 * Agent #244 — never publishes.
 */
import { resolve } from "node:path";
import dotenv from "dotenv";
import { processExportAssets } from "./AssetProcessingService.js";

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
  const exportPackageId = arg("export-package-id");
  const candidateId = arg("candidate-id");
  if (!exportPackageId && !candidateId) {
    console.error(
      "Usage: npm run aios:assets -- --export-package-id=<id> | --candidate-id=<id>",
    );
    process.exit(1);
  }
  const result = await processExportAssets({
    export_package_id: exportPackageId,
    candidate_id: candidateId,
    actor: "cli",
  });
  console.log(JSON.stringify(result, null, 2));
  if (!result.ok) process.exit(2);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
