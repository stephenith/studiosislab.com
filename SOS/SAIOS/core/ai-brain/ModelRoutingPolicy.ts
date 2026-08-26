/**
 * Model routing policy — capability + tier, never model names.
 */
import { isDeterministicOnly } from "./CapabilityRegistry.js";
import type { ReasoningRequest } from "./ReasoningRequest.js";
import type { PrivacyClassification, ProviderId, QualityTier } from "./types.js";

export type RoutingDecision = {
  allowed: boolean;
  reason: string;
  preferred_providers: ProviderId[];
  quality_tier: QualityTier;
  reject_code?: string;
};

export type ModelRoutingPolicyConfig = {
  version: string;
  reject_deterministic_to_provider: boolean;
  founder_override_deterministic_ai: boolean;
  tier_preferences: Record<QualityTier, ProviderId[]>;
  privacy_external_allowed: Record<PrivacyClassification, boolean>;
  steps: string[];
};

export const DEFAULT_ROUTING_POLICY: ModelRoutingPolicyConfig = {
  version: "1.0.0",
  reject_deterministic_to_provider: true,
  founder_override_deterministic_ai: false,
  tier_preferences: {
    strong: ["local", "openai", "mock"],
    economical: ["local", "openai", "mock"],
    deterministic: [],
    local_preferred: ["local", "openai", "mock"],
    provider_fallback: ["openai", "mock"],
  },
  privacy_external_allowed: {
    PUBLIC: true,
    INTERNAL: true,
    CONFIDENTIAL: false,
    HIGHLY_RESTRICTED: false,
  },
  steps: [
    "Validate capability",
    "Reject deterministic-only requests from model routing",
    "Check privacy classification",
    "Check task and daily budgets",
    "Check provider health",
    "Use preferred provider for the requested tier",
    "Validate structured output",
    "Retry only under policy",
    "Use fallback only when permitted",
    "Record usage and event",
    "Return normalized response",
  ],
};

export function decideRoute(
  request: ReasoningRequest,
  policy: ModelRoutingPolicyConfig = DEFAULT_ROUTING_POLICY,
  healthyProviders: ProviderId[] = ["mock"],
): RoutingDecision {
  if (isDeterministicOnly(request.capability)) {
    if (
      policy.reject_deterministic_to_provider &&
      !policy.founder_override_deterministic_ai
    ) {
      return {
        allowed: false,
        reason:
          "Deterministic-only capability must not be sent to an AI provider",
        preferred_providers: [],
        quality_tier: "deterministic",
        reject_code: "deterministic_capability_rejected",
      };
    }
  }

  const privacyOk =
    policy.privacy_external_allowed[request.privacy_classification] ?? false;

  const prefs = policy.tier_preferences[request.quality_tier] ?? [];
  const preferred = prefs.filter((p) => healthyProviders.includes(p));

  // Highly restricted / confidential: only mock (or local when enabled later)
  if (
    request.privacy_classification === "HIGHLY_RESTRICTED" ||
    request.privacy_classification === "CONFIDENTIAL"
  ) {
    const safe = preferred.filter((p) => p === "mock" || p === "local");
    if (safe.length === 0 && !privacyOk) {
      return {
        allowed: false,
        reason: "Privacy classification blocks external providers",
        preferred_providers: [],
        quality_tier: request.quality_tier,
        reject_code: "privacy_policy_blocked",
      };
    }
    return {
      allowed: safe.length > 0,
      reason: safe.length
        ? "Routed under privacy-restricted provider set"
        : "No privacy-safe provider available",
      preferred_providers: safe,
      quality_tier: request.quality_tier,
      reject_code: safe.length ? undefined : "privacy_policy_blocked",
    };
  }

  if (preferred.length === 0) {
    return {
      allowed: false,
      reason: "No healthy preferred provider for tier",
      preferred_providers: [],
      quality_tier: request.quality_tier,
      reject_code: "provider_unavailable",
    };
  }

  return {
    allowed: true,
    reason: "Route permitted",
    preferred_providers: preferred,
    quality_tier: request.quality_tier,
  };
}
