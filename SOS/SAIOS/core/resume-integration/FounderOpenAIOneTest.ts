/**
 * Founder-authorized bounded OpenAI gates for Resume Template AI path.
 * Production 24/7 uses SOS_AI_FOUNDER_OPENAI_BOUNDED=1 (ONE_TEST=1 accepted as legacy alias).
 * Committed registry may stay mock-only; overlay is in-memory only.
 * LIVE=1 always blocks OpenAI for this department.
 */
import {
  canActivateRealProvider,
  readBudgetFromEnv,
} from "../ai-brain/BudgetPolicy.js";
import { evaluateSpendAgainstBudget } from "../ai-brain/CostLedger.js";
import { canFallbackToExternal } from "../ai-brain/FallbackPolicy.js";
import type { ProviderRegistryState } from "../ai-brain/ProviderRegistry.js";
import type { PrivacyClassification } from "../ai-brain/types.js";
import type { ExecuteViaProviderOptions } from "../ai-brain/BrainRouter.js";

/** In-memory overlay — never written to provider-registry.json. */
export function founderOpenAIBoundedRegistryOverlay(): ProviderRegistryState {
  return {
    version: "1.0.0",
    active_provider_allowed: ["mock", "openai"],
    providers: [
      {
        id: "mock",
        enabled: true,
        mode: "dry_run",
        credentials_configured: false,
        implemented: true,
      },
      {
        id: "openai",
        enabled: true,
        mode: "live",
        credentials_configured: true,
        implemented: true,
        notes: "Resume Founder bounded overlay — not committed",
      },
      {
        id: "local",
        enabled: false,
        mode: "disabled",
        credentials_configured: false,
        implemented: false,
      },
      {
        id: "future_provider",
        enabled: false,
        mode: "disabled",
        credentials_configured: false,
      },
    ],
  };
}

/** @deprecated alias — prefer founderOpenAIBoundedRegistryOverlay */
export const founderOpenAIOneTestRegistryOverlay =
  founderOpenAIBoundedRegistryOverlay;

/**
 * True when bounded Founder OpenAI may run for Resume Templates.
 * Accepts SOS_AI_FOUNDER_OPENAI_BOUNDED=1 or legacy SOS_AI_FOUNDER_OPENAI_ONE_TEST=1.
 * Enforces env budget ceilings configured AND real ledger spend under limits.
 */
export function isFounderOpenAIBoundedEnabled(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  if (env.SOS_AIOS_LIVE === "1") return false;
  if (env.SOS_AI_FOUNDER_OPENAI_BOUNDED === "1") return true;
  if (env.SOS_AI_FOUNDER_OPENAI_ONE_TEST === "1") return true;
  return false;
}

export function canUseFounderOpenAIBounded(
  privacy: PrivacyClassification,
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  if (!isFounderOpenAIBoundedEnabled(env)) return false;
  if (!env.OPENAI_API_KEY?.trim()) return false;
  const policy = readBudgetFromEnv(env);
  if (!canActivateRealProvider(policy)) return false;
  if (!canFallbackToExternal(privacy)) return false;

  const spend = evaluateSpendAgainstBudget({
    daily_limit_usd: policy.values.daily_limit_usd,
    monthly_budget_usd: policy.values.monthly_budget_usd,
    auto_pause_threshold_pct: policy.values.auto_pause_threshold_pct,
  });
  if (!spend.ok) return false;
  return true;
}

/** @deprecated alias — prefer canUseFounderOpenAIBounded */
export function canUseFounderOpenAIOneTest(
  privacy: PrivacyClassification,
): boolean {
  return canUseFounderOpenAIBounded(privacy);
}

/** Execute options for Resume BrainRouter selection. */
export function resumeProviderExecuteOptions(
  privacy: PrivacyClassification,
  base: ExecuteViaProviderOptions = {},
): ExecuteViaProviderOptions {
  if (!canUseFounderOpenAIBounded(privacy)) {
    return {
      ...base,
      healthyProviders: base.healthyProviders ?? ["mock"],
    };
  }
  return {
    ...base,
    registry: base.registry ?? founderOpenAIBoundedRegistryOverlay(),
    healthyProviders: base.healthyProviders ?? ["mock", "openai"],
  };
}
