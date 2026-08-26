/**
 * OpenAI Provider — ProviderAdapter using the official OpenAI Responses API.
 * Agent #201 — openai SDK exists ONLY in this package.
 */
import OpenAI from "openai";
import type {
  CostEstimate,
  ProviderAdapter,
  ProviderHealth,
} from "../../ai-brain/ProviderAdapter.js";
import type { ReasoningRequest } from "../../ai-brain/ReasoningRequest.js";
import type { ReasoningResponse } from "../../ai-brain/ReasoningResponse.js";
import type { NormalizedFailureCode } from "../../ai-brain/types.js";
import { OPENAI_SUPPORTED_CAPABILITIES } from "./OpenAICapabilities.js";
import {
  estimateActualCostUsd,
  estimateTokensAndCost,
} from "./OpenAIEstimate.js";
import {
  buildInputPrompt,
  textFormatForRequest,
  tryParseStructuredOutput,
  resolveModelIdentifier,
  type OpenAIResponsesCreateResult,
} from "./OpenAIResponseFactory.js";
import {
  validateOpenAIRequest,
  validateOpenAIResponse,
} from "./OpenAIValidator.js";

/** Minimal Responses API surface — injectable for Founder verify without network. */
export type OpenAIResponsesClient = {
  responses: {
    create: (body: {
      model: string;
      input: string;
      max_output_tokens?: number;
      text?: {
        format?: {
          type: string;
          name?: string;
          schema?: Record<string, unknown>;
          strict?: boolean;
        };
      };
    }) => Promise<OpenAIResponsesCreateResult>;
  };
};

const CANCELLED = new Set<string>();

export class OpenAIProvider implements ProviderAdapter {
  readonly provider_id = "openai" as const;
  readonly supported_capabilities = OPENAI_SUPPORTED_CAPABILITIES;

  private readonly client: OpenAIResponsesClient;

  constructor(client?: OpenAIResponsesClient) {
    this.client =
      client ??
      (new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      }) as unknown as OpenAIResponsesClient);
  }

  async healthCheck(): Promise<ProviderHealth> {
    const key = Boolean(process.env.OPENAI_API_KEY?.trim());
    const founder = process.env.SOS_AI_FOUNDER_OPENAI_ONE_TEST === "1";
    const liveOff = process.env.SOS_AIOS_LIVE !== "1";
    return {
      provider: "openai",
      healthy: key && founder && liveOff,
      checked_at: new Date().toISOString(),
      detail: key
        ? founder
          ? liveOff
            ? "OpenAI adapter ready for Founder one-test"
            : "LIVE must be OFF"
          : "Founder one-test flag required"
        : "OPENAI_API_KEY missing",
    };
  }

  async validateRequest(
    request: ReasoningRequest,
  ): Promise<{ ok: boolean; errors: string[] }> {
    return validateOpenAIRequest(request);
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
      return this.failed(
        request,
        "provider_unavailable",
        "Request cancelled",
        false,
      );
    }

    const validation = await this.validateRequest(request);
    if (!validation.ok) {
      return this.failed(
        request,
        validation.errors.some((e) => e.includes("privacy"))
          ? "privacy_policy_blocked"
          : validation.errors.some((e) => e.includes("OPENAI_API_KEY"))
            ? "authentication_failure"
            : "provider_disabled",
        validation.errors.join("; "),
        false,
      );
    }

    const estimate = estimateTokensAndCost(request);
    const model = resolveModelIdentifier();
    const started = Date.now();

    try {
      const raw = await this.client.responses.create({
        model,
        input: buildInputPrompt(request),
        max_output_tokens: request.maximum_output_tokens,
        text: { format: textFormatForRequest(request) },
      });

      const latency_ms = Date.now() - started;
      const input_tokens = raw.usage?.input_tokens ?? estimate.input_tokens;
      const output_tokens = raw.usage?.output_tokens ?? estimate.output_tokens;
      const incompleteReason = raw.incomplete_details?.reason ?? null;
      const responseStatus = raw.status ?? null;

      const parsed = tryParseStructuredOutput(raw.output_text ?? "", request, {
        response_status: responseStatus,
        incomplete_reason: incompleteReason,
        provider_request_id: raw.id ?? null,
        output_tokens,
      });

      if (!parsed.ok) {
        return this.failed(
          request,
          "invalid_response",
          parsed.message,
          false,
          {
            provider_request_id: raw.id ?? null,
            input_tokens,
            output_tokens,
            actual_cost_usd: estimateActualCostUsd(input_tokens, output_tokens),
            latency_ms,
            safety_flags: [
              "openai_responses_api",
              "founder_one_test",
              "live_off",
              "no_publication",
              parsed.code,
            ],
          },
        );
      }

      const actual_cost_usd = estimateActualCostUsd(input_tokens, output_tokens);

      try {
        const { appendCostLedgerEntry } = await import(
          "../../ai-brain/CostLedger.js"
        );
        appendCostLedgerEntry({
          usd: actual_cost_usd,
          provider: "openai",
          purpose: "openai_provider_execute",
          tokens_in: input_tokens,
          tokens_out: output_tokens,
          meta: { request_id: request.request_id, model },
        });
      } catch {
        /* ledger fail-open */
      }

      const response: ReasoningResponse = {
        request_id: request.request_id,
        provider: "openai",
        provider_request_id: raw.id ?? null,
        model_identifier_internal: raw.model ?? model,
        status: "COMPLETED",
        structured_output: parsed.structured,
        raw_output_reference: null,
        validation_result: {
          ok: true,
          errors: [],
          schema_ref: "reasoning-response.schema.json",
        },
        confidence: 0.85,
        input_tokens,
        output_tokens,
        estimated_cost_usd: estimate.estimated_cost_usd,
        actual_cost_usd,
        latency_ms,
        retry_count: 0,
        fallback_used: false,
        safety_flags: [
          "openai_responses_api",
          "founder_one_test",
          "live_off",
          "no_publication",
        ],
        error_details: null,
        completed_at: new Date().toISOString(),
      };

      const check = validateOpenAIResponse(response);
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
    } catch (error) {
      const normalized = this.normalizeError(error);
      return this.failed(
        request,
        mapFailureCode(normalized.code),
        normalized.message,
        normalized.retryable,
      );
    }
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
    if (raw && typeof raw === "object" && "output_text" in raw) {
      const api = raw as OpenAIResponsesCreateResult;
      const estimate = estimateTokensAndCost(request);
      const input_tokens = api.usage?.input_tokens ?? estimate.input_tokens;
      const output_tokens = api.usage?.output_tokens ?? estimate.output_tokens;
      const parsed = tryParseStructuredOutput(api.output_text ?? "", request, {
        response_status: api.status ?? null,
        incomplete_reason: api.incomplete_details?.reason ?? null,
        provider_request_id: api.id ?? null,
        output_tokens,
      });
      if (!parsed.ok) {
        return this.failed(
          request,
          "invalid_response",
          parsed.message,
          false,
          {
            provider_request_id: api.id ?? null,
            input_tokens,
            output_tokens,
            actual_cost_usd: estimateActualCostUsd(input_tokens, output_tokens),
            safety_flags: [
              "openai_responses_api",
              "normalized_from_raw",
              parsed.code,
            ],
          },
        );
      }
      return {
        request_id: request.request_id,
        provider: "openai",
        provider_request_id: api.id ?? null,
        model_identifier_internal: api.model ?? resolveModelIdentifier(),
        status: "COMPLETED",
        structured_output: parsed.structured,
        raw_output_reference: null,
        validation_result: {
          ok: true,
          errors: [],
          schema_ref: "reasoning-response.schema.json",
        },
        confidence: 0.85,
        input_tokens,
        output_tokens,
        estimated_cost_usd: estimate.estimated_cost_usd,
        actual_cost_usd: estimateActualCostUsd(input_tokens, output_tokens),
        latency_ms: 0,
        retry_count: 0,
        fallback_used: false,
        safety_flags: ["openai_responses_api", "normalized_from_raw"],
        error_details: null,
        completed_at: new Date().toISOString(),
      };
    }
    return this.failed(
      request,
      "invalid_response",
      "Unable to normalize raw OpenAI payload",
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
    if ("input_tokens" in raw) {
      const r = raw as ReasoningResponse;
      return {
        input_tokens: r.input_tokens,
        output_tokens: r.output_tokens,
        actual_cost_usd: r.actual_cost_usd,
      };
    }
    const api = raw as OpenAIResponsesCreateResult;
    const input_tokens = api.usage?.input_tokens ?? null;
    const output_tokens = api.usage?.output_tokens ?? null;
    return {
      input_tokens,
      output_tokens,
      actual_cost_usd:
        input_tokens != null && output_tokens != null
          ? estimateActualCostUsd(input_tokens, output_tokens)
          : null,
    };
  }

  normalizeError(error: unknown): {
    code: string;
    message: string;
    retryable: boolean;
  } {
    const message = error instanceof Error ? error.message : String(error);
    const lower = message.toLowerCase();
    if (lower.includes("rate") || lower.includes("429")) {
      return { code: "rate_limit", message, retryable: true };
    }
    if (lower.includes("timeout") || lower.includes("timed out")) {
      return { code: "timeout", message, retryable: true };
    }
    if (
      lower.includes("auth") ||
      lower.includes("api key") ||
      lower.includes("401") ||
      lower.includes("403")
    ) {
      return { code: "authentication_failure", message, retryable: false };
    }
    return { code: "unknown", message, retryable: false };
  }

  private failed(
    request: ReasoningRequest,
    code: NormalizedFailureCode,
    message: string,
    retryable: boolean,
    extras?: {
      provider_request_id?: string | null;
      input_tokens?: number;
      output_tokens?: number;
      actual_cost_usd?: number;
      latency_ms?: number;
      safety_flags?: string[];
    },
  ): ReasoningResponse {
    const metrics = estimateTokensAndCost(request);
    return {
      request_id: request.request_id,
      provider: "openai",
      provider_request_id: extras?.provider_request_id ?? null,
      model_identifier_internal: resolveModelIdentifier(),
      status: "FAILED",
      structured_output: null,
      raw_output_reference: null,
      validation_result: { ok: false, errors: [message] },
      confidence: 0,
      input_tokens: extras?.input_tokens ?? metrics.input_tokens,
      output_tokens: extras?.output_tokens ?? 0,
      estimated_cost_usd: 0,
      actual_cost_usd: extras?.actual_cost_usd ?? 0,
      latency_ms: extras?.latency_ms ?? 0,
      retry_count: 0,
      fallback_used: false,
      safety_flags: extras?.safety_flags ?? ["openai_provider", "failed"],
      error_details: { code, message, retryable },
      completed_at: new Date().toISOString(),
    };
  }
}

function mapFailureCode(code: string): NormalizedFailureCode {
  const allowed: NormalizedFailureCode[] = [
    "provider_unavailable",
    "timeout",
    "rate_limit",
    "invalid_response",
    "schema_validation_failure",
    "budget_exceeded",
    "safety_refusal",
    "authentication_failure",
    "local_endpoint_unavailable",
    "deterministic_capability_rejected",
    "privacy_policy_blocked",
    "provider_disabled",
    "unknown",
  ];
  return (allowed.includes(code as NormalizedFailureCode)
    ? code
    : "unknown") as NormalizedFailureCode;
}

export function createOpenAIProvider(
  client?: OpenAIResponsesClient,
): OpenAIProvider {
  return new OpenAIProvider(client);
}
