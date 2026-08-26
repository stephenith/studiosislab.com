/**
 * Cost Ledger types — Agent #181.
 * Bookkeeping architecture only. Never bills, never executes.
 */

export const COST_LEDGER_SCHEMA_VERSION = "cost-ledger-1.0.0" as const;
export const COST_SESSION_SCHEMA_VERSION = "cost-session-1.0.0" as const;
export const BUDGET_CONTRACT_VERSION = "budget-contract-1.0.0" as const;
export const COST_LEDGER_SNAPSHOT_VERSION =
  "cost-ledger-snapshot-1.0.0" as const;
export const COST_LEDGER_HEALTH_VERSION = "cost-ledger-health-1.0.0" as const;

export const COST_LEDGER_CURRENCY = "USD" as const;

export const COST_LEDGER_SAFETY_FLAGS = {
  execution_allowed: false,
  dispatch_allowed: false,
  worker_spawn_allowed: false,
  queue_insert_allowed: false,
  provider_allowed: false,
  publishing_allowed: false,
  live_enabled: false,
  billing_allowed: false,
  token_counting_allowed: false,
  external_calls_allowed: false,
} as const;

export type CostLedgerSafetyFlags = typeof COST_LEDGER_SAFETY_FLAGS;

export type BudgetKind =
  | "mission"
  | "department"
  | "execution"
  | "provider"
  | "worker"
  | "daily"
  | "monthly"
  | "emergency_reserve";

export type BudgetLifecycleStatus =
  | "CREATED"
  | "VALIDATED"
  | "APPROVED"
  | "RESERVED"
  | "READY"
  | "CLOSED";

export type CostSessionStatus =
  | "OPEN"
  | "RESERVED"
  | "READY"
  | "CLOSED"
  | "BLOCKED";

export type BudgetPolicyLimits = {
  hard_limit: number | null;
  soft_limit: number | null;
  warning_limit: number | null;
  reserve_limit: number | null;
  emergency_stop: boolean;
  /** V1: metadata only — never enforced */
  enforcement_enabled: false;
};

export type MoneyAmount = {
  amount: number | null;
  currency: typeof COST_LEDGER_CURRENCY;
  informational: true;
};

export type ProviderEstimatePlaceholder = {
  provider_id: string;
  estimated_cost: number | null;
  unit: "usd" | "tokens" | "unknown";
  calculated: false;
};

export type WorkerEstimatePlaceholder = {
  worker_id: string;
  estimated_cost: number | null;
  calculated: false;
};

export type BudgetChecksums = {
  budget_checksum: string;
  parent_checksum: string | null;
};

export type CostSessionChecksums = {
  session_checksum: string;
  budget_checksum: string | null;
  controller_ref_checksum: string | null;
};

export type BudgetContract = {
  schema_version: typeof BUDGET_CONTRACT_VERSION;
  budget_id: string;
  budget_kind: BudgetKind;
  budget_name: string;
  version: string;
  status: BudgetLifecycleStatus;
  mission_id: string | null;
  department_id: string | null;
  execution_controller_id: string | null;
  /** Company Brain proposes; Execution Controller owns sessions (future) */
  proposed_by: "company_brain" | "founder" | "system" | "unknown";
  owned_by: "execution_controller" | "department" | "system";
  currency: typeof COST_LEDGER_CURRENCY;
  amount: MoneyAmount;
  reserved: MoneyAmount;
  remaining: MoneyAmount;
  policy: BudgetPolicyLimits;
  checksums: BudgetChecksums;
  safety_flags: CostLedgerSafetyFlags;
  created_at: string;
  updated_at: string;
  next_safe_action: string;
  notes: string[];
  fixture?: boolean;
};

export type CostSessionContract = {
  schema_version: typeof COST_SESSION_SCHEMA_VERSION;
  session_id: string;
  mission_id: string;
  department_id: string | null;
  execution_controller_id: string | null;
  estimated_cost: MoneyAmount;
  approved_budget: MoneyAmount;
  remaining_budget: MoneyAmount;
  reserved_budget: MoneyAmount;
  currency: typeof COST_LEDGER_CURRENCY;
  provider_estimates: ProviderEstimatePlaceholder[];
  worker_estimates: WorkerEstimatePlaceholder[];
  status: CostSessionStatus;
  checksums: CostSessionChecksums;
  version: string;
  budget_ids: string[];
  safety_flags: CostLedgerSafetyFlags;
  created_at: string;
  updated_at: string;
  next_safe_action: string;
  notes: string[];
  fixture?: boolean;
};

export type CostEstimateResult = {
  ok: true;
  kind: string;
  estimated_cost: MoneyAmount;
  calculated: false;
  placeholder: true;
  note: string;
};

export type CostLedgerSnapshot = {
  schema_version: typeof COST_LEDGER_SNAPSHOT_VERSION;
  updated_at: string;
  budget_count: number;
  session_count: number;
  ready_budget_count: number;
  open_session_count: number;
  latest_session_id: string | null;
  latest_budget_id: string | null;
  next_safe_action: string;
  safety_flags: CostLedgerSafetyFlags;
};

export type CostLedgerHealth = {
  schema_version: typeof COST_LEDGER_HEALTH_VERSION;
  updated_at: string;
  budget_count: number;
  session_count: number;
  status: "idle" | "healthy" | "degraded";
  mode: "cost_ledger_contracts_only";
  billing: false;
  safety_flags: CostLedgerSafetyFlags;
  live: false;
};

export type BudgetValidationIssue = {
  code: string;
  message: string;
  field?: string;
};

export type BudgetValidationResult = {
  ok: boolean;
  errors: BudgetValidationIssue[];
};

export type BudgetSummary = {
  budget_id: string;
  budget_kind: BudgetKind;
  budget_name: string;
  status: BudgetLifecycleStatus;
  mission_id: string | null;
  department_id: string | null;
  amount: number | null;
  remaining: number | null;
  validation_ok: boolean;
};
