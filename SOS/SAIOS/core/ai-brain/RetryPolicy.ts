/**
 * Retry policy contract for AI Brain requests.
 */
export type RetryPolicyConfig = {
  version: string;
  default_max_retries: number;
  default_backoff_ms: number;
  retryable_failures: string[];
  non_retryable_failures: string[];
};

export const DEFAULT_RETRY_POLICY: RetryPolicyConfig = {
  version: "1.0.0",
  default_max_retries: 2,
  default_backoff_ms: 1000,
  retryable_failures: ["timeout", "rate_limit", "provider_unavailable"],
  non_retryable_failures: [
    "authentication_failure",
    "budget_exceeded",
    "privacy_policy_blocked",
    "deterministic_capability_rejected",
    "safety_refusal",
    "schema_validation_failure",
  ],
};

export function isRetryableFailure(
  code: string,
  policy: RetryPolicyConfig = DEFAULT_RETRY_POLICY,
): boolean {
  if (policy.non_retryable_failures.includes(code)) return false;
  return policy.retryable_failures.includes(code);
}
