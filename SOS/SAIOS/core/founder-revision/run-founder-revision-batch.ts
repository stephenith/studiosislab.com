/**
 * CLI: npm run aios:revision:batch
 */
import { runFounderRevisionBatch } from "./FounderRevisionBatch.js";
import { writeFileSync, mkdirSync } from "node:fs";
import { join, resolve } from "node:path";

const REPO = resolve(import.meta.dirname, "../../../..");

async function main(): Promise<void> {
  const result = await runFounderRevisionBatch();
  const out = join(REPO, "SOS/07_LOGS/saios/founder-revision/run-result.json");
  mkdirSync(join(REPO, "SOS/07_LOGS/saios/founder-revision"), {
    recursive: true,
  });
  writeFileSync(out, `${JSON.stringify(result, null, 2)}\n`);
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.ok ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
