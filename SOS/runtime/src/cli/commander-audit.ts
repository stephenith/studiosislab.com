#!/usr/bin/env node
/**
 * Read-only production audit — no state mutation.
 */
import { runProductionAudit } from "../commander/production-audit.js";

async function main(): Promise<void> {
  const audit = await runProductionAudit();
  console.log(JSON.stringify(audit, null, 2));
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
