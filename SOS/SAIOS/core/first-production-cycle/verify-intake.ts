/**
 * Strategy-driven Production Intake verify — Agent #217.
 * Valid strategy → targets + metadata; missing/malformed/empty → fallback.
 * No OpenAI. No publication. Runtime Guard unchanged.
 */
import {
  existsSync,
  mkdirSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";
import { CYCLE_LOG } from "./runFirstProductionCycle.js";
import {
  selectNextProductionTarget,
  selectNextProductionTargetFromCoverage,
} from "./selectProductionTarget.js";
import {
  STRATEGY_INTAKE_REPORT_PATH,
  consumeStrategyRecommendation,
  validateProductionStrategy,
} from "./StrategyIntake.js";

const REPO = resolve(import.meta.dirname, "../../../..");
const OUT = join(CYCLE_LOG, "intake-verify.json");
const FIXTURE_DIR = join(CYCLE_LOG, "intake-verify-fixtures");
const GUARD = join(REPO, "SOS/SAIOS/architecture/runtime-guard.ts");
const INTAKE_SRC = join(import.meta.dirname, "StrategyIntake.ts");
const SELECT_SRC = join(import.meta.dirname, "selectProductionTarget.ts");

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(msg);
}

function writeFixture(name: string, data: unknown): string {
  mkdirSync(FIXTURE_DIR, { recursive: true });
  const path = join(FIXTURE_DIR, name);
  writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  return path;
}

async function main(): Promise<void> {
  delete process.env.OPENAI_API_KEY;
  process.env.SOS_AIOS_LIVE = "0";
  mkdirSync(CYCLE_LOG, { recursive: true });

  const validStrategy = {
    schema_version: 1,
    strategy_version: 1,
    generated_at: "2026-07-21T12:00:00.000Z",
    portfolio_score: 42,
    recommendations: [
      {
        priority: 1,
        goal_id: "strategy-missing-healthcare",
        target: {
          category: "healthcare",
          title: "Clinical Nurse Manager",
          industry: "healthcare",
          seniority: "senior",
          objective: "Healthcare healthcare resume with ATS compliance",
          role_family: "clinical_nurse_manager",
        },
        reason: "Missing category coverage for healthcare",
        confidence: 0.9,
        source: "portfolio:missing_category",
        estimated_coverage_gain: 12,
        kind: "missing_category",
      },
      {
        priority: 2,
        goal_id: "strategy-null-industry",
        target: null,
        reason: "Industry gap without mappable seed",
        confidence: 0.5,
        source: "portfolio:underrepresented_industry",
        estimated_coverage_gain: 4,
        kind: "underrepresented_industry",
      },
    ],
    recommendation_count: 2,
    publication_allowed: false,
    live: false,
    openai_called: false,
    production_triggered: false,
  };

  const validPath = writeFixture("valid-strategy.json", validStrategy);
  const malformedPath = writeFixture("malformed-strategy.json", {
    strategy_version: 99,
    generated_at: "2026-07-21T12:00:00.000Z",
    recommendations: "not-an-array",
  });
  const emptyPath = writeFixture("empty-strategy.json", {
    schema_version: 1,
    strategy_version: 1,
    generated_at: "2026-07-21T12:00:00.000Z",
    recommendations: [],
    recommendation_count: 0,
  });
  const missingPath = join(FIXTURE_DIR, "does-not-exist.json");
  if (existsSync(missingPath)) unlinkSync(missingPath);

  // 1) Valid strategy consumed → ProductionTarget + metadata
  const consumed = consumeStrategyRecommendation({
    strategyPath: validPath,
    respectWaitingFounder: false,
    persist: true,
    reportPath: join(FIXTURE_DIR, "report-valid.json"),
  });
  assert(consumed !== null, "valid strategy must yield target");
  assert(consumed!.target.category === "healthcare", "priority-1 category");
  assert(consumed!.target.goal_id === "strategy-missing-healthcare", "goal_id");
  assert(consumed!.target.strategy_version === 1, "strategy_version");
  assert(consumed!.target.priority === 1, "priority");
  assert(
    typeof consumed!.target.strategy_reason === "string" &&
      consumed!.target.strategy_reason.length > 0,
    "strategy_reason",
  );
  assert(
    typeof consumed!.target.strategy_source === "string" &&
      consumed!.target.strategy_source.length > 0,
    "strategy_source",
  );
  assert(consumed!.report.strategy_consumed === true, "report consumed");
  assert(consumed!.report.fallback_used === false, "no fallback");
  assert(consumed!.report.recommendations_used === 1, "used=1");
  assert(consumed!.report.recommendations_skipped === 0, "skipped before use");

  const viaSelect = selectNextProductionTarget(undefined, {
    strategyPath: validPath,
    persist_intake_report: true,
    respectWaitingFounder: false,
  });
  assert(viaSelect.category === "healthcare", "select consumes strategy");
  assert(viaSelect.goal_id === "strategy-missing-healthcare", "select metadata");

  // Force strategy select without waiting reservation via consume already checked.
  // Also verify select with disable_strategy still works.
  const coverageOnly = selectNextProductionTargetFromCoverage();
  assert(Boolean(coverageOnly.category), "coverage fallback target");

  // 2) Missing strategy → fallback
  const miss = consumeStrategyRecommendation({
    strategyPath: missingPath,
    persist: true,
    reportPath: join(FIXTURE_DIR, "report-missing.json"),
  });
  assert(miss === null, "missing strategy → null consume");
  const missReport = JSON.parse(
    readFileSync(join(FIXTURE_DIR, "report-missing.json"), "utf8"),
  ) as { fallback_used: boolean; fallback_reason: string };
  assert(missReport.fallback_used === true, "missing fallback");
  assert(missReport.fallback_reason === "strategy_missing", "missing reason");

  const missSelect = selectNextProductionTarget(undefined, {
    strategyPath: missingPath,
    persist_intake_report: true,
  });
  assert(Boolean(missSelect.category), "missing → coverage target");

  // 3) Malformed strategy → fallback
  const badValidate = validateProductionStrategy(
    JSON.parse(readFileSync(malformedPath, "utf8")),
  );
  assert(badValidate.ok === false, "malformed rejected");
  const malformed = consumeStrategyRecommendation({
    strategyPath: malformedPath,
    persist: true,
    reportPath: join(FIXTURE_DIR, "report-malformed.json"),
  });
  assert(malformed === null, "malformed → null");
  const malReport = JSON.parse(
    readFileSync(join(FIXTURE_DIR, "report-malformed.json"), "utf8"),
  ) as { fallback_used: boolean };
  assert(malReport.fallback_used === true, "malformed fallback");

  // 4) Empty strategy → fallback
  const empty = consumeStrategyRecommendation({
    strategyPath: emptyPath,
    persist: true,
    reportPath: join(FIXTURE_DIR, "report-empty.json"),
  });
  assert(empty === null, "empty → null");
  const emptyReport = JSON.parse(
    readFileSync(join(FIXTURE_DIR, "report-empty.json"), "utf8"),
  ) as { fallback_reason: string };
  assert(emptyReport.fallback_reason === "strategy_empty", "empty reason");

  // Valid strategy structure check
  const goodValidate = validateProductionStrategy(validStrategy);
  assert(goodValidate.ok === true, "valid strategy validates");

  const src = [readFileSync(INTAKE_SRC, "utf8"), readFileSync(SELECT_SRC, "utf8")].join(
    "\n",
  );
  assert(!/from\s+["'].*openai/i.test(src), "no openai import");
  assert(!/OPENAI_API_KEY/.test(src), "no openai key usage in intake");
  assert(!/publish/i.test(src) || !/publication_allowed:\s*true/.test(src), "no publish");
  assert(
    existsSync(GUARD) && readFileSync(GUARD, "utf8").includes("ENGINES"),
    "runtime guard",
  );

  // Default path should still produce a target (strategy file may or may not exist)
  const defaultSelect = selectNextProductionTarget(undefined, {
    persist_intake_report: true,
  });
  assert(Boolean(defaultSelect.category), "default select works");
  assert(existsSync(STRATEGY_INTAKE_REPORT_PATH), "intake report persisted");

  const checks = {
    valid_strategy_consumed: true,
    production_targets_created: true,
    strategy_metadata_propagated: true,
    fallback_missing: true,
    fallback_malformed: true,
    fallback_empty: true,
    no_openai_calls: true,
    no_publication: true,
    runtime_guard: true,
    intake_report_written: true,
  };

  const overall = Object.values(checks).every(Boolean);
  writeFileSync(
    OUT,
    `${JSON.stringify(
      {
        generated_at: new Date().toISOString(),
        agent: "217",
        overall: overall ? "PASS" : "FAIL",
        checks,
        sample_goal_id: consumed!.target.goal_id,
        coverage_category: coverageOnly.category,
        default_category: defaultSelect.category,
      },
      null,
      2,
    )}\n`,
  );

  console.log("Canonical Strategy-Driven Production Intake Verify");
  console.log("=================================================");
  for (const [k, v] of Object.entries(checks)) {
    console.log(`${v ? "✔" : "✘"} ${k}`);
  }
  console.log(`Overall: ${overall ? "PASS" : "FAIL"}`);
  if (!overall) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
