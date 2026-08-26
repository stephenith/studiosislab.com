/**
 * Provider Adapter interface — no vendor SDK imports.
 * Agent #117 — contract only.
 */
import type { ReasoningRequest } from "./ReasoningRequest.js";
import type { ReasoningResponse } from "./ReasoningResponse.js";
import type { BrainCapability, ProviderId } from "./types.js";

export type ProviderHealth = {
  provider: ProviderId;
  healthy: boolean;
  checked_at: string;
  detail?: string;
};

export type CostEstimate = {
  estimated_input_tokens: number;
  estimated_output_tokens: number;
  estimated_cost_usd: number | null;
  currency: "USD";
};

export interface ProviderAdapter {
  readonly provider_id: ProviderId;
  readonly supported_capabilities: readonly BrainCapability[];

  healthCheck(): Promise<ProviderHealth>;
  validateRequest(request: ReasoningRequest): Promise<{ ok: boolean; errors: string[] }>;
  estimateCost(request: ReasoningRequest): Promise<CostEstimate>;
  execute(request: ReasoningRequest): Promise<ReasoningResponse>;
  cancel(requestId: string): Promise<void>;
  retry(request: ReasoningRequest, prior: ReasoningResponse): Promise<ReasoningResponse>;
  normalizeResponse(raw: unknown, request: ReasoningRequest): ReasoningResponse;
  extractUsage(raw: unknown): {
    input_tokens: number | null;
    output_tokens: number | null;
    actual_cost_usd: number | null;
  };
  normalizeError(error: unknown): {
    code: string;
    message: string;
    retryable: boolean;
  };
}

export type PlannedAdapter = {
  id: ProviderId;
  label: string;
  implemented: boolean;
  note: string;
};

export const PLANNED_ADAPTERS: readonly PlannedAdapter[] = [
  {
    id: "mock",
    label: "Mock Provider",
    implemented: true,
    note: "Implemented Agent #118 — dry-run deterministic only",
  },
  {
    id: "openai",
    label: "OpenAI Provider",
    implemented: true,
    note: "Implemented Agent #201 — Responses API; disabled until Founder enables registry + budgets + credentials",
  },
  {
    id: "local",
    label: "Local Model Provider",
    implemented: false,
    note: "Future on-prem / local GPU machine",
  },
  {
    id: "future_provider",
    label: "Future Provider",
    implemented: false,
    note: "Placeholder for additional vendors",
  },
] as const;
