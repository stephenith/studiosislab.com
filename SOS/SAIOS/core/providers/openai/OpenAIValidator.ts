/**
 * OpenAI request/response validation helpers.
 * Agent #201
 */
import type { ReasoningRequest } from "../../ai-brain/ReasoningRequest.js";
import type { ReasoningResponse } from "../../ai-brain/ReasoningResponse.js";
import { validateReasoningResponseShape } from "../../ai-brain/ResponseValidator.js";
import { canFallbackToExternal } from "../../ai-brain/FallbackPolicy.js";
import { isOpenAISupported } from "./OpenAICapabilities.js";

export function validateOpenAIRequest(request: ReasoningRequest): {
  ok: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  if (!request.request_id) errors.push("missing request_id");
  if (!request.capability) errors.push("missing capability");
  if (!isOpenAISupported(request.capability)) {
    errors.push(`unsupported capability for openai: ${request.capability}`);
  }
  if ("model" in (request as object) || "model_name" in (request as object)) {
    errors.push("model names forbidden on ReasoningRequest");
  }
  if (request.dry_run) {
    errors.push("openai adapter rejects dry_run=true (use mock)");
  }
  if (!canFallbackToExternal(request.privacy_classification)) {
    errors.push(
      `privacy_classification ${request.privacy_classification} blocks external providers`,
    );
  }
  if (process.env.SOS_AIOS_LIVE === "1") {
    errors.push("LIVE must remain OFF for OpenAI V1 founder single-test path");
  }
  if (!process.env.OPENAI_API_KEY?.trim()) {
    errors.push("OPENAI_API_KEY is required");
  }
  if (process.env.SOS_AI_FOUNDER_OPENAI_ONE_TEST !== "1") {
    errors.push(
      "SOS_AI_FOUNDER_OPENAI_ONE_TEST=1 required for Founder-authorized single test",
    );
  }
  return { ok: errors.length === 0, errors };
}

export function validateOpenAIResponse(response: ReasoningResponse): {
  ok: boolean;
  errors: string[];
} {
  const shape = validateReasoningResponseShape(response);
  const errors = [...shape.errors];
  if (response.provider !== "openai") errors.push("provider must be openai");
  if (response.structured_output === null && response.status === "COMPLETED") {
    errors.push("COMPLETED requires structured_output");
  }
  return { ok: errors.length === 0, errors };
}
