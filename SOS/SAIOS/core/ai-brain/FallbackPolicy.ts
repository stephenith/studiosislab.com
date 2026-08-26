/**
 * Fallback policy — explicit, never silent, never bypasses safety.
 */
import type { PrivacyClassification, ProviderId } from "./types.js";

export type FallbackPolicyConfig = {
  version: string;
  enabled: boolean;
  local_to_api_when_local_unhealthy: boolean;
  never_bypass: string[];
  privacy_blocks_external_fallback: PrivacyClassification[];
  chain_when_local_preferred: ProviderId[];
  rules: string[];
};

export const DEFAULT_FALLBACK_POLICY: FallbackPolicyConfig = {
  version: "1.0.0",
  enabled: true,
  local_to_api_when_local_unhealthy: true,
  never_bypass: [
    "budgets",
    "privacy_restrictions",
    "founder_gates",
    "live_gates",
  ],
  privacy_blocks_external_fallback: ["CONFIDENTIAL", "HIGHLY_RESTRICTED"],
  chain_when_local_preferred: ["local", "openai", "mock"],
  rules: [
    "Fallback must be explicit and logged as BRAIN_FALLBACK_USED",
    "Fallback must not bypass budgets",
    "Fallback must not bypass privacy restrictions",
    "Fallback must not bypass founder gates",
    "Fallback must not bypass LIVE gates",
    "Use local when capable and healthy; API when local unavailable; mock in dry_run",
  ],
};

export function canFallbackToExternal(
  privacy: PrivacyClassification,
  policy: FallbackPolicyConfig = DEFAULT_FALLBACK_POLICY,
): boolean {
  return !policy.privacy_blocks_external_fallback.includes(privacy);
}

export function assertFallbackRespectsSafety(
  policy: FallbackPolicyConfig = DEFAULT_FALLBACK_POLICY,
): boolean {
  const required = [
    "budgets",
    "privacy_restrictions",
    "founder_gates",
    "live_gates",
  ];
  return required.every((r) => policy.never_bypass.includes(r));
}
