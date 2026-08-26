/**
 * Request estimation for OpenAI adapter (estimation ≠ Cost Ledger accounting).
 * Agent #201
 */
import type { ReasoningRequest } from "../../ai-brain/ReasoningRequest.js";

/** Rough USD per 1M tokens — internal estimate only; not billing. */
const EST_INPUT_USD_PER_1M = 0.4;
const EST_OUTPUT_USD_PER_1M = 1.6;

export function estimateTokensAndCost(request: ReasoningRequest): {
  input_tokens: number;
  output_tokens: number;
  estimated_cost_usd: number;
} {
  const inputChars =
    request.objective.length +
    request.instructions.length +
    JSON.stringify(request.context_references).length;
  const input_tokens = Math.min(
    request.maximum_input_tokens,
    Math.max(32, Math.ceil(inputChars / 4)),
  );
  const output_tokens = Math.min(
    request.maximum_output_tokens,
    Math.max(64, Math.ceil(input_tokens * 0.5)),
  );
  const estimated_cost_usd =
    (input_tokens / 1_000_000) * EST_INPUT_USD_PER_1M +
    (output_tokens / 1_000_000) * EST_OUTPUT_USD_PER_1M;
  return {
    input_tokens,
    output_tokens,
    estimated_cost_usd: Number(estimated_cost_usd.toFixed(6)),
  };
}

export function estimateActualCostUsd(
  input_tokens: number,
  output_tokens: number,
): number {
  const usd =
    (input_tokens / 1_000_000) * EST_INPUT_USD_PER_1M +
    (output_tokens / 1_000_000) * EST_OUTPUT_USD_PER_1M;
  return Number(usd.toFixed(6));
}
