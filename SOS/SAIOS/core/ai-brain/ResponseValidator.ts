/**
 * Response validator — schema/shape checks (no network).
 */
import type { ReasoningResponse, ValidationResult } from "./ReasoningResponse.js";

export function validateReasoningResponseShape(
  response: ReasoningResponse,
): ValidationResult {
  const errors: string[] = [];
  if (!response.request_id) errors.push("missing request_id");
  if (!response.provider) errors.push("missing provider");
  if (!response.status) errors.push("missing status");
  if (!response.completed_at) errors.push("missing completed_at");
  if (!response.validation_result) errors.push("missing validation_result");
  if (typeof response.retry_count !== "number") errors.push("retry_count");
  if (typeof response.fallback_used !== "boolean") errors.push("fallback_used");
  return { ok: errors.length === 0, errors };
}

export function assertNoBusinessLogicOnModel(
  departmentCodeSample: string,
): boolean {
  // Heuristic for audits: departments must not switch on model identifiers
  const forbidden = [
    /openai_model/i,
    /model_name\s*===/i,
    /gpt-4/i,
    /gpt-5/i,
    /o1-/i,
  ];
  return !forbidden.some((re) => re.test(departmentCodeSample));
}
