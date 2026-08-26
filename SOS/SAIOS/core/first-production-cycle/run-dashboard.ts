#!/usr/bin/env tsx
/**
 * Canonical Operations Dashboard CLI — Agent #219.
 * Read-only aggregation. No production. No OpenAI.
 *
 * Usage: npm run aios:dashboard:run
 */
import { resolve } from "node:path";
import dotenv from "dotenv";
dotenv.config({ path: resolve(process.cwd(), ".env.local") });
import { buildOperationsDashboard } from "./OperationsDashboard.js";

async function main(): Promise<void> {
  if (process.env.SOS_AIOS_LIVE === "1") {
    console.error("LIVE must be OFF");
    process.exit(1);
  }
  const dash = buildOperationsDashboard({ persist: true });
  console.log(
    JSON.stringify(
      {
        system_health: dash.system_health.status,
        autonomous_status: dash.autonomous_status.state,
        today_cycles: dash.today_cycles,
        today_candidates: dash.today_candidates,
        budget_status: dash.budget_status.decision,
        portfolio_score: dash.portfolio_score,
        strategy_version: dash.strategy_version,
        founder_queue: dash.founder_queue.waiting,
        candidate_totals: dash.candidate_totals.total,
        last_execution: dash.last_execution.execution_id,
        last_failure: dash.last_failure.execution_id,
        missing_sources: dash.missing_sources,
        report_path: dash.report_path,
        history_path: dash.history_path,
        publication_allowed: dash.publication_allowed,
        read_only: dash.read_only,
        openai_called: dash.openai_called,
        production_triggered: dash.production_triggered,
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
