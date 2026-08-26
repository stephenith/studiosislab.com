/**
 * Canonical Operational Policy Advisor verify — Agent #221.
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
  OPERATIONAL_POLICY_ADVICE_PATH,
  ADVISOR_HISTORY_ROOT,
  adviceFingerprint,
  buildOperationalPolicyAdvice,
} from "./OperationalPolicyAdvisor.js";

const REPO = resolve(import.meta.dirname, "../../../..");
const OUT = join(CYCLE_LOG, "advisor-verify.json");
const GUARD = join(REPO, "SOS/SAIOS/architecture/runtime-guard.ts");
const ADV_SRC = join(import.meta.dirname, "OperationalPolicyAdvisor.ts");

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(msg);
}

function forceMock(): void {
  delete process.env.SOS_AI_FOUNDER_OPENAI_ONE_TEST;
  delete process.env.OPENAI_API_KEY;
  delete process.env.SOS_OPENAI_API_KEY;
  process.env.SOS_AIOS_LIVE = "0";
}

function writeJson(path: string, data: unknown): void {
  mkdirSync(resolve(path, ".."), { recursive: true });
  writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

async function main(): Promise<void> {
  forceMock();
  mkdirSync(CYCLE_LOG, { recursive: true });
  const now = new Date("2026-07-21T15:00:00.000Z");

  // Live aggregation (may have sparse history — still must succeed)
  const live = buildOperationalPolicyAdvice({ persist: true, now });
  assert(existsSync(OPERATIONAL_POLICY_ADVICE_PATH), "advice report written");
  assert(existsSync(join(REPO, live.report_path)), "report path");
  assert(existsSync(join(REPO, live.history_path)), "history path");
  assert(live.advisory_only === true, "advisory_only");
  assert(live.policies_modified === false, "no policy mod");
  assert(live.scheduling_modified === false, "no schedule mod");
  assert(live.budget_modified === false, "no budget mod");
  assert(live.strategy_modified === false, "no strategy mod");
  assert(live.production_triggered === false, "no production");
  assert(live.openai_called === false, "no openai");
  assert(live.publication_allowed === false, "no publication");
  assert(live.live === false, "LIVE off");
  assert(Array.isArray(live.recommendations), "recs array");
  assert(typeof live.analysis.average_production_per_day === "number", "metrics");

  // Deterministic fingerprint
  const live2 = buildOperationalPolicyAdvice({ persist: true, now });
  assert(
    adviceFingerprint(live) === adviceFingerprint(live2),
    "deterministic",
  );

  // Fixture with rich history → recommendations
  const root = mkdtempSync(join(tmpdir(), "aios-advisor-"));
  mkdirSync(join(root, "budget", "history"), { recursive: true });
  mkdirSync(join(root, "scheduling", "history"), { recursive: true });
  mkdirSync(join(root, "portfolio", "history"), { recursive: true });
  mkdirSync(join(root, "operations-dashboard", "history"), { recursive: true });
  mkdirSync(join(root, "executions", "exec-20260721-001"), { recursive: true });
  mkdirSync(join(root, "executions", "exec-20260721-002"), { recursive: true });
  mkdirSync(join(root, "executions", "exec-20260721-003"), { recursive: true });
  mkdirSync(join(root, "executions", "exec-20260721-004"), { recursive: true });

  writeJson(join(root, "budget", "history", "b1.json"), {
    decision: "DENY",
    timestamp: "2026-07-21T10:00:00.000Z",
  });
  writeJson(join(root, "budget", "history", "b2.json"), {
    decision: "DENY",
    timestamp: "2026-07-21T11:00:00.000Z",
  });
  writeJson(join(root, "budget", "history", "b3.json"), {
    decision: "ALLOW",
    timestamp: "2026-07-21T12:00:00.000Z",
  });

  writeJson(join(root, "executions", "exec-20260721-001", "execution-report.json"), {
    execution_id: "exec-20260721-001",
    stop_reason: "budget_denied",
    finished_at: "2026-07-21T10:01:00.000Z",
    candidate_count: 0,
  });
  writeJson(join(root, "executions", "exec and-20260721-002", "execution-report.json"), {
    // wrong path intentionally skipped
  });
  writeJson(join(root, "executions", "exec-20260721-002", "execution-report.json"), {
    execution_id: "exec-20260721-002",
    stop_reason: "health_unhealthy",
    finished_at: "2026-07-21T10:30:00.000Z",
    candidate_count: 0,
  });
  writeJson(join(root, "executions", "exec-20260721-003", "execution-report.json"), {
    execution_id: "exec-20260721-003",
    stop_reason: "completed",
    finished_at: "2026-07-21T11:00:00.000Z",
    candidate_count: 1,
  });
  writeJson(join(root, "executions", "exec-20260721-004", "execution-report.json"), {
    execution_id: "exec-20260721-004",
    stop_reason: "budget_denied",
    finished_at: "2026-07-21T11:30:00.000Z",
    candidate_count: 0,
  });

  writeJson(join(root, "health-report.json"), {
    status: "HEALTHY",
    queue_waiting: 18,
    queue_max: 20,
  });

  writeJson(join(root, "portfolio", "history", "p1.json"), {
    coverage_score: 40,
    generated_at: "2026-07-20T00:00:00.000Z",
  });
  writeJson(join(root, "portfolio", "history", "p2.json"), {
    coverage_score: 55,
    generated_at: "2026-07-21T00:00:00.000Z",
  });

  writeJson(join(root, "scheduling", "history", "s1.json"), {
    decision: "PAUSE",
  });
  writeJson(join(root, "scheduling", "history", "s2.json"), {
    decision: "PAUSE",
  });
  writeJson(join(root, "scheduling", "history", "s3.json"), {
    decision: "NORMAL",
  });

  writeJson(
    join(root, "operations-dashboard", "operations-dashboard.json"),
    {
      generated_at: "2026-07-21T14:00:00.000Z",
      portfolio_score: 55,
      founder_queue: { waiting: 18 },
      system_health: { queue_waiting: 18, queue_max: 20, status: "HEALTHY" },
    },
  );

  const fixture = buildOperationalPolicyAdvice({
    cycleLog: root,
    persist: true,
    now,
  });
  assert(fixture.sources.some((s) => s.records > 0), "historical data loaded");
  assert(fixture.recommendation_count >= 1, "recommendations produced");
  assert(
    fixture.recommendations.every(
      (r) =>
        r.recommendation_id &&
        r.severity &&
        typeof r.confidence === "number" &&
        r.supporting_metrics &&
        r.expected_effect &&
        r.affected_policy &&
        r.reason,
    ),
    "recommendation model fields",
  );
  assert(
    fixture.recommendations.some((r) =>
      r.recommendation_id.includes("daily-cycle") ||
      r.recommendation_id.includes("founder-queue") ||
      r.recommendation_id.includes("portfolio") ||
      r.recommendation_id.includes("minimum-interval") ||
      r.recommendation_id.includes("cooldown") ||
      r.recommendation_id.includes("batch"),
    ),
    "expected recommendation families",
  );

  // No mutation of upstream policy files
  assert(
    !existsSync(join(root, "scheduling", "schedule-state.json")),
    "did not write schedule-state",
  );
  assert(
    !existsSync(join(root, "budget", "budget-governor-report.json")),
    "did not write budget report",
  );
  assert(
    existsSync(join(root, "advisor", "operational-policy-advice.json")),
    "advisor report only",
  );

  const empty = buildOperationalPolicyAdvice({
    cycleLog: mkdtempSync(join(tmpdir(), "aios-adv-empty-")),
    persist: true,
    now,
  });
  assert(empty.recommendation_count >= 0, "empty safe");
  assert(empty.production_triggered === false, "empty no production");

  const histBefore = existsSync(ADVISOR_HISTORY_ROOT)
    ? readdirSync(ADVISOR_HISTORY_ROOT).filter((f) => f.endsWith(".json")).length
    : 0;
  buildOperationalPolicyAdvice({ persist: true, now: new Date() });
  const histAfter = existsSync(ADVISOR_HISTORY_ROOT)
    ? readdirSync(ADVISOR_HISTORY_ROOT).filter((f) => f.endsWith(".json")).length
    : 0;
  assert(histAfter >= histBefore, "history retained");

  const src = readFileSync(ADV_SRC, "utf8");
  assert(!/from\s+["'].*openai/i.test(src), "no openai");
  assert(!/runProduction\s*\(/.test(src), "no controller");
  assert(!/runCanonicalBatch\s*\(/.test(src), "no batch");
  assert(!/evaluateAdaptiveSchedule\s*\(/.test(src), "no schedule eval");
  assert(!/evaluateResourceBudget\s*\(/.test(src), "no budget eval");
  assert(!/planPortfolio\s*\(/.test(src), "no portfolio plan");
  assert(
    existsSync(GUARD) && readFileSync(GUARD, "utf8").includes("ENGINES"),
    "runtime guard",
  );

  const checks = {
    historical_data_loaded: true,
    deterministic_recommendations: true,
    no_policy_modification: true,
    no_production: true,
    no_openai_calls: true,
    publication_disabled: true,
    runtime_guard: true,
    advice_report_written: true,
    history_retained: histAfter >= 1,
  };

  const overall = Object.values(checks).every(Boolean);
  writeFileSync(
    OUT,
    `${JSON.stringify(
      {
        generated_at: new Date().toISOString(),
        agent: "221",
        overall: overall ? "PASS" : "FAIL",
        checks,
        live_recommendation_count: live.recommendation_count,
        fixture_recommendation_count: fixture.recommendation_count,
        fixture_ids: fixture.recommendations.map((r) => r.recommendation_id),
      },
      null,
      2,
    )}\n`,
  );

  console.log("Canonical Operational Policy Advisor Verify");
  console.log("==========================================");
  for (const [k, v] of Object.entries(checks)) {
    console.log(`${v ? "✔" : "✘"} ${k}`);
  }
  console.log(
    `live_recs=${live.recommendation_count} fixture_recs=${fixture.recommendation_count}`,
  );
  console.log(`Overall: ${overall ? "PASS" : "FAIL"}`);
  if (!overall) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
