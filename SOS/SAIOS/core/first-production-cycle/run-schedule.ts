#!/usr/bin/env tsx
/**
 * Canonical Adaptive Scheduling Policy CLI — Agent #220.
 * Evaluates and persists one scheduling decision. No production. No OpenAI.
 *
 * Usage: npm run aios:schedule:run
 */
import { resolve } from "node:path";
import dotenv from "dotenv";
dotenv.config({ path: resolve(process.cwd(), ".env.local") });
import { evaluateAdaptiveSchedule } from "./AdaptiveSchedulingPolicy.js";

async function main(): Promise<void> {
  if (process.env.SOS_AIOS_LIVE === "1") {
    console.error("LIVE must be OFF");
    process.exit(1);
  }
  const result = evaluateAdaptiveSchedule({ persist: true, persist_state: true });
  console.log(
    JSON.stringify(
      {
        decision: result.decision,
        next_interval_ms: result.next_interval_ms,
        next_interval_minutes: result.next_interval_minutes,
        reason_codes: result.reason_codes,
        policy_version: result.policy_version,
        cooldown_active: result.cooldown_state.active,
        consecutive_fast_cycles:
          result.fast_cycle_state.consecutive_fast_cycles,
        missing_signals: result.signals.missing_signals,
        report_path: result.report_path,
        history_path: result.history_path,
        publication_allowed: result.safety.publication_allowed,
        live: result.safety.live,
        openai_called: result.safety.openai_called,
        production_triggered: result.safety.production_triggered,
      },
      null,
      2,
    ),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
