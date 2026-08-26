/**
 * BudgetValidator + lifecycle transitions (Agent #181).
 */
import { rejectForbiddenKeys } from "../checksums/index.js";
import {
  BaseLifecycleStateMachine,
  DEFAULT_EXECUTION_BLOCKED_TARGETS,
} from "../state-machine/BaseLifecycleStateMachine.js";
import type {
  BudgetContract,
  BudgetLifecycleStatus,
  BudgetValidationIssue,
  BudgetValidationResult,
  CostSessionContract,
} from "./CostLedgerTypes.js";
import { computeBudgetChecksum } from "./Budget.js";
import { computeSessionChecksum } from "./BudgetSession.js";

export const BUDGET_FORBIDDEN_KEYS = [
  "execute",
  "dispatch",
  "scheduler",
  "enqueue",
  "queue_insert",
  "spawn_worker",
  "provider",
  "publish",
  "enable_live",
  "charge",
  "bill",
  "api_key",
] as const;

/**
 * CREATED → VALIDATED → APPROVED → RESERVED → READY → CLOSED
 */
export const BUDGET_LIFECYCLE_TRANSITIONS: Partial<
  Record<BudgetLifecycleStatus, BudgetLifecycleStatus[]>
> = {
  CREATED: ["VALIDATED", "CLOSED"],
  VALIDATED: ["APPROVED", "CLOSED"],
  APPROVED: ["RESERVED", "CLOSED"],
  RESERVED: ["READY", "CLOSED"],
  READY: ["CLOSED"],
  CLOSED: [],
};

const machine = new BaseLifecycleStateMachine(
  BUDGET_LIFECYCLE_TRANSITIONS as Record<string, readonly string[]>,
  [...DEFAULT_EXECUTION_BLOCKED_TARGETS, "SPENDING", "CHARGED", "BILLED"],
);

export function canBudgetLifecycleTransition(
  from: BudgetLifecycleStatus,
  to: BudgetLifecycleStatus,
): boolean {
  return machine.can(from, to);
}

export function assertBudgetLifecycleTransition(
  from: BudgetLifecycleStatus,
  to: BudgetLifecycleStatus,
): void {
  machine.assert(from, to, "budget-lifecycle");
}

export function rejectForbiddenBudgetPayload(
  payload: Record<string, unknown>,
): BudgetValidationIssue | null {
  return rejectForbiddenKeys(payload, BUDGET_FORBIDDEN_KEYS, {
    messageForKey: (key) => `Field '${key}' is forbidden on cost ledger`,
  });
}

export function validateBudget(
  budget: BudgetContract | null,
): BudgetValidationResult {
  const errors: BudgetValidationIssue[] = [];
  if (!budget) {
    return {
      ok: false,
      errors: [{ code: "BUDGET_MISSING", message: "Budget missing" }],
    };
  }

  const forbidden = rejectForbiddenBudgetPayload(
    budget as unknown as Record<string, unknown>,
  );
  if (forbidden) errors.push(forbidden);

  if (!budget.budget_id?.trim()) {
    errors.push({
      code: "MISSING_BUDGET_ID",
      message: "budget_id required",
      field: "budget_id",
    });
  }
  if (!budget.budget_name?.trim()) {
    errors.push({
      code: "MISSING_BUDGET_NAME",
      message: "budget_name required",
      field: "budget_name",
    });
  }
  if (budget.amount.informational !== true) {
    errors.push({
      code: "AMOUNT_NOT_INFORMATIONAL",
      message: "amount must be informational",
      field: "amount",
    });
  }
  if (budget.policy.enforcement_enabled !== false) {
    errors.push({
      code: "POLICY_ENFORCEMENT",
      message: "policy enforcement must be false",
      field: "policy",
    });
  }
  if (budget.safety_flags.billing_allowed !== false) {
    errors.push({
      code: "BILLING_UNLOCKED",
      message: "billing_allowed must be false",
      field: "safety_flags",
    });
  }
  if (budget.safety_flags.execution_allowed !== false) {
    errors.push({
      code: "EXECUTION_UNLOCKED",
      message: "execution_allowed must be false",
      field: "safety_flags",
    });
  }
  if (budget.safety_flags.live_enabled !== false) {
    errors.push({
      code: "LIVE_UNLOCKED",
      message: "live_enabled must be false",
      field: "safety_flags",
    });
  }

  const expected = computeBudgetChecksum({
    ...budget,
    checksums: {
      parent_checksum: budget.checksums.parent_checksum,
      budget_checksum: "",
    },
  });
  if (budget.checksums.budget_checksum !== expected) {
    errors.push({
      code: "BUDGET_CHECKSUM_INVALID",
      message: "budget checksum mismatch",
      field: "checksums",
    });
  }

  return { ok: errors.length === 0, errors };
}

export function validateCostSession(
  session: CostSessionContract | null,
): BudgetValidationResult {
  const errors: BudgetValidationIssue[] = [];
  if (!session) {
    return {
      ok: false,
      errors: [{ code: "SESSION_MISSING", message: "Cost session missing" }],
    };
  }

  const forbidden = rejectForbiddenBudgetPayload(
    session as unknown as Record<string, unknown>,
  );
  if (forbidden) errors.push(forbidden);

  if (!session.mission_id?.trim()) {
    errors.push({
      code: "MISSING_MISSION_ID",
      message: "mission_id required",
      field: "mission_id",
    });
  }
  if (session.schema_version !== "cost-session-1.0.0") {
    errors.push({
      code: "BAD_SESSION_SCHEMA",
      message: "schema must be cost-session-1.0.0",
      field: "schema_version",
    });
  }
  if (session.safety_flags.billing_allowed !== false) {
    errors.push({
      code: "BILLING_UNLOCKED",
      message: "billing_allowed must be false",
      field: "safety_flags",
    });
  }
  for (const p of session.provider_estimates) {
    if (p.calculated !== false) {
      errors.push({
        code: "PROVIDER_ESTIMATE_CALCULATED",
        message: "provider estimates must be placeholders",
        field: "provider_estimates",
      });
    }
  }
  for (const w of session.worker_estimates) {
    if (w.calculated !== false) {
      errors.push({
        code: "WORKER_ESTIMATE_CALCULATED",
        message: "worker estimates must be placeholders",
        field: "worker_estimates",
      });
    }
  }

  const expected = computeSessionChecksum({
    ...session,
    checksums: {
      session_checksum: "",
      budget_checksum: session.checksums.budget_checksum,
      controller_ref_checksum: session.checksums.controller_ref_checksum,
    },
  });
  if (session.checksums.session_checksum !== expected) {
    errors.push({
      code: "SESSION_CHECKSUM_INVALID",
      message: "session checksum mismatch",
      field: "checksums",
    });
  }

  return { ok: errors.length === 0, errors };
}
