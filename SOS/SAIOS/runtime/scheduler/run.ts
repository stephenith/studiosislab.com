#!/usr/bin/env tsx
/**
 * Scheduler CLI — LEGACY (Agent #160 runtime freeze).
 * Blocked unless SOS_AIOS_ALLOW_LEGACY_ENGINE=1.
 * Canonical production: SOS/SAIOS/core/first-production-cycle
 */
import { ENGINES, enforceEngineAccess } from "../../architecture/runtime-guard.js";
import { startScheduler, tickScheduler } from "./SchedulerDirector.js";
import { loadConfig } from "./SchedulerConfig.js";

async function main(): Promise<void> {
  enforceEngineAccess(ENGINES.LEGACY_SCHEDULER_CLI, { source: "cli" });
  process.env.SOS_AIOS_ALLOW_LEGACY_ENGINE = "1";

  const config = loadConfig();
  if (!config.enabled) {
    console.log(JSON.stringify({ status: "disabled", architecture_status: "LEGACY" }));
    return;
  }

  await startScheduler({ persist: true });

  const loop = async () => {
    try {
      const result = await tickScheduler({ persist: true });
      console.log(JSON.stringify({ tick: new Date().toISOString(), ...result }));
    } catch (err) {
      console.error(JSON.stringify({ error: String(err) }));
    }
    setTimeout(loop, config.workload.sleep_interval_ms);
  };

  await loop();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
