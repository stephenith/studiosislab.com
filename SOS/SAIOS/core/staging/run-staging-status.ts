/**
 * CLI: npm run aios:staging-status -- --candidate-id=<id>
 */
import { resolve } from "node:path";
import { getStagingStatus } from "./StagingService.js";

function arg(name: string): string | null {
  const pref = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(pref));
  return hit ? hit.slice(pref.length) : null;
}

function main(): void {
  const candidateId = arg("candidate-id");
  if (!candidateId) {
    console.error("Usage: npm run aios:staging-status -- --candidate-id=<id>");
    process.exit(1);
  }
  console.log(JSON.stringify(getStagingStatus(candidateId), null, 2));
}

main();
