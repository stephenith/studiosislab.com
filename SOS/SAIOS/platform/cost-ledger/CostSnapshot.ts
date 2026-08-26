/**
 * CostSnapshot — ledger snapshot builder (Agent #181).
 */
import type {
  BudgetContract,
  CostLedgerHealth,
  CostLedgerSnapshot,
  CostSessionContract,
} from "./CostLedgerTypes.js";
import {
  COST_LEDGER_HEALTH_VERSION,
  COST_LEDGER_SAFETY_FLAGS,
  COST_LEDGER_SNAPSHOT_VERSION,
} from "./CostLedgerTypes.js";

export function buildCostLedgerSnapshot(
  budgets: BudgetContract[],
  sessions: CostSessionContract[],
): CostLedgerSnapshot {
  const latestSession = sessions.length
    ? sessions[sessions.length - 1]!
    : null;
  const latestBudget = budgets.length ? budgets[budgets.length - 1]! : null;
  return {
    schema_version: COST_LEDGER_SNAPSHOT_VERSION,
    updated_at: new Date().toISOString(),
    budget_count: budgets.length,
    session_count: sessions.length,
    ready_budget_count: budgets.filter((b) => b.status === "READY").length,
    open_session_count: sessions.filter((s) =>
      ["OPEN", "RESERVED", "READY"].includes(s.status),
    ).length,
    latest_session_id: latestSession?.session_id ?? null,
    latest_budget_id: latestBudget?.budget_id ?? null,
    next_safe_action:
      "Cost ledger contracts only · no billing · execution remains impossible · LIVE OFF",
    safety_flags: COST_LEDGER_SAFETY_FLAGS,
  };
}

export function buildCostLedgerHealth(
  budgets: BudgetContract[],
  sessions: CostSessionContract[],
): CostLedgerHealth {
  return {
    schema_version: COST_LEDGER_HEALTH_VERSION,
    updated_at: new Date().toISOString(),
    budget_count: budgets.length,
    session_count: sessions.length,
    status: budgets.length || sessions.length ? "healthy" : "idle",
    mode: "cost_ledger_contracts_only",
    billing: false,
    safety_flags: COST_LEDGER_SAFETY_FLAGS,
    live: false,
  };
}
