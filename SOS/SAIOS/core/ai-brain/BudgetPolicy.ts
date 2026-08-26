/**
 * Budget policy — founder ceilings required before real provider activation.
 * No numerical ceilings invented.
 */
export type BudgetPolicyConfig = {
  version: string;
  env_keys: {
    monthly_budget_usd: "SOS_AI_MONTHLY_BUDGET_USD";
    daily_limit_usd: "SOS_AI_DAILY_LIMIT_USD";
    per_task_token_limit: "SOS_AI_PER_TASK_TOKEN_LIMIT";
    auto_pause_threshold_pct: "SOS_AI_AUTO_PAUSE_THRESHOLD_PCT";
    founder_alert_threshold_pct: "SOS_AI_FOUNDER_ALERT_THRESHOLD_PCT";
  };
  rules: string[];
  values: {
    monthly_budget_usd: number | null;
    daily_limit_usd: number | null;
    per_task_token_limit: number | null;
    auto_pause_threshold_pct: number | null;
    founder_alert_threshold_pct: number | null;
  };
  real_provider_activation_allowed: boolean;
  cost_ledger_path: string;
};

export const DEFAULT_BUDGET_POLICY: BudgetPolicyConfig = {
  version: "1.0.0",
  env_keys: {
    monthly_budget_usd: "SOS_AI_MONTHLY_BUDGET_USD",
    daily_limit_usd: "SOS_AI_DAILY_LIMIT_USD",
    per_task_token_limit: "SOS_AI_PER_TASK_TOKEN_LIMIT",
    auto_pause_threshold_pct: "SOS_AI_AUTO_PAUSE_THRESHOLD_PCT",
    founder_alert_threshold_pct: "SOS_AI_FOUNDER_ALERT_THRESHOLD_PCT",
  },
  rules: [
    "No real provider can activate if required limits are unset",
    "Estimated task cost must be checked before execution",
    "Automatically pause new model tasks at the configured threshold",
    "Existing deterministic operations may continue",
    "Founder must receive an alert when the alert threshold is reached",
    "Usage must be written to a cost ledger later",
  ],
  values: {
    monthly_budget_usd: null,
    daily_limit_usd: null,
    per_task_token_limit: null,
    auto_pause_threshold_pct: null,
    founder_alert_threshold_pct: null,
  },
  real_provider_activation_allowed: false,
  cost_ledger_path: "SOS/07_LOGS/saios/cost/ledger.jsonl",
};

export function readBudgetFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): BudgetPolicyConfig {
  const parseNum = (k: string): number | null => {
    const v = env[k]?.trim();
    if (!v) return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };

  const values = {
    monthly_budget_usd: parseNum("SOS_AI_MONTHLY_BUDGET_USD"),
    daily_limit_usd: parseNum("SOS_AI_DAILY_LIMIT_USD"),
    per_task_token_limit: parseNum("SOS_AI_PER_TASK_TOKEN_LIMIT"),
    auto_pause_threshold_pct: parseNum("SOS_AI_AUTO_PAUSE_THRESHOLD_PCT"),
    founder_alert_threshold_pct: parseNum("SOS_AI_FOUNDER_ALERT_THRESHOLD_PCT"),
  };

  const allSet = Object.values(values).every((v) => v !== null);

  return {
    ...DEFAULT_BUDGET_POLICY,
    values,
    real_provider_activation_allowed: allSet,
  };
}

export function canActivateRealProvider(policy: BudgetPolicyConfig): boolean {
  return (
    policy.real_provider_activation_allowed &&
    policy.values.monthly_budget_usd !== null &&
    policy.values.daily_limit_usd !== null &&
    policy.values.per_task_token_limit !== null &&
    policy.values.auto_pause_threshold_pct !== null &&
    policy.values.founder_alert_threshold_pct !== null
  );
}

/**
 * True when ceilings are configured AND ledger spend is under daily/monthly/auto-pause.
 * Import CostLedger lazily-safe for callers that already have policy values.
 */
export function canActivateRealProviderWithSpend(
  policy: BudgetPolicyConfig,
  spendOk: boolean,
): boolean {
  return canActivateRealProvider(policy) && spendOk;
}
