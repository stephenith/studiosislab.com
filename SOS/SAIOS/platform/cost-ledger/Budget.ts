/**
 * Budget — immutable budget contract factory (Agent #181).
 */
import { randomUUID } from "node:crypto";
import { sha256Canonical } from "../checksums/index.js";
import type {
  BudgetContract,
  BudgetKind,
  BudgetLifecycleStatus,
  MoneyAmount,
} from "./CostLedgerTypes.js";
import {
  BUDGET_CONTRACT_VERSION,
  COST_LEDGER_CURRENCY,
  COST_LEDGER_SAFETY_FLAGS,
} from "./CostLedgerTypes.js";
import { defineBudgetPolicy } from "./BudgetPolicy.js";

export function money(amount: number | null): MoneyAmount {
  return {
    amount,
    currency: COST_LEDGER_CURRENCY,
    informational: true,
  };
}

export function computeBudgetChecksum(
  record: Omit<BudgetContract, "checksums"> & {
    checksums: { parent_checksum: string | null; budget_checksum: string };
  },
): string {
  const { checksums: _c, ...rest } = record;
  return sha256Canonical({
    ...rest,
    checksums: { parent_checksum: record.checksums.parent_checksum },
  });
}

export function createBudget(input: {
  budget_kind: BudgetKind;
  budget_name: string;
  version?: string;
  status?: BudgetLifecycleStatus;
  mission_id?: string | null;
  department_id?: string | null;
  execution_controller_id?: string | null;
  proposed_by?: BudgetContract["proposed_by"];
  owned_by?: BudgetContract["owned_by"];
  amount?: number | null;
  reserved?: number | null;
  remaining?: number | null;
  hard_limit?: number | null;
  soft_limit?: number | null;
  warning_limit?: number | null;
  reserve_limit?: number | null;
  emergency_stop?: boolean;
  parent_checksum?: string | null;
  notes?: string[];
  fixture?: boolean;
  budget_id?: string;
  created_at?: string;
}): BudgetContract {
  const now = new Date().toISOString();
  const amount = money(input.amount ?? null);
  const reserved = money(input.reserved ?? null);
  const remaining =
    input.remaining !== undefined
      ? money(input.remaining)
      : money(input.amount ?? null);

  const draft: BudgetContract = {
    schema_version: BUDGET_CONTRACT_VERSION,
    budget_id:
      input.budget_id ??
      `bud-${now.slice(0, 10).replace(/-/g, "")}-${randomUUID().slice(0, 8)}`,
    budget_kind: input.budget_kind,
    budget_name: input.budget_name,
    version: input.version ?? "1.0.0",
    status: input.status ?? "CREATED",
    mission_id: input.mission_id ?? null,
    department_id: input.department_id ?? null,
    execution_controller_id: input.execution_controller_id ?? null,
    proposed_by: input.proposed_by ?? "company_brain",
    owned_by: input.owned_by ?? "execution_controller",
    currency: COST_LEDGER_CURRENCY,
    amount,
    reserved,
    remaining,
    policy: defineBudgetPolicy({
      hard_limit: input.hard_limit,
      soft_limit: input.soft_limit,
      warning_limit: input.warning_limit,
      reserve_limit: input.reserve_limit,
      emergency_stop: input.emergency_stop,
    }),
    checksums: {
      budget_checksum: "",
      parent_checksum: input.parent_checksum ?? null,
    },
    safety_flags: COST_LEDGER_SAFETY_FLAGS,
    created_at: input.created_at ?? now,
    updated_at: now,
    next_safe_action:
      "Budget metadata only · no billing · execution remains impossible · LIVE OFF",
    notes: input.notes ?? [],
    fixture: Boolean(input.fixture),
  };

  const budget_checksum = computeBudgetChecksum(draft);
  return {
    ...draft,
    checksums: {
      parent_checksum: draft.checksums.parent_checksum,
      budget_checksum,
    },
  };
}

export class Budget {
  readonly contract: BudgetContract;

  constructor(contract: BudgetContract) {
    this.contract = contract;
  }

  get id(): string {
    return this.contract.budget_id;
  }

  withStatus(status: BudgetLifecycleStatus): Budget {
    return new Budget(
      createBudget({
        ...this.contract,
        status,
        amount: this.contract.amount.amount,
        reserved: this.contract.reserved.amount,
        remaining: this.contract.remaining.amount,
        hard_limit: this.contract.policy.hard_limit,
        soft_limit: this.contract.policy.soft_limit,
        warning_limit: this.contract.policy.warning_limit,
        reserve_limit: this.contract.policy.reserve_limit,
        emergency_stop: this.contract.policy.emergency_stop,
        parent_checksum: this.contract.checksums.parent_checksum,
        budget_id: this.contract.budget_id,
        created_at: this.contract.created_at,
        notes: this.contract.notes,
        fixture: this.contract.fixture,
      }),
    );
  }
}
