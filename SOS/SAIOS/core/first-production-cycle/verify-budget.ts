/**
 * Canonical Resource & Budget Governor verify — Agent #218.
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
import { countFounderReviewWaiting } from "../founder-review/FounderReviewProjection.js";
import { runProduction } from "./ProductionController.js";
import {
  BUDGET_HISTORY_ROOT,
  BUDGET_REPORT_PATH,
  DEFAULT_BUDGET_POLICY,
  evaluateResourceBudget,
  mergeBudgetPolicy,
} from "./ResourceBudgetGovernor.js";

const REPO = resolve(import.meta.dirname, "../../../..");
const OUT = join(CYCLE_LOG, "budget-verify.json");
const GUARD = join(REPO, "SOS/SAIOS/architecture/runtime-guard.ts");
const GOV_SRC = join(import.meta.dirname, "ResourceBudgetGovernor.ts");
const CTRL_SRC = join(import.meta.dirname, "ProductionController.ts");

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

  const waiting = countFounderReviewWaiting(REPO);
  const queueMax = Math.max(waiting + 10, 50);

  // 1. Policy loads with defaults
  const policy = mergeBudgetPolicy();
  assert(
    policy.maximum_daily_cycles === DEFAULT_BUDGET_POLICY.maximum_daily_cycles,
    "default daily cycles",
  );
  assert(
    policy.openai_budget_mode === "registry_only",
    "openai_budget_mode",
  );

  // 2. ALLOW path
  const allow = evaluateResourceBudget({
    proposed_batch_size: 1,
    policy: { maximum_founder_queue: queueMax },
    persist: true,
  });
  assert(allow.decision === "ALLOW", `expected ALLOW got ${allow.decision}: ${allow.violations.map((v) => v.code).join(",")}`);
  assert(allow.publication_allowed === false, "publication");
  assert(allow.openai_called === false, "no openai");
  assert(allow.production_triggered === false, "no production");
  assert(existsSync(BUDGET_REPORT_PATH), "budget-governor-report.json");
  assert(existsSync(join(REPO, allow.history_path)), "history file");

  const histBefore = existsSync(BUDGET_HISTORY_ROOT)
    ? readdirSync(BUDGET_HISTORY_ROOT).filter((f) => f.endsWith(".json")).length
    : 0;

  // 3. DENY path — daily cycles
  const deny = evaluateResourceBudget({
    proposed_batch_size: 1,
    policy: { maximum_founder_queue: queueMax, maximum_daily_cycles: 0 },
    persist: true,
    simulate: { daily_cycles: 1 },
  });
  assert(deny.decision === "DENY", "deny daily cycles");
  assert(
    deny.violations.some((v) => v.code === "maximum_daily_cycles"),
    "daily_cycles violation",
  );

  // DENY — batch size
  const denyBatch = evaluateResourceBudget({
    proposed_batch_size: 99,
    policy: { maximum_founder_queue: queueMax, maximum_batch_size: 5 },
    persist: true,
  });
  assert(denyBatch.decision === "DENY", "deny batch size");
  assert(
    denyBatch.violations.some((v) => v.code === "maximum_batch_size"),
    "batch_size violation",
  );

  // DENY — disk
  const denyDisk = evaluateResourceBudget({
    proposed_batch_size: 1,
    policy: {
      maximum_founder_queue: queueMax,
      minimum_disk_free_percent: 50,
    },
    persist: true,
    simulate: { disk_free_percent: 5 },
  });
  assert(denyDisk.decision === "DENY", "deny disk");
  assert(
    denyDisk.violations.some((v) => v.code === "minimum_disk_free_percent"),
    "disk violation",
  );

  const histAfter = existsSync(BUDGET_HISTORY_ROOT)
    ? readdirSync(BUDGET_HISTORY_ROOT).filter((f) => f.endsWith(".json")).length
    : 0;
  assert(histAfter > histBefore, `history retained ${histBefore}→${histAfter}`);

  // 4. Controller integration — budget DENY blocks BatchRunner
  const blocked = await runProduction({
    verification: true,
    verification_context: "aios-verify",
    batch_size: 1,
    queue_max: queueMax,
    force_mock: true,
    budget_simulate: { daily_cycles: 999 },
    budget_policy: { maximum_daily_cycles: 1 },
  });
  assert(blocked.stop_reason === "budget_denied", `stop=${blocked.stop_reason}`);
  assert(blocked.batch === null, "no batch when budget denied");
  assert(blocked.budget?.decision === "DENY", "budget DENY on result");
  assert(blocked.candidate_count === 0, "no candidates");
  assert(existsSync(join(REPO, blocked.report_path)), "execution report");

  // 5. Controller ALLOW still reaches batch
  const stamp = Date.now();
  const allowed = await runProduction({
    verification: true,
    verification_context: "aios-verify",
    batch_size: 1,
    queue_max: queueMax,
    force_mock: true,
    select_target: false,
    forced_targets: [
      {
        category: "creative",
        title: "Budget Verify Role",
        industry: "creative",
        seniority: "mid",
        objective: `budget-verify-allow-${stamp}`,
        role_family: "budget_verify_allow",
      },
    ],
  });
  assert(allowed.health.status === "HEALTHY", "healthy");
  assert(allowed.budget?.decision === "ALLOW", "budget allow");
  assert(allowed.batch !== null, "batch ran after allow");

  const govSrc = readFileSync(GOV_SRC, "utf8");
  const ctrlSrc = readFileSync(CTRL_SRC, "utf8");
  assert(!/from\s+["'].*openai/i.test(govSrc), "no openai import in governor");
  assert(!/api\.openai/i.test(govSrc), "no openai api in governor");
  assert(/evaluateResourceBudget/.test(ctrlSrc), "controller calls governor");
  assert(
    /Health Gate → Budget Governor|Budget Governor/.test(ctrlSrc),
    "controller documents budget step",
  );
  assert(
    existsSync(GUARD) && readFileSync(GUARD, "utf8").includes("ENGINES"),
    "runtime guard",
  );

  const checks = {
    policy_loaded: true,
    allow_path: true,
    deny_path: true,
    controller_integration: true,
    execution_blocked_when_denied: true,
    report_written: true,
    history_retained: true,
    no_openai_calls: true,
    publication_disabled: true,
    runtime_guard: true,
  };

  const overall = Object.values(checks).every(Boolean);
  writeFileSync(
    OUT,
    `${JSON.stringify(
      {
        generated_at: new Date().toISOString(),
        agent: "218",
        overall: overall ? "PASS" : "FAIL",
        checks,
        allow_decision: allow.decision,
        deny_codes: deny.violations.map((v) => v.code),
        blocked_execution_id: blocked.execution_id,
        allowed_execution_id: allowed.execution_id,
        history_files: histAfter,
      },
      null,
      2,
    )}\n`,
  );

  console.log("Canonical Resource & Budget Governor Verify");
  console.log("==========================================");
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
