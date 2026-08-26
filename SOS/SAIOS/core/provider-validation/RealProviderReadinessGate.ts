/**
 * Budget + RealProviderReadinessGate — blocks until config + one-time auth.
 */
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import type {
  BudgetEnvKeys,
  BudgetValidationResult,
  FounderAuthorizationContract,
  RealProviderReadiness,
  RealProviderReadinessState,
} from "./types.js";

export const BUDGET_ENV_KEYS: BudgetEnvKeys = {
  SOS_AI_MONTHLY_BUDGET_USD: "SOS_AI_MONTHLY_BUDGET_USD",
  SOS_AI_DAILY_LIMIT_USD: "SOS_AI_DAILY_LIMIT_USD",
  SOS_AI_PER_TASK_TOKEN_LIMIT: "SOS_AI_PER_TASK_TOKEN_LIMIT",
  SOS_AI_AUTO_PAUSE_THRESHOLD_PCT: "SOS_AI_AUTO_PAUSE_THRESHOLD_PCT",
  SOS_AI_FOUNDER_ALERT_THRESHOLD_PCT: "SOS_AI_FOUNDER_ALERT_THRESHOLD_PCT",
  SOS_AI_SINGLE_TEST_MAX_COST_USD: "SOS_AI_SINGLE_TEST_MAX_COST_USD",
};

export function buildBudgetConfigurationContract() {
  return {
    version: "1.0.0",
    invented_values: false,
    required_env: Object.values(BUDGET_ENV_KEYS),
    rules: [
      "numeric",
      "positive",
      "single_test_max <= daily_limit",
      "daily_limit <= monthly_budget",
      "alert_threshold < pause_threshold",
      "pause_threshold <= 100",
    ],
    note: "Do not invent values — founder must configure explicitly.",
  };
}

function parsePositiveNumber(raw: string | undefined): number | null {
  if (raw == null || raw.trim() === "") return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

export function validateBudgetEnv(
  env: NodeJS.ProcessEnv = process.env,
): BudgetValidationResult {
  const keys = Object.values(BUDGET_ENV_KEYS);
  const values: Record<string, number | null> = {};
  const missing: string[] = [];
  const errors: string[] = [];

  for (const k of keys) {
    const n = parsePositiveNumber(env[k]);
    values[k] = n;
    if (n == null) missing.push(k);
  }

  const monthly = values.SOS_AI_MONTHLY_BUDGET_USD;
  const daily = values.SOS_AI_DAILY_LIMIT_USD;
  const perTask = values.SOS_AI_PER_TASK_TOKEN_LIMIT;
  const pause = values.SOS_AI_AUTO_PAUSE_THRESHOLD_PCT;
  const alert = values.SOS_AI_FOUNDER_ALERT_THRESHOLD_PCT;
  const single = values.SOS_AI_SINGLE_TEST_MAX_COST_USD;

  if (monthly != null && daily != null && daily > monthly) {
    errors.push("daily_limit must not exceed monthly_budget");
  }
  if (daily != null && single != null && single > daily) {
    errors.push("single_test_max must not exceed daily_limit");
  }
  if (alert != null && pause != null && !(alert < pause)) {
    errors.push("alert_threshold must be below pause_threshold");
  }
  if (pause != null && pause > 100) {
    errors.push("pause_threshold must not exceed 100");
  }
  if (perTask != null && !Number.isInteger(perTask)) {
    errors.push("per_task_token_limit must be a positive integer");
  }

  return {
    ok: missing.length === 0 && errors.length === 0,
    missing,
    errors,
    values,
  };
}

export function buildFounderAuthorizationContract(
  validationId: string | null,
): FounderAuthorizationContract {
  return {
    authorization_id: `auth-pending-${validationId ?? "none"}`,
    validation_id: validationId ?? "pending",
    provider: "openai",
    purpose: "Exactly one dry-run real-provider validation request",
    maximum_test_cost_usd: null,
    maximum_input_tokens: null,
    maximum_output_tokens: null,
    expires_at: null,
    founder_actor: "stephen",
    approved_at: null,
    consumed_at: null,
    status: "PENDING",
    permits_exactly_one_request: true,
    enables_live: false,
    enables_publication: false,
    enables_general_production: false,
    notes:
      "Dashboard authorization button not implemented in Agent #134 — contract only. Consumed after exactly one request; expires; never enables LIVE/publish.",
  };
}

export function authorizationPermitsOneRequest(
  auth: FounderAuthorizationContract,
): boolean {
  return (
    auth.permits_exactly_one_request === true &&
    auth.status === "APPROVED" &&
    auth.consumed_at == null &&
    auth.enables_live === false &&
    auth.enables_publication === false &&
    auth.enables_general_production === false &&
    (auth.expires_at == null || Date.parse(auth.expires_at) > Date.now())
  );
}

export class RealProviderReadinessGate {
  constructor(
    private readonly repoRoot = resolve(import.meta.dirname, "../../../.."),
  ) {}

  evaluate(input: {
    validation_id: string | null;
    candidate_selected: boolean;
    authorization?: FounderAuthorizationContract | null;
  }): RealProviderReadiness {
    const registryPath = join(
      this.repoRoot,
      "SOS/SAIOS/config/provider-registry.json",
    );
    const registry = existsSync(registryPath)
      ? (JSON.parse(readFileSync(registryPath, "utf8")) as {
          providers: Array<{
            id: string;
            enabled: boolean;
            credentials_configured?: boolean;
            implemented?: boolean;
          }>;
        })
      : { providers: [] };

    const openai = registry.providers.find((p) => p.id === "openai");
    const adapter_implemented = Boolean(openai?.implemented);
    const credentials_configured = Boolean(openai?.credentials_configured);
    const provider_registry_enabled = Boolean(openai?.enabled);
    const live_off = process.env.SOS_AIOS_LIVE !== "1";
    const dry_run = true;
    const budgets = validateBudgetEnv();

    const routingPath = join(
      this.repoRoot,
      "SOS/SAIOS/config/model-routing.policy.json",
    );
    const routing = existsSync(routingPath)
      ? (JSON.parse(readFileSync(routingPath, "utf8")) as {
          privacy_external_allowed?: Record<string, boolean>;
        })
      : {};
    const privacy_allows_external =
      routing.privacy_external_allowed?.INTERNAL === true;

    const auth =
      input.authorization ??
      buildFounderAuthorizationContract(input.validation_id);

    const missing: string[] = [];
    if (!input.candidate_selected) {
      missing.push("eligible_founder_approved_candidate");
    }
    if (!adapter_implemented) missing.push("openai_adapter_implemented");
    if (!credentials_configured) missing.push("openai_credentials");
    if (!provider_registry_enabled) missing.push("openai_registry_enabled");
    missing.push(...budgets.missing);
    if (!authorizationPermitsOneRequest(auth)) {
      missing.push("founder_one_time_authorization");
    }

    let state: RealProviderReadinessState = "TEST_BLOCKED";
    if (!adapter_implemented) state = "NOT_IMPLEMENTED";
    else if (!credentials_configured) state = "MISSING_CREDENTIALS";
    else if (!budgets.ok) state = "MISSING_BUDGETS";
    else if (!provider_registry_enabled || !live_off) state = "TEST_BLOCKED";
    else if (!authorizationPermitsOneRequest(auth)) {
      state = "WAITING_FOUNDER_AUTHORIZATION";
    } else if (input.candidate_selected && missing.length === 0) {
      // Still never auto-transition — Agent #134 forbids READY without explicit path
      state = "WAITING_FOUNDER_AUTHORIZATION";
    }

    // Hard rule: no automatic READY_FOR_ONE_TEST in this agent
    if (state === "READY_FOR_ONE_TEST") {
      state = "WAITING_FOUNDER_AUTHORIZATION";
    }

    return {
      state,
      provider: "openai",
      adapter_implemented,
      credentials_configured,
      provider_registry_enabled,
      live_off,
      dry_run,
      budgets,
      estimated_test_cost_within_budget: null,
      privacy_allows_external,
      founder_authorization: auth,
      missing_configuration: [...new Set(missing)],
      automatic_ready_forbidden: true,
      publication_allowed: false,
      evaluated_at: new Date().toISOString(),
    };
  }
}
