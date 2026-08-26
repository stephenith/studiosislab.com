/**
 * Canonical Operations Dashboard verify — Agent #219.
 */
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { CYCLE_LOG } from "./runFirstProductionCycle.js";
import {
  OPERATIONS_DASHBOARD_PATH,
  DASHBOARD_HISTORY_ROOT,
  buildOperationsDashboard,
  dashboardFingerprint,
} from "./OperationsDashboard.js";

const REPO = resolve(import.meta.dirname, "../../../..");
const OUT = join(CYCLE_LOG, "operations-dashboard-verify.json");
const GUARD = join(REPO, "SOS/SAIOS/architecture/runtime-guard.ts");
const DASH_SRC = join(import.meta.dirname, "OperationsDashboard.ts");

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(msg);
}

function forceMock(): void {
  delete process.env.SOS_AI_FOUNDER_OPENAI_ONE_TEST;
  delete process.env.OPENAI_API_KEY;
  delete process.env.SOS_OPENAI_API_KEY;
  process.env.SOS_AIOS_LIVE = "0";
}

async function main(): Promise<void> {
  forceMock();
  mkdirSync(CYCLE_LOG, { recursive: true });

  const now = new Date("2026-07-21T12:00:00.000Z");

  // 1. Generate dashboard from live reports
  const a = buildOperationsDashboard({ persist: true, now });
  assert(existsSync(OPERATIONS_DASHBOARD_PATH), "operations-dashboard.json");
  assert(existsSync(join(REPO, a.report_path)), "report path exists");
  assert(existsSync(join(REPO, a.history_path)), "history written");
  assert(a.read_only === true, "read_only");
  assert(a.publication_allowed === false, "publication");
  assert(a.openai_called === false, "no openai");
  assert(a.production_triggered === false, "no production");
  assert(typeof a.today_cycles === "number", "today_cycles");
  assert(typeof a.today_candidates === "number", "today_candidates");
  assert(a.candidate_totals.total >= 0, "candidate totals");
  assert(Array.isArray(a.trends.daily_production), "trends");
  assert(a.trends.window_days === 7, "trend window");

  // Required metric fields present
  for (const key of [
    "system_health",
    "autonomous_status",
    "budget_status",
    "portfolio_score",
    "strategy_version",
    "founder_queue",
    "last_execution",
    "last_failure",
    "active_policy_versions",
  ] as const) {
    assert(key in a, `field ${key}`);
  }

  // 2. Deterministic fingerprint (same now)
  const b = buildOperationsDashboard({ persist: true, now });
  assert(
    dashboardFingerprint(a) === dashboardFingerprint(b),
    "deterministic fingerprint",
  );

  const histBefore = existsSync(DASHBOARD_HISTORY_ROOT)
    ? readdirSync(DASHBOARD_HISTORY_ROOT).filter((f) => f.endsWith(".json"))
        .length
    : 0;

  // 3. Missing reports handled gracefully
  const emptyRoot = mkdtempSync(join(tmpdir(), "aios-dash-"));
  const empty = buildOperationsDashboard({
    cycleLog: emptyRoot,
    persist: true,
    now,
  });
  assert(empty.system_health.available === false, "missing health graceful");
  assert(empty.budget_status.available === false, "missing budget graceful");
  assert(empty.portfolio_score === null, "missing portfolio null");
  assert(empty.strategy_version === null, "missing strategy null");
  assert(empty.today_cycles === 0, "empty cycles");
  assert(empty.candidate_totals.total === 0, "empty candidates");
  assert(empty.missing_sources.length >= 3, "missing_sources listed");
  assert(
    existsSync(join(emptyRoot, "operations-dashboard.json")),
    "empty still writes dashboard only",
  );
  // Must not invent upstream reports
  assert(!existsSync(join(emptyRoot, "health-report.json")), "no health write");
  assert(
    !existsSync(join(emptyRoot, "budget-governor-report.json")),
    "no budget write",
  );

  buildOperationsDashboard({ persist: true, now: new Date() });
  const histAfter = existsSync(DASHBOARD_HISTORY_ROOT)
    ? readdirSync(DASHBOARD_HISTORY_ROOT).filter((f) => f.endsWith(".json"))
        .length
    : 0;
  assert(histAfter >= histBefore, "history retained");

  const src = readFileSync(DASH_SRC, "utf8");
  assert(!/from\s+["'].*openai/i.test(src), "no openai import");
  assert(!/runProduction\s*\(/.test(src), "no controller");
  assert(!/runCanonicalBatch\s*\(/.test(src), "no batch");
  assert(!/planPortfolio\s*\(/.test(src), "no portfolio planner call");
  assert(!/buildProductionStrategy\s*\(/.test(src), "no strategy engine call");
  assert(!/evaluateResourceBudget\s*\(/.test(src), "no budget evaluate call");
  assert(!/evaluateProductionHealth\s*\(/.test(src), "no health evaluate call");
  assert(
    existsSync(GUARD) && readFileSync(GUARD, "utf8").includes("ENGINES"),
    "runtime guard",
  );

  const checks = {
    dashboard_generated: true,
    reports_aggregated: a.sources.some((s) => s.available),
    missing_reports_graceful: true,
    read_only_operation: true,
    deterministic_output: true,
    no_production: true,
    no_openai_calls: true,
    publication_disabled: true,
    runtime_guard: true,
    history_retained: histAfter >= 1,
  };

  const overall = Object.values(checks).every(Boolean);
  writeFileSync(
    OUT,
    `${JSON.stringify(
      {
        generated_at: new Date().toISOString(),
        agent: "219",
        overall: overall ? "PASS" : "FAIL",
        checks,
        today_cycles: a.today_cycles,
        today_candidates: a.today_candidates,
        portfolio_score: a.portfolio_score,
        missing_sources: a.missing_sources,
        report_path: a.report_path,
      },
      null,
      2,
    )}\n`,
  );

  console.log("Canonical Operations Dashboard Verify");
  console.log("====================================");
  for (const [k, v] of Object.entries(checks)) {
    console.log(`${v ? "✔" : "✘"} ${k}`);
  }
  console.log(
    `cycles=${a.today_cycles} candidates=${a.today_candidates} score=${a.portfolio_score} missing=${a.missing_sources.join(",") || "—"}`,
  );
  console.log(`Overall: ${overall ? "PASS" : "FAIL"}`);
  if (!overall) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
