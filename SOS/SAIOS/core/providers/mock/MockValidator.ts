/**
 * Mock request/response validation helpers.
 */
import type { ReasoningRequest } from "../../ai-brain/ReasoningRequest.js";
import type { ReasoningResponse } from "../../ai-brain/ReasoningResponse.js";
import { validateReasoningResponseShape } from "../../ai-brain/ResponseValidator.js";
import { isMockSupported } from "./MockCapabilities.js";

export function validateMockRequest(request: ReasoningRequest): {
  ok: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  if (!request.request_id) errors.push("missing request_id");
  if (!request.capability) errors.push("missing capability");
  if (!isMockSupported(request.capability)) {
    errors.push(`unsupported capability: ${request.capability}`);
  }
  if ("model" in (request as object) || "model_name" in (request as object)) {
    errors.push("model names forbidden on ReasoningRequest");
  }
  return { ok: errors.length === 0, errors };
}

export function validateMockResponse(response: ReasoningResponse): {
  ok: boolean;
  errors: string[];
} {
  const shape = validateReasoningResponseShape(response);
  const errors = [...shape.errors];
  if (response.provider !== "mock") errors.push("provider must be mock");
  if (response.structured_output === null && response.status === "COMPLETED") {
    errors.push("COMPLETED requires structured_output");
  }
  if (typeof response.confidence !== "number") errors.push("confidence required");
  if (typeof response.input_tokens !== "number") errors.push("input_tokens");
  if (typeof response.output_tokens !== "number") errors.push("output_tokens");
  if (typeof response.estimated_cost_usd !== "number") {
    errors.push("estimated_cost_usd");
  }
  if (typeof response.latency_ms !== "number") errors.push("latency_ms");
  if (response.model_identifier_internal !== "mock-deterministic-v1") {
    errors.push("unexpected model_identifier_internal");
  }
  return { ok: errors.length === 0, errors };
}
