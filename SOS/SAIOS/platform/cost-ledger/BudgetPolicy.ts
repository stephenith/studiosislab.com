/**
 * BudgetPolicy — limit metadata (Agent #181).
 * Never enforced in V1.
 */
import type { BudgetPolicyLimits } from "./CostLedgerTypes.js";

export const DEFAULT_BUDGET_POLICY: BudgetPolicyLimits = {
  hard_limit: null,
  soft_limit: null,
  warning_limit: null,
  reserve_limit: null,
  emergency_stop: false,
  enforcement_enabled: false,
};

export function defineBudgetPolicy(
  partial?: Partial<Omit<BudgetPolicyLimits, "enforcement_enabled">>,
): BudgetPolicyLimits {
  return {
    hard_limit: partial?.hard_limit ?? null,
    soft_limit: partial?.soft_limit ?? null,
    warning_limit: partial?.warning_limit ?? null,
    reserve_limit: partial?.reserve_limit ?? null,
    emergency_stop: Boolean(partial?.emergency_stop),
    enforcement_enabled: false,
  };
}

/** V1: policies are informational only. */
export function isPolicyEnforced(_policy: BudgetPolicyLimits): false {
  return false;
}
