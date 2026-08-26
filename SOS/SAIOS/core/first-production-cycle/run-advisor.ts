#!/usr/bin/env tsx
/**
 * Canonical Operational Policy Advisor CLI — Agent #221.
 * Advisory only. No production. No policy mutation. No OpenAI.
 *
 * Usage: npm run aios:advisor:run
 */
import { resolve } from "node:path";
import dotenv from "dotenv";
dotenv.config({ path: resolve(process.cwd(), ".env.local") });
import { buildOperationalPolicyAdvice } from "./OperationalPolicyAdvisor.js";

async function main(): Promise<void> {
  if (process.env.SOS_AIOS_LIVE === "1") {
    console.error("LIVE must be OFF");
    process.exit(1);
  }
  const advice = buildOperationalPolicyAdvice({ persist: true });
  console.log(
    JSON.stringify(
      {
        recommendation_count: advice.recommendation_count,
        top: advice.recommendations.slice(0, 5).map((r) => ({
          id: r.recommendation_id,
          severity: r.severity,
          affected_policy: r.affected_policy,
          confidence: r.confidence,
        })),
        analysis: {
          average_production_per_day: advice.analysis.average_production_per_day,
          budget_denial_frequency: advice.analysis.budget_denial_frequency,
          health_failure_frequency: advice.analysis.health_failure_frequency,
          queue_saturation_ratio: advice.analysis.queue_saturation_ratio,
          controller_success_rate: advice.analysis.controller_success_rate,
          portfolio_score_latest: advice.analysis.portfolio_score_latest,
        },
        missing_sources: advice.missing_sources,
        advisory_only: advice.advisory_only,
        policies_modified: advice.policies_modified,
        report_path: advice.report_path,
        history_path: advice.history_path,
        publication_allowed: advice.publication_allowed,
        openai_called: advice.openai_called,
        production_triggered: advice.production_triggered,
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
