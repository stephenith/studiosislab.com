/**
 * CostLedger — sole financial authority scaffold (Agent #181).
 * Bookkeeping contracts only. Never bills. Never executes.
 *
 * Ownership (declared, not wired):
 * - Execution Controller owns Cost Sessions (future)
 * - Company Brain proposes budgets (future)
 * - Departments receive budgets (future via Department SDK — not modified)
 * - Workers consume / Providers report (future)
 */
import { resolve } from "node:path";
import { BudgetRepository } from "./BudgetRepository.js";
import { BudgetReporter } from "./BudgetReporter.js";
import { CostEstimator, createCostEstimator } from "./CostEstimator.js";
import { createBudget } from "./Budget.js";
import { createCostSession } from "./BudgetSession.js";
import type {
  BudgetContract,
  BudgetKind,
  BudgetSummary,
  CostSessionContract,
} from "./CostLedgerTypes.js";
import type { CostEstimateResult } from "./CostLedgerTypes.js";

function resolveRepoRoot(fromDir = import.meta.dirname): string {
  return resolve(fromDir, "../../../..");
}

export class CostLedger {
  readonly repository: BudgetRepository;
  readonly reporter: BudgetReporter;
  readonly estimator: CostEstimator;
  readonly root: string;
  private seeded = false;

  constructor(repoRoot?: string, opts?: { fixture?: boolean }) {
    this.root = repoRoot ?? resolveRepoRoot();
    this.repository = new BudgetRepository(this.root, opts);
    this.reporter = new BudgetReporter();
    this.estimator = createCostEstimator();
  }

  /**
   * Seed illustrative metadata budgets for all supported kinds.
   * Idempotent. No billing.
   */
  bootstrapCatalog(): { ok: boolean; registered: string[]; errors: string[] } {
    if (process.env.SOS_AIOS_LIVE === "1") {
      return { ok: false, registered: [], errors: ["LIVE must be OFF"] };
    }
    this.repository.loadPersisted();
    const registered: string[] = [];
    const errors: string[] = [];

    const kinds: Array<{ kind: BudgetKind; name: string; amount: number | null }> = [
      { kind: "mission", name: "Mission Budget", amount: null },
      { kind: "department", name: "Department Budget", amount: null },
      { kind: "execution", name: "Execution Budget", amount: null },
      { kind: "provider", name: "Provider Budget", amount: null },
      { kind: "worker", name: "Worker Budget", amount: null },
      { kind: "daily", name: "Daily Budget", amount: null },
      { kind: "monthly", name: "Monthly Budget", amount: null },
      { kind: "emergency_reserve", name: "Emergency Reserve", amount: null },
    ];

    for (const k of kinds) {
      const existing = this.repository
        .listBudgets()
        .find((b) => b.budget_kind === k.kind && b.notes.includes("catalog-seed"));
      if (existing) continue;

      const budget = createBudget({
        budget_kind: k.kind,
        budget_name: k.name,
        amount: k.amount,
        status: "CREATED",
        proposed_by: "company_brain",
        owned_by:
          k.kind === "department" ? "department" : "execution_controller",
        department_id: k.kind === "department" ? "resume" : null,
        mission_id: k.kind === "mission" ? "mission-placeholder" : null,
        execution_controller_id: "execution-controller-ref",
        hard_limit: null,
        soft_limit: null,
        warning_limit: null,
        reserve_limit: null,
        emergency_stop: false,
        notes: [
          "catalog-seed",
          "Informational only — Agent #181",
          "References Execution Controller / Department SDK — not wired",
        ],
        fixture: this.repository.fixture,
      });
      const r = this.repository.registerBudget(budget);
      if (r.ok) registered.push(budget.budget_id);
      else if (r.error) errors.push(r.error);
    }

    // Demo cost session (metadata)
    if (this.repository.listSessions().length === 0) {
      const missionBudget = this.repository
        .listBudgets()
        .find((b) => b.budget_kind === "mission");
      const session = createCostSession({
        mission_id: "mission-placeholder",
        department_id: "resume",
        execution_controller_id: "execution-controller-ref",
        estimated_cost: null,
        approved_budget: null,
        remaining_budget: null,
        reserved_budget: null,
        provider_estimates: [
          {
            provider_id: "provider-placeholder",
            estimated_cost: null,
            unit: "unknown",
            calculated: false,
          },
        ],
        worker_estimates: [
          {
            worker_id: "resume.worker.production",
            estimated_cost: null,
            calculated: false,
          },
        ],
        status: "OPEN",
        budget_ids: missionBudget ? [missionBudget.budget_id] : [],
        budget_checksum: missionBudget?.checksums.budget_checksum ?? null,
        controller_ref_checksum: null,
        notes: [
          "Demo cost-session-1.0.0 · Execution Controller owns sessions (future)",
          "No billing · no providers · no execution",
        ],
        fixture: this.repository.fixture,
      });
      const sr = this.repository.registerSession(session);
      if (!sr.ok && sr.error) errors.push(sr.error);
      else registered.push(session.session_id);
    }

    this.reporter.writeMarkdown(this.repository);
    this.seeded = true;
    return { ok: errors.length === 0, registered, errors };
  }

  ensureBootstrapped(): void {
    if (this.seeded) return;
    this.repository.loadPersisted();
    if (
      this.repository.listBudgets().length === 0 &&
      this.repository.listSessions().length === 0
    ) {
      this.bootstrapCatalog();
    } else {
      this.seeded = true;
      this.repository.persist();
    }
  }

  registerBudget(budget: BudgetContract) {
    return this.repository.registerBudget(budget);
  }

  loadBudget(budgetId: string) {
    this.ensureBootstrapped();
    return this.repository.loadBudget(budgetId);
  }

  validateBudget(budgetId: string) {
    return this.repository.validateBudget(budgetId);
  }

  listBudgets(): BudgetSummary[] {
    this.ensureBootstrapped();
    return this.repository.discoverBudgets();
  }

  findBudget(budgetId: string) {
    this.ensureBootstrapped();
    return this.repository.findBudget(budgetId);
  }

  loadSession(sessionId: string): CostSessionContract | null {
    this.ensureBootstrapped();
    return this.repository.loadSession(sessionId);
  }

  listSessions(): CostSessionContract[] {
    this.ensureBootstrapped();
    return this.repository.listSessions();
  }

  estimateMission(missionId: string): CostEstimateResult {
    return this.estimator.estimateMission(missionId);
  }

  estimateDepartment(departmentId: string): CostEstimateResult {
    return this.estimator.estimateDepartment(departmentId);
  }

  estimateWorker(workerId: string): CostEstimateResult {
    return this.estimator.estimateWorker(workerId);
  }

  estimateProvider(providerId: string): CostEstimateResult {
    return this.estimator.estimateProvider(providerId);
  }

  estimateExecution(executionRef: string): CostEstimateResult {
    return this.estimator.estimateExecution(executionRef);
  }
}

export function createCostLedger(
  repoRoot?: string,
  opts?: { fixture?: boolean },
): CostLedger {
  return new CostLedger(repoRoot, opts);
}
