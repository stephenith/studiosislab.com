/**
 * BudgetRepository — append-only budget + session persistence (Agent #181).
 * No runtime activation. No billing.
 */
import { join, resolve } from "node:path";
import { writeFileSync, mkdirSync, readFileSync, existsSync } from "node:fs";
import type {
  BudgetContract,
  BudgetLifecycleStatus,
  BudgetSummary,
  CostLedgerHealth,
  CostLedgerSnapshot,
  CostSessionContract,
} from "./CostLedgerTypes.js";
import { Budget } from "./Budget.js";
import {
  assertBudgetLifecycleTransition,
  validateBudget,
  validateCostSession,
} from "./BudgetValidator.js";
import {
  buildCostLedgerHealth,
  buildCostLedgerSnapshot,
} from "./CostSnapshot.js";

const LOG_REL = "SOS/07_LOGS/saios/platform/cost-ledger";

function resolveRepoRoot(fromDir = import.meta.dirname): string {
  return resolve(fromDir, "../../../..");
}

export class BudgetRepository {
  readonly root: string;
  readonly fixture: boolean;
  private readonly budgets = new Map<string, BudgetContract>();
  private readonly sessions = new Map<string, CostSessionContract>();

  constructor(repoRoot?: string, opts?: { fixture?: boolean }) {
    this.root = repoRoot ?? resolveRepoRoot();
    this.fixture = Boolean(opts?.fixture);
  }

  get dir(): string {
    const base = join(this.root, LOG_REL);
    return this.fixture ? join(base, "fixtures") : base;
  }

  ensureDir(): void {
    mkdirSync(this.dir, { recursive: true });
  }

  registerBudget(budget: BudgetContract): { ok: boolean; error?: string } {
    if (process.env.SOS_AIOS_LIVE === "1") {
      return { ok: false, error: "LIVE must be OFF" };
    }
    const v = validateBudget(budget);
    if (!v.ok) {
      return { ok: false, error: v.errors[0]?.message ?? "invalid budget" };
    }
    if (this.budgets.has(budget.budget_id)) {
      return {
        ok: false,
        error: `Budget already registered: ${budget.budget_id}`,
      };
    }
    this.budgets.set(budget.budget_id, budget);
    this.persist();
    return { ok: true };
  }

  loadBudget(budgetId: string): BudgetContract | null {
    return this.budgets.get(budgetId) ?? null;
  }

  findBudget(budgetId: string): BudgetContract | null {
    return this.loadBudget(budgetId);
  }

  listBudgets(): BudgetContract[] {
    return [...this.budgets.values()].sort((a, b) =>
      a.budget_id.localeCompare(b.budget_id),
    );
  }

  validateBudget(budgetId: string): {
    ok: boolean;
    errors: string[];
    status?: BudgetLifecycleStatus;
  } {
    const budget = this.budgets.get(budgetId);
    if (!budget) return { ok: false, errors: ["Budget not found"] };
    const result = validateBudget(budget);
    if (!result.ok) {
      return {
        ok: false,
        errors: result.errors.map((e) => e.message),
        status: budget.status,
      };
    }
    if (budget.status === "CREATED") {
      assertBudgetLifecycleTransition("CREATED", "VALIDATED");
      const next = new Budget(budget).withStatus("VALIDATED");
      this.budgets.set(budgetId, next.contract);
      this.persist();
    }
    return {
      ok: true,
      errors: [],
      status: this.budgets.get(budgetId)?.status,
    };
  }

  /** Advance along budget lifecycle (metadata only). */
  advanceBudget(
    budgetId: string,
    to: BudgetLifecycleStatus,
  ): { ok: boolean; error?: string; budget?: BudgetContract } {
    const budget = this.budgets.get(budgetId);
    if (!budget) return { ok: false, error: "Budget not found" };
    assertBudgetLifecycleTransition(budget.status, to);
    const next = new Budget(budget).withStatus(to);
    const v = validateBudget(next.contract);
    if (!v.ok) {
      return { ok: false, error: v.errors[0]?.message };
    }
    this.budgets.set(budgetId, next.contract);
    this.persist();
    return { ok: true, budget: next.contract };
  }

  registerSession(session: CostSessionContract): { ok: boolean; error?: string } {
    if (process.env.SOS_AIOS_LIVE === "1") {
      return { ok: false, error: "LIVE must be OFF" };
    }
    const v = validateCostSession(session);
    if (!v.ok) {
      return { ok: false, error: v.errors[0]?.message ?? "invalid session" };
    }
    if (this.sessions.has(session.session_id)) {
      return {
        ok: false,
        error: `Session already registered: ${session.session_id}`,
      };
    }
    this.sessions.set(session.session_id, session);
    this.persist();
    return { ok: true };
  }

  loadSession(sessionId: string): CostSessionContract | null {
    return this.sessions.get(sessionId) ?? null;
  }

  listSessions(): CostSessionContract[] {
    return [...this.sessions.values()].sort((a, b) =>
      a.session_id.localeCompare(b.session_id),
    );
  }

  discoverBudgets(): BudgetSummary[] {
    return this.listBudgets().map((b) => ({
      budget_id: b.budget_id,
      budget_kind: b.budget_kind,
      budget_name: b.budget_name,
      status: b.status,
      mission_id: b.mission_id,
      department_id: b.department_id,
      amount: b.amount.amount,
      remaining: b.remaining.amount,
      validation_ok: validateBudget(b).ok,
    }));
  }

  persist(): void {
    this.ensureDir();
    writeFileSync(
      join(this.dir, "budgets.json"),
      JSON.stringify(this.listBudgets(), null, 2),
      "utf8",
    );
    writeFileSync(
      join(this.dir, "cost-sessions.json"),
      JSON.stringify(this.listSessions(), null, 2),
      "utf8",
    );
    writeFileSync(
      join(this.dir, "latest-cost-ledger-snapshot.json"),
      JSON.stringify(this.buildSnapshot(), null, 2),
      "utf8",
    );
    writeFileSync(
      join(this.dir, "cost-ledger-health.json"),
      JSON.stringify(this.buildHealth(), null, 2),
      "utf8",
    );
  }

  loadPersisted(): { budgets: number; sessions: number } {
    const bPath = join(this.dir, "budgets.json");
    const sPath = join(this.dir, "cost-sessions.json");
    this.budgets.clear();
    this.sessions.clear();
    if (existsSync(bPath)) {
      try {
        const list = JSON.parse(readFileSync(bPath, "utf8")) as BudgetContract[];
        for (const b of list) this.budgets.set(b.budget_id, b);
      } catch {
        /* ignore corrupt fixtures */
      }
    }
    if (existsSync(sPath)) {
      try {
        const list = JSON.parse(
          readFileSync(sPath, "utf8"),
        ) as CostSessionContract[];
        for (const s of list) this.sessions.set(s.session_id, s);
      } catch {
        /* ignore */
      }
    }
    return { budgets: this.budgets.size, sessions: this.sessions.size };
  }

  loadSnapshot(): CostLedgerSnapshot | null {
    const path = join(this.dir, "latest-cost-ledger-snapshot.json");
    if (!existsSync(path)) return null;
    try {
      return JSON.parse(readFileSync(path, "utf8")) as CostLedgerSnapshot;
    } catch {
      return null;
    }
  }

  loadHealth(): CostLedgerHealth | null {
    const path = join(this.dir, "cost-ledger-health.json");
    if (!existsSync(path)) return null;
    try {
      return JSON.parse(readFileSync(path, "utf8")) as CostLedgerHealth;
    } catch {
      return null;
    }
  }

  buildSnapshot(): CostLedgerSnapshot {
    return buildCostLedgerSnapshot(this.listBudgets(), this.listSessions());
  }

  buildHealth(): CostLedgerHealth {
    return buildCostLedgerHealth(this.listBudgets(), this.listSessions());
  }
}
