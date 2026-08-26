#!/usr/bin/env tsx
/**
 * Resume Production Worker v2 CLI — LEGACY (Agent #160 runtime freeze).
 * Blocked unless SOS_AIOS_ALLOW_LEGACY_ENGINE=1.
 * Canonical: SOS/SAIOS/core/first-production-cycle
 */
import { ENGINES, enforceEngineAccess } from "../../../architecture/runtime-guard.js";
import { runProductionV2 } from "./production-pipeline.js";

async function main(): Promise<void> {
  enforceEngineAccess(ENGINES.LEGACY_PRODUCTION_V2, { source: "cli" });
  process.env.SOS_AIOS_ALLOW_LEGACY_ENGINE = "1";
  const objectiveArg = process.argv.find((a) => a.startsWith("--objective="));
  const objective = objectiveArg?.slice("--objective=".length);

  console.log("[resume-production-worker] v2 starting (LEGACY)…");
  const result = await runProductionV2({ objective, learning_persist: true });
  console.log(JSON.stringify(result, null, 2));
  if (!result.pass) process.exit(1);
}

main().catch((err) => {
  console.error(JSON.stringify({ pass: false, error: String(err) }, null, 2));
  process.exit(1);
});
