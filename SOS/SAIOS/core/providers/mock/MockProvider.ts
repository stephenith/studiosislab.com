/**
 * Mock Provider — dry-run ProviderAdapter implementation.
 * Agent #118 — no SDK, no external API, deterministic outputs.
 */
import type {
  CostEstimate,
  ProviderAdapter,
  ProviderHealth,
} from "../../ai-brain/ProviderAdapter.js";
import type { ReasoningRequest } from "../../ai-brain/ReasoningRequest.js";
import type { ReasoningResponse } from "../../ai-brain/ReasoningResponse.js";
import type { NormalizedFailureCode } from "../../ai-brain/types.js";
import { isDeterministicOnly } from "../../ai-brain/CapabilityRegistry.js";
import {
  MOCK_SUPPORTED_CAPABILITIES,
} from "./MockCapabilities.js";
import {
  buildStructuredOutput,
  estimateTokensAndCost,
  fingerprint,
  stableHash,
} from "./MockResponseFactory.js";
import { validateMockRequest, validateMockResponse } from "./MockValidator.js";

const CANCELLED = new Set<string>();

export class MockProvider implements ProviderAdapter {
  readonly provider_id = "mock" as const;
  readonly supported_capabilities = MOCK_SUPPORTED_CAPABILITIES;

  async healthCheck(): Promise<ProviderHealth> {
    return {
      provider: "mock",
      healthy: true,
      checked_at: new Date().toISOString(),
      detail: "MockProvider dry-run healthy",
    };
  }

  async validateRequest(
    request: ReasoningRequest,
  ): Promise<{ ok: boolean; errors: string[] }> {
    return validateMockRequest(request);
  }

  async estimateCost(request: ReasoningRequest): Promise<CostEstimate> {
    const e = estimateTokensAndCost(request);
    return {
      estimated_input_tokens: e.input_tokens,
      estimated_output_tokens: e.output_tokens,
      estimated_cost_usd: e.estimated_cost_usd,
      currency: "USD",
    };
  }

  async execute(request: ReasoningRequest): Promise<ReasoningResponse> {
    if (CANCELLED.has(request.request_id)) {
      return this.failed(request, "provider_unavailable", "Request cancelled", false);
    }

    const validation = await this.validateRequest(request);
    if (!validation.ok) {
      return this.failed(
        request,
        "invalid_response",
        validation.errors.join("; "),
        false,
      );
    }

    const metrics = estimateTokensAndCost(request);
    const structured = buildStructuredOutput(request);
    const completed_at = deterministicTimestamp(request);

    const response: ReasoningResponse = {
      request_id: request.request_id,
      provider: "mock",
      provider_request_id: `mock-${stableHash(fingerprint(request)).toString(16)}`,
      model_identifier_internal: "mock-deterministic-v1",
      status: "COMPLETED",
      structured_output: structured,
      raw_output_reference: null,
      validation_result: { ok: true, errors: [], schema_ref: "reasoning-response.schema.json" },
      confidence: isDeterministicOnly(request.capability) ? 1 : 0.91,
      input_tokens: metrics.input_tokens,
      output_tokens: metrics.output_tokens,
      estimated_cost_usd: metrics.estimated_cost_usd,
      actual_cost_usd: 0,
      latency_ms: metrics.latency_ms,
      retry_count: 0,
      fallback_used: false,
      safety_flags: ["dry_run", "mock_provider", "no_external_api"],
      error_details: null,
      completed_at,
    };

    const check = validateMockResponse(response);
    if (!check.ok) {
      return {
        ...response,
        status: "VALIDATION_FAILED",
        validation_result: { ok: false, errors: check.errors },
        error_details: {
          code: "schema_validation_failure",
          message: check.errors.join("; "),
          retryable: false,
        },
      };
    }

    return response;
  }

  async cancel(requestId: string): Promise<void> {
    CANCELLED.add(requestId);
  }

  async retry(
    request: ReasoningRequest,
    prior: ReasoningResponse,
  ): Promise<ReasoningResponse> {
    const next = await this.execute(request);
    return {
      ...next,
      retry_count: prior.retry_count + 1,
      fallback_used: prior.fallback_used,
    };
  }

  normalizeResponse(raw: unknown, request: ReasoningRequest): ReasoningResponse {
    if (raw && typeof raw === "object" && "request_id" in raw) {
      return raw as ReasoningResponse;
    }
    return this.failed(
      request,
      "invalid_response",
      "Unable to normalize raw mock payload",
      false,
    );
  }

  extractUsage(raw: unknown): {
    input_tokens: number | null;
    output_tokens: number | null;
    actual_cost_usd: number | null;
  } {
    if (!raw || typeof raw !== "object") {
      return { input_tokens: null, output_tokens: null, actual_cost_usd: null };
    }
    const r = raw as ReasoningResponse;
    return {
      input_tokens: r.input_tokens,
      output_tokens: r.output_tokens,
      actual_cost_usd: r.actual_cost_usd,
    };
  }

  normalizeError(error: unknown): {
    code: string;
    message: string;
    retryable: boolean;
  } {
    return {
      code: "unknown",
      message: error instanceof Error ? error.message : String(error),
      retryable: false,
    };
  }

  private failed(
    request: ReasoningRequest,
    code: NormalizedFailureCode,
    message: string,
    retryable: boolean,
  ): ReasoningResponse {
    const metrics = estimateTokensAndCost(request);
    return {
      request_id: request.request_id,
      provider: "mock",
      provider_request_id: null,
      model_identifier_internal: "mock-deterministic-v1",
      status: "FAILED",
      structured_output: null,
      raw_output_reference: null,
      validation_result: { ok: false, errors: [message] },
      confidence: 0,
      input_tokens: metrics.input_tokens,
      output_tokens: 0,
      estimated_cost_usd: 0,
      actual_cost_usd: 0,
      latency_ms: metrics.latency_ms,
      retry_count: 0,
      fallback_used: false,
      safety_flags: ["dry_run", "mock_provider"],
      error_details: { code, message, retryable },
      completed_at: deterministicTimestamp(request),
    };
  }
}

/** Fixed ISO timestamp derived from request fingerprint (deterministic). */
function deterministicTimestamp(request: ReasoningRequest): string {
  const h = stableHash(fingerprint(request));
  // Fixed base date + hash seconds for stability across runs
  const base = Date.UTC(2026, 6, 11, 8, 0, 0);
  return new Date(base + (h % 86_400_000)).toISOString();
}

export function createMockProvider(): MockProvider {
  return new MockProvider();
}
