#!/usr/bin/env tsx
/**
 * Premium Resume Generator v3 CLI — LEGACY (Agent #160 runtime freeze).
 * Blocked unless SOS_AIOS_ALLOW_LEGACY_ENGINE=1.
 * Canonical: SOS/SAIOS/core/first-production-cycle
 */
import { ENGINES, enforceEngineAccess } from "../../../architecture/runtime-guard.js";
import { runProductionV3 } from "./production-pipeline-v3.js";

const objective =
  process.argv.find((a) => a.startsWith("--objective="))?.slice("--objective=".length) ??
  undefined;

async function main(): Promise<void> {
  enforceEngineAccess(ENGINES.LEGACY_PRODUCTION_V3, { source: "cli" });
  // Opt-in so library guard also passes for intentional CLI legacy runs
  process.env.SOS_AIOS_ALLOW_LEGACY_ENGINE = "1";
  const result = await runProductionV3({ objective, learning_persist: true });
  console.log(JSON.stringify(result, null, 2));
  if (!result.pass) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
