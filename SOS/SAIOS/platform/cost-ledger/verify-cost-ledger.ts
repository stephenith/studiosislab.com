#!/usr/bin/env tsx
/**
 * Cost Ledger V1 verify — Agent #181.
 * Fixtures only. Bookkeeping contracts only. Never bills. Never executes.
 */
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";
import { createCostLedger } from "./CostLedger.js";
import { createBudget, computeBudgetChecksum } from "./Budget.js";
import { createCostSession, computeSessionChecksum } from "./BudgetSession.js";
import {
  canBudgetLifecycleTransition,
  rejectForbiddenBudgetPayload,
  validateBudget,
  validateCostSession,
} from "./BudgetValidator.js";
import {
  BUDGET_CONTRACT_VERSION,
  COST_LEDGER_SCHEMA_VERSION,
  COST_SESSION_SCHEMA_VERSION,
} from "./CostLedgerTypes.js";

const REPO = resolve(import.meta.dirname, "../../../..");

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(msg);
}

function cleanFixtures(): void {
  const dir = join(REPO, "SOS/07_LOGS/saios/platform/cost-ledger/fixtures");
  if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, ".verify-run"), new Date().toISOString(), "utf8");
}

function main(): void {
  assert(process.env.SOS_AIOS_LIVE !== "1", "LIVE must be OFF");
  cleanFixtures();
  const checks: Record<string, boolean> = {};

  {
    assert(COST_LEDGER_SCHEMA_VERSION === "cost-ledger-1.0.0", "ledger ver");
    assert(COST_SESSION_SCHEMA_VERSION === "cost-session-1.0.0", "session ver");
    assert(BUDGET_CONTRACT_VERSION === "budget-contract-1.0.0", "budget ver");
    checks.contracts = true;
  }

  {
    const budget = createBudget({
      budget_kind: "mission",
      budget_name: "Test Mission Budget",
      amount: 100,
      status: "CREATED",
      mission_id: "m-1",
      fixture: true,
    });
    assert(budget.amount.informational === true, "informational");
    assert(budget.policy.enforcement_enabled === false, "no enforce");
    assert(budget.safety_flags.billing_allowed === false, "no billing");
    const expected = computeBudgetChecksum({
      ...budget,
      checksums: {
        parent_checksum: budget.checksums.parent_checksum,
        budget_checksum: "",
      },
    });
    assert(budget.checksums.budget_checksum === expected, "budget checksum");
    assert(validateBudget(budget).ok, "budget valid");

    const session = createCostSession({
      mission_id: "m-1",
      department_id: "resume",
      execution_controller_id: "xc-ref",
      estimated_cost: null,
      approved_budget: 100,
      budget_ids: [budget.budget_id],
      budget_checksum: budget.checksums.budget_checksum,
      provider_estimates: [
        {
          provider_id: "p1",
          estimated_cost: null,
          unit: "unknown",
          calculated: false,
        },
      ],
      worker_estimates: [
        { worker_id: "w1", estimated_cost: null, calculated: false },
      ],
      fixture: true,
    });
    assert(session.schema_version === "cost-session-1.0.0", "session schema");
    const sexpected = computeSessionChecksum({
      ...session,
      checksums: {
        session_checksum: "",
        budget_checksum: session.checksums.budget_checksum,
        controller_ref_checksum: session.checksums.controller_ref_checksum,
      },
    });
    assert(session.checksums.session_checksum === sexpected, "session checksum");
    assert(validateCostSession(session).ok, "session valid");
    checks.checksums = true;
    checks.metadata = true;
  }

  {
    assert(canBudgetLifecycleTransition("CREATED", "VALIDATED"), "c→v");
    assert(canBudgetLifecycleTransition("VALIDATED", "APPROVED"), "v→a");
    assert(canBudgetLifecycleTransition("APPROVED", "RESERVED"), "a→r");
    assert(canBudgetLifecycleTransition("RESERVED", "READY"), "r→ready");
    assert(canBudgetLifecycleTransition("READY", "CLOSED"), "ready→closed");
    assert(!canBudgetLifecycleTransition("CREATED", "READY"), "no skip");
    assert(!canBudgetLifecycleTransition("CLOSED", "CREATED"), "no reopen");
    checks.budget_lifecycle = true;
  }

  {
    const ledger = createCostLedger(REPO, { fixture: true });
    const boot = ledger.bootstrapCatalog();
    assert(boot.ok, `boot: ${boot.errors.join(";")}`);
    const budgets = ledger.listBudgets();
    assert(budgets.length === 8, `8 budget kinds, got ${budgets.length}`);
    const kinds = new Set(budgets.map((b) => b.budget_kind));
    for (const k of [
      "mission",
      "department",
      "execution",
      "provider",
      "worker",
      "daily",
      "monthly",
      "emergency_reserve",
    ]) {
      assert(kinds.has(k as never), `kind ${k}`);
    }
    assert(ledger.listSessions().length >= 1, "session");
    const v = ledger.validateBudget(budgets[0]!.budget_id);
    assert(v.ok, "validate");
    assert(ledger.findBudget(budgets[0]!.budget_id) != null, "find");
    assert(ledger.loadBudget(budgets[0]!.budget_id) != null, "load");

    const est = ledger.estimateMission("m-1");
    assert(est.calculated === false && est.placeholder === true, "est mission");
    assert(ledger.estimateDepartment("resume").placeholder === true, "est dept");
    assert(ledger.estimateWorker("w1").placeholder === true, "est worker");
    assert(ledger.estimateProvider("p1").placeholder === true, "est provider");
    assert(ledger.estimateExecution("xc").placeholder === true, "est exec");
    checks.registry = true;
  }

  {
    const forbidden = rejectForbiddenBudgetPayload({ bill: true });
    assert(forbidden?.code === "FORBIDDEN_SIDE_EFFECT", "forbidden");
    checks.forbidden = true;
  }

  {
    const ledger = createCostLedger(REPO, { fixture: true });
    ledger.bootstrapCatalog();
    assert(
      existsSync(
        join(REPO, "SOS/07_LOGS/saios/platform/cost-ledger/fixtures/budgets.json"),
      ),
      "budgets file",
    );
    assert(
      existsSync(
        join(
          REPO,
          "SOS/07_LOGS/saios/platform/cost-ledger/fixtures/COST_LEDGER_LOG.md",
        ),
      ),
      "log",
    );
    const reload = createCostLedger(REPO, { fixture: true });
    const n = reload.repository.loadPersisted();
    assert(n.budgets === 8, "reload budgets");
    assert(n.sessions >= 1, "reload sessions");
    checks.persistence = true;
  }

  {
    const plugin = readFileSync(
      join(REPO, "SOS/SAIOS/platform/dashboard/plugins/costLedger.ts"),
      "utf8",
    );
    assert(plugin.includes("/api/platform/cost-ledger"), "api list");
    assert(plugin.includes("/api/platform/cost-ledger/budgets"), "api budgets");
    assert(!plugin.includes('method: "POST"'), "no post");
    const view = readFileSync(
      join(REPO, "SOS/SAIOS/dashboard/src/views/CostLedgerView.tsx"),
      "utf8",
    );
    assert(view.includes("NO BILLING"), "banner billing");
    assert(view.includes("NO PROVIDERS"), "banner providers");
    assert(view.includes("NO EXECUTION"), "banner exec");
    assert(view.includes("LIVE OFF"), "banner live");
    checks.dashboard = true;
    checks.api = true;
  }

  {
    const src = readFileSync(
      join(REPO, "SOS/SAIOS/platform/cost-ledger/CostLedger.ts"),
      "utf8",
    );
    assert(!src.includes("QueueManager"), "no queue");
    assert(!src.includes("from \"../department-sdk"), "no sdk write");
    assert(!src.includes("execution-controller/"), "no xc write");
    assert(!/\.spawn\(/.test(src), "no spawn");
    checks.execution_impossible = true;
  }

  checks.live_off = process.env.SOS_AIOS_LIVE !== "1";

  const pass = Object.values(checks).every(Boolean);
  console.log(
    JSON.stringify(
      {
        pass,
        component: "cost-ledger-v1",
        checks,
        overall: pass ? "PASS" : "FAIL",
      },
      null,
      2,
    ),
  );
  if (!pass) process.exit(1);
}

main();
