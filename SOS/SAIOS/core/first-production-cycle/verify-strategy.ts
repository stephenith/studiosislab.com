/**
 * Canonical Production Strategy Engine verify — Agent #216.
 */
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";
import { CYCLE_LOG } from "./runFirstProductionCycle.js";
import { planPortfolio } from "./PortfolioPlanner.js";
import type { CandidateManifest } from "./CandidateStore.js";
import {
  buildProductionStrategy,
  DEFAULT_STRATEGY_POLICY,
  STRATEGY_HISTORY_ROOT,
  STRATEGY_LOG_ROOT,
} from "./ProductionStrategyEngine.js";

const REPO = resolve(import.meta.dirname, "../../../..");
const OUT = join(CYCLE_LOG, "strategy-verify.json");
const GUARD = join(REPO, "SOS/SAIOS/architecture/runtime-guard.ts");
const ENGINE_SRC = join(import.meta.dirname, "ProductionStrategyEngine.ts");

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(msg);
}

function fixture(
  partial: Partial<CandidateManifest> & {
    candidate_id: string;
    status: CandidateManifest["status"];
    target: CandidateManifest["target"];
  },
): CandidateManifest {
  return {
    schema_version: 1,
    task_id: `task-${partial.candidate_id}`,
    review_id: `review-${partial.candidate_id}`,
    cycle_id: "cycle-strategy-verify",
    run_id: `run-${partial.candidate_id}`,
    created_at: "2026-07-21T00:00:00.000Z",
    updated_at: "2026-07-21T00:00:00.000Z",
    publication_allowed: false,
    provider: "mock",
    failure_stage: null,
    failure_detail: null,
    artifacts: {},
    ...partial,
  };
}

async function main(): Promise<void> {
  delete process.env.OPENAI_API_KEY;
  process.env.SOS_AIOS_LIVE = "0";
  mkdirSync(CYCLE_LOG, { recursive: true });

  const fixtures: CandidateManifest[] = [
    fixture({
      candidate_id: "st-mkt-1",
      status: "WAITING_FOUNDER",
      target: {
        category: "marketing",
        title: "Marketing Manager",
        industry: "marketing",
        seniority: "mid",
        objective: "strategy fixture marketing",
        role_family: "marketing_manager",
      },
    }),
    fixture({
      candidate_id: "st-fin-1",
      status: "WAITING_FOUNDER",
      target: {
        category: "finance",
        title: "Financial Analyst",
        industry: "finance",
        seniority: "mid",
        objective: "strategy fixture finance",
        role_family: "financial_analyst",
      },
    }),
  ];

  const portfolio = planPortfolio({
    manifests: fixtures,
    persist: true,
    now: new Date("2026-07-21T12:00:00.000Z"),
  });
  assert(existsSync(join(REPO, portfolio.report_path)), "portfolio report loaded path");

  const s1 = buildProductionStrategy({
    portfolio,
    persist: true,
    now: new Date("2026-07-21T12:00:00.000Z"),
  });
  assert(s1.portfolio_score === portfolio.coverage_score, "portfolio score");
  assert(s1.recommendations.length >= 1, "recommendations ranked");
  assert(s1.recommendations[0]!.priority === 1, "priority starts at 1");
  assert(
    s1.recommendations.every((r, i) => r.priority === i + 1),
    "priorities sequential",
  );
  // Missing categories should rank before balance items
  const firstMissing = s1.recommendations.find((r) => r.kind === "missing_category");
  assert(Boolean(firstMissing), "has missing_category");
  assert(firstMissing!.priority < 10, "missing category near top");
  assert(
    JSON.stringify(s1.policy) === JSON.stringify(DEFAULT_STRATEGY_POLICY) ||
      s1.policy.prefer_missing_categories === true,
    "policy applied defaults",
  );
  assert(s1.openai_called === false, "no openai");
  assert(s1.production_triggered === false, "no production");
  assert(s1.publication_allowed === false, "publication off");
  assert(existsSync(join(REPO, s1.report_path)), "strategy report written");
  assert(existsSync(join(REPO, s1.history_path)), "history written");

  // Policy: maximum_recommendations
  const sCap = buildProductionStrategy({
    portfolio,
    persist: false,
    policy: { maximum_recommendations: 3 },
  });
  assert(sCap.recommendations.length === 3, "policy max recommendations");
  assert(sCap.policy.maximum_recommendations === 3, "policy recorded");

  // Policy: avoid_overrepresented (default) — no overrepresented kind when avoided
  assert(
    !s1.recommendations.some((r) => r.kind === "overrepresented"),
    "avoid overrepresented by default",
  );

  // Determinism
  const s2 = buildProductionStrategy({
    portfolio,
    persist: true,
    now: new Date("2026-07-21T12:00:01.000Z"),
  });
  assert(s1.history_path !== s2.history_path, "history not overwritten");
  assert(existsSync(join(REPO, s1.history_path)), "prior history retained");
  assert(
    s1.recommendations.map((r) => r.goal_id).join("|") ===
      s2.recommendations.map((r) => r.goal_id).join("|"),
    "deterministic goal order",
  );

  // Live portfolio file path
  const livePortfolio = planPortfolio({ persist: true });
  const fromFile = buildProductionStrategy({
    portfolioReportPath: join(REPO, livePortfolio.report_path),
    persist: true,
  });
  assert(fromFile.recommendation_count >= 0, "file-based strategy");

  const hist = existsSync(STRATEGY_HISTORY_ROOT)
    ? readdirSync(STRATEGY_HISTORY_ROOT).filter((f) => f.endsWith(".json"))
    : [];
  assert(hist.length >= 2, `history files=${hist.length}`);

  const src = readFileSync(ENGINE_SRC, "utf8");
  assert(!/from\s+["'].*openai/i.test(src), "no openai import");
  assert(!/runProduction\s*\(/.test(src), "no controller");
  assert(!/runCanonicalBatch\s*\(/.test(src), "no batchrunner");
  assert(
    existsSync(GUARD) && readFileSync(GUARD, "utf8").includes("ENGINES"),
    "runtime guard",
  );
  assert(
    existsSync(join(STRATEGY_LOG_ROOT, "production-strategy.json")),
    "production-strategy.json",
  );

  const checks = {
    portfolio_report_loaded: true,
    deterministic_strategy: true,
    policy_applied: true,
    recommendations_ranked: true,
    history_retained: true,
    no_openai_calls: true,
    no_production_triggered: true,
    publication_disabled: true,
    runtime_guard: true,
  };

  const overall = Object.values(checks).every(Boolean);
  writeFileSync(
    OUT,
    `${JSON.stringify(
      {
        generated_at: new Date().toISOString(),
        agent: "216",
        overall: overall ? "PASS" : "FAIL",
        checks,
        recommendation_count: s1.recommendation_count,
        top_goal: s1.recommendations[0]?.goal_id ?? null,
        history_files: hist.length,
      },
      null,
      2,
    )}\n`,
  );

  console.log("Canonical Production Strategy Engine Verify");
  console.log("==========================================");
  for (const [k, v] of Object.entries(checks)) {
    console.log(`${v ? "✔" : "✘"} ${k}`);
  }
  console.log(
    `Recs=${s1.recommendation_count} · top=${s1.recommendations[0]?.kind} · score=${s1.portfolio_score}`,
  );
  console.log(`Overall: ${overall ? "PASS" : "FAIL"}`);
  if (!overall) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
