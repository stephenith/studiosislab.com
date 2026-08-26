/**
 * Provider-neutral Reasoning Request contract.
 * Departments request capabilities — never model names.
 */
import type {
  BrainCapability,
  PrivacyClassification,
  Priority,
  QualityTier,
} from "./types.js";

export type ReasoningRetryPolicy = {
  max_retries: number;
  backoff_ms: number;
  retry_on: string[];
};

export type ReasoningFallbackPolicy = {
  enabled: boolean;
  allow_provider_fallback: boolean;
  allow_local_to_api: boolean;
  respect_privacy: boolean;
  respect_budget: boolean;
  respect_founder_gates: boolean;
  respect_live_gates: boolean;
};

export type ReasoningRequest = {
  request_id: string;
  task_id: string;
  department: string;
  capability: BrainCapability;
  objective: string;
  instructions: string;
  context_references: string[];
  memory_references: string[];
  expected_response_schema: string | Record<string, unknown>;
  quality_tier: QualityTier;
  priority: Priority;
  maximum_input_tokens: number;
  maximum_output_tokens: number;
  estimated_cost_ceiling_usd: number | null;
  timeout_ms: number;
  retry_policy: ReasoningRetryPolicy;
  fallback_policy: ReasoningFallbackPolicy;
  privacy_classification: PrivacyClassification;
  created_at: string;
  deadline: string | null;
  dry_run: boolean;
  founder_approval_requirement: boolean;
  /** Forbidden: provider-specific model names must not appear here. */
  metadata?: Record<string, unknown>;
};

/** Compile-time guard: request must not carry a model field. */
export type ReasoningRequestMustNotContainModel = ReasoningRequest & {
  model?: never;
  model_name?: never;
  openai_model?: never;
};
