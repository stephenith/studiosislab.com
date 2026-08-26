#!/usr/bin/env tsx
/**
 * Canonical Portfolio Planner CLI — Agent #215.
 * Analysis only. No production. No OpenAI.
 *
 * Usage: npm run aios:portfolio:run
 */
import { resolve } from "node:path";
import dotenv from "dotenv";
dotenv.config({ path: resolve(process.cwd(), ".env.local") });
import { planPortfolio } from "./PortfolioPlanner.js";

async function main(): Promise<void> {
  if (process.env.SOS_AIOS_LIVE === "1") {
    console.error("LIVE must be OFF");
    process.exit(1);
  }
  const report = planPortfolio({ persist: true });
  console.log(
    JSON.stringify(
      {
        coverage_score: report.coverage_score,
        candidate_total: report.candidate_totals.total,
        recommendations: report.recommendations.length,
        report_path: report.report_path,
        history_path: report.history_path,
        publication_allowed: report.publication_allowed,
        openai_called: report.openai_called,
        production_triggered: report.production_triggered,
        coverage_summary: report.coverage_summary,
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
