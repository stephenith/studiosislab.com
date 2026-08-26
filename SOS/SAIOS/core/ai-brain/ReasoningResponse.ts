/**
 * Provider-neutral Reasoning Response contract.
 * Provider/model may appear in metadata only — departments must not branch on them.
 */
import type {
  NormalizedFailureCode,
  ProviderId,
  ReasoningStatus,
} from "./types.js";

export type ValidationResult = {
  ok: boolean;
  errors: string[];
  schema_ref?: string;
};

export type ReasoningErrorDetails = {
  code: NormalizedFailureCode;
  message: string;
  retryable: boolean;
  provider_message?: string;
};

export type ReasoningResponse = {
  request_id: string;
  provider: ProviderId;
  provider_request_id: string | null;
  /** Internal adapter identifier — for audit/cost only, not business logic. */
  model_identifier_internal: string | null;
  status: ReasoningStatus;
  structured_output: Record<string, unknown> | null;
  raw_output_reference: string | null;
  validation_result: ValidationResult;
  confidence: number | null;
  input_tokens: number | null;
  output_tokens: number | null;
  estimated_cost_usd: number | null;
  actual_cost_usd: number | null;
  latency_ms: number | null;
  retry_count: number;
  fallback_used: boolean;
  safety_flags: string[];
  error_details: ReasoningErrorDetails | null;
  completed_at: string;
};
