/**
 * Canonical Portfolio Intelligence verify — Agent #215.
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
import type { CandidateManifest } from "./CandidateStore.js";
import {
  computeCoverageScore,
  planPortfolio,
  PORTFOLIO_HISTORY_ROOT,
  PORTFOLIO_LOG_ROOT,
} from "./PortfolioPlanner.js";

const REPO = resolve(import.meta.dirname, "../../../..");
const OUT = join(CYCLE_LOG, "portfolio-verify.json");
const GUARD = join(REPO, "SOS/SAIOS/architecture/runtime-guard.ts");
const PLANNER_SRC = join(import.meta.dirname, "PortfolioPlanner.ts");

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
    task_id: partial.task_id ?? `task-${partial.candidate_id}`,
    review_id: partial.review_id ?? `review-${partial.candidate_id}`,
    cycle_id: "cycle-portfolio-verify",
    run_id: partial.run_id ?? `run-${partial.candidate_id}`,
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
  delete process.env.SOS_AI_FOUNDER_OPENAI_ONE_TEST;
  delete process.env.OPENAI_API_KEY;
  process.env.SOS_AIOS_LIVE = "0";
  mkdirSync(CYCLE_LOG, { recursive: true });

  const fixtures: CandidateManifest[] = [
    fixture({
      candidate_id: "pf-marketing-1",
      status: "WAITING_FOUNDER",
      target: {
        category: "marketing",
        title: "Marketing Manager",
        industry: "marketing",
        seniority: "mid",
        objective: "Marketing portfolio fixture A",
        role_family: "marketing_manager",
      },
    }),
    fixture({
      candidate_id: "pf-marketing-2",
      status: "WAITING_FOUNDER",
      target: {
        category: "marketing",
        title: "Marketing Manager",
        industry: "marketing",
        seniority: "mid",
        objective: "Marketing portfolio fixture B",
        role_family: "marketing_manager",
      },
    }),
    fixture({
      candidate_id: "pf-finance-1",
      status: "CRITIC_BLOCKED",
      target: {
        category: "finance",
        title: "Financial Analyst",
        industry: "finance",
        seniority: "mid",
        objective: "Finance portfolio fixture",
        role_family: "financial_analyst",
      },
    }),
  ];

  const r1 = planPortfolio({
    manifests: fixtures,
    persist: true,
    now: new Date("2026-07-21T10:00:00.000Z"),
  });
  assert(r1.candidate_totals.total === 3, "analyzed fixtures");
  assert(typeof r1.coverage_score === "number", "coverage score");
  assert(r1.coverage_score >= 0 && r1.coverage_score <= 100, "score range");
  assert(r1.recommendations.length >= 1, "recommendations generated");
  assert(
    r1.gaps.missing_categories.includes("engineering"),
    "missing engineering gap",
  );
  assert(r1.openai_called === false, "no openai");
  assert(r1.production_triggered === false, "no production");
  assert(r1.publication_allowed === false, "publication off");
  assert(existsSync(join(REPO, r1.report_path)), "report written");
  assert(existsSync(join(REPO, r1.history_path)), "history written");

  const r2 = planPortfolio({
    manifests: fixtures,
    persist: true,
    now: new Date("2026-07-21T10:00:01.000Z"),
  });
  assert(r1.history_path !== r2.history_path, "history not overwritten");
  assert(existsSync(join(REPO, r1.history_path)), "prior history retained");
  assert(existsSync(join(REPO, r2.history_path)), "new history written");

  // Deterministic: same fixtures → same score + recommendation kinds/order
  const r3 = planPortfolio({
    manifests: fixtures,
    persist: false,
    now: new Date("2026-07-21T11:00:00.000Z"),
  });
  assert(r3.coverage_score === r1.coverage_score, "deterministic score");
  assert(
    r3.recommendations.map((x) => x.kind).join(",") ===
      r1.recommendations.map((x) => x.kind).join(","),
    "deterministic recommendation kinds",
  );

  const emptyScore = computeCoverageScore({
    total: 0,
    category_matrix: {},
    seniority_matrix: {},
    industry_matrix: {},
    critic_blocked: 0,
  });
  assert(emptyScore.score === 0, "empty portfolio score 0");

  // Live registry analysis (read-only)
  const live = planPortfolio({ persist: true });
  assert(live.candidate_totals.total >= 1, "live registry analyzed");
  assert(typeof live.category_matrix.marketing === "number", "category matrix");

  const histFiles = existsSync(PORTFOLIO_HISTORY_ROOT)
    ? readdirSync(PORTFOLIO_HISTORY_ROOT).filter((f) => f.endsWith(".json"))
    : [];
  assert(histFiles.length >= 2, `history retained count=${histFiles.length}`);

  const src = readFileSync(PLANNER_SRC, "utf8");
  assert(!/from\s+["'].*openai/i.test(src), "no openai import");
  assert(!/runProduction\s*\(/.test(src), "no controller call");
  assert(!/runCanonicalBatch\s*\(/.test(src), "no batchrunner call");

  assert(
    existsSync(GUARD) && readFileSync(GUARD, "utf8").includes("ENGINES"),
    "runtime guard",
  );
  assert(existsSync(join(PORTFOLIO_LOG_ROOT, "portfolio-report.json")), "latest report");

  const checks = {
    registry_analyzed: true,
    coverage_calculated: true,
    recommendations_generated: true,
    historical_reports_retained: true,
    deterministic_output: true,
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
        agent: "215",
        overall: overall ? "PASS" : "FAIL",
        checks,
        fixture_score: r1.coverage_score,
        live_total: live.candidate_totals.total,
        live_score: live.coverage_score,
        recommendations: r1.recommendations.length,
        history_files: histFiles.length,
      },
      null,
      2,
    )}\n`,
  );

  console.log("Canonical Portfolio Intelligence Verify");
  console.log("======================================");
  for (const [k, v] of Object.entries(checks)) {
    console.log(`${v ? "✔" : "✘"} ${k}`);
  }
  console.log(
    `Fixture score=${r1.coverage_score} · live total=${live.candidate_totals.total} · recs=${r1.recommendations.length}`,
  );
  console.log(`Overall: ${overall ? "PASS" : "FAIL"}`);
  if (!overall) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
