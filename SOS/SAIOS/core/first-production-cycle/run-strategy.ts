#!/usr/bin/env tsx
/**
 * Canonical Production Strategy Engine CLI — Agent #216.
 * Strategy only. No production. No OpenAI.
 *
 * Usage: npm run aios:strategy:run
 */
import { resolve } from "node:path";
import dotenv from "dotenv";
dotenv.config({ path: resolve(process.cwd(), ".env.local") });
import { buildProductionStrategy } from "./ProductionStrategyEngine.js";
import { planPortfolio } from "./PortfolioPlanner.js";
import { existsSync } from "node:fs";
import { DEFAULT_PORTFOLIO_REPORT_PATH } from "./ProductionStrategyEngine.js";

async function main(): Promise<void> {
  if (process.env.SOS_AIOS_LIVE === "1") {
    console.error("LIVE must be OFF");
    process.exit(1);
  }
  // Ensure portfolio report exists (analysis only — not production)
  if (!existsSync(DEFAULT_PORTFOLIO_REPORT_PATH)) {
    planPortfolio({ persist: true });
  }
  const strategy = buildProductionStrategy({ persist: true });
  console.log(
    JSON.stringify(
      {
        portfolio_score: strategy.portfolio_score,
        recommendation_count: strategy.recommendation_count,
        top: strategy.recommendations.slice(0, 5).map((r) => ({
          priority: r.priority,
          goal_id: r.goal_id,
          kind: r.kind,
          confidence: r.confidence,
        })),
        report_path: strategy.report_path,
        history_path: strategy.history_path,
        publication_allowed: strategy.publication_allowed,
        openai_called: strategy.openai_called,
        production_triggered: strategy.production_triggered,
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
