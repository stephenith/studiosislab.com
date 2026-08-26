/**
 * BudgetSession / CostSession — immutable cost-session-1.0.0 (Agent #181).
 * Owned by Execution Controller (future). No billing.
 */
import { randomUUID } from "node:crypto";
import { sha256Canonical } from "../checksums/index.js";
import type {
  CostSessionContract,
  CostSessionStatus,
  ProviderEstimatePlaceholder,
  WorkerEstimatePlaceholder,
} from "./CostLedgerTypes.js";
import {
  COST_LEDGER_CURRENCY,
  COST_LEDGER_SAFETY_FLAGS,
  COST_SESSION_SCHEMA_VERSION,
} from "./CostLedgerTypes.js";
import { money } from "./Budget.js";

export function computeSessionChecksum(
  record: Omit<CostSessionContract, "checksums"> & {
    checksums: {
      session_checksum: string;
      budget_checksum: string | null;
      controller_ref_checksum: string | null;
    };
  },
): string {
  const { checksums: _c, ...rest } = record;
  return sha256Canonical({
    ...rest,
    checksums: {
      budget_checksum: record.checksums.budget_checksum,
      controller_ref_checksum: record.checksums.controller_ref_checksum,
    },
  });
}

export function createCostSession(input: {
  mission_id: string;
  department_id?: string | null;
  execution_controller_id?: string | null;
  estimated_cost?: number | null;
  approved_budget?: number | null;
  remaining_budget?: number | null;
  reserved_budget?: number | null;
  provider_estimates?: ProviderEstimatePlaceholder[];
  worker_estimates?: WorkerEstimatePlaceholder[];
  status?: CostSessionStatus;
  budget_ids?: string[];
  budget_checksum?: string | null;
  controller_ref_checksum?: string | null;
  version?: string;
  notes?: string[];
  fixture?: boolean;
  session_id?: string;
  created_at?: string;
}): CostSessionContract {
  const now = new Date().toISOString();
  const draft: CostSessionContract = {
    schema_version: COST_SESSION_SCHEMA_VERSION,
    session_id:
      input.session_id ??
      `cs-${now.slice(0, 10).replace(/-/g, "")}-${randomUUID().slice(0, 8)}`,
    mission_id: input.mission_id,
    department_id: input.department_id ?? null,
    execution_controller_id: input.execution_controller_id ?? null,
    estimated_cost: money(input.estimated_cost ?? null),
    approved_budget: money(input.approved_budget ?? null),
    remaining_budget: money(
      input.remaining_budget !== undefined
        ? input.remaining_budget
        : (input.approved_budget ?? null),
    ),
    reserved_budget: money(input.reserved_budget ?? null),
    currency: COST_LEDGER_CURRENCY,
    provider_estimates: input.provider_estimates ?? [],
    worker_estimates: input.worker_estimates ?? [],
    status: input.status ?? "OPEN",
    checksums: {
      session_checksum: "",
      budget_checksum: input.budget_checksum ?? null,
      controller_ref_checksum: input.controller_ref_checksum ?? null,
    },
    version: input.version ?? "1.0.0",
    budget_ids: input.budget_ids ?? [],
    safety_flags: COST_LEDGER_SAFETY_FLAGS,
    created_at: input.created_at ?? now,
    updated_at: now,
    next_safe_action:
      "Cost session metadata · Execution Controller owns sessions (future) · no billing · LIVE OFF",
    notes: input.notes ?? [
      "Reference Execution Controller only — not wired (Agent #181)",
    ],
    fixture: Boolean(input.fixture),
  };

  const session_checksum = computeSessionChecksum(draft);
  return {
    ...draft,
    checksums: {
      ...draft.checksums,
      session_checksum,
    },
  };
}

/** Alias requested by architecture: BudgetSession wraps CostSession. */
export class BudgetSession {
  readonly contract: CostSessionContract;

  constructor(contract: CostSessionContract) {
    this.contract = contract;
  }

  get id(): string {
    return this.contract.session_id;
  }

  /** V1: never spends. */
  canSpend(): false {
    return false;
  }
}

export { BudgetSession as CostSession };
