/**
 * Resume Department consumption of Brain structured responses.
 * Does not write template JSON or publish.
 */
import type { ReasoningResponse } from "../ai-brain/ReasoningResponse.js";
import type { SkillRequest } from "../skills/Skill.js";

export type ResumeConsumedResult = {
  skill_id: string;
  task_id: string;
  status: ReasoningResponse["status"];
  provider: ReasoningResponse["provider"];
  structured_output: Record<string, unknown> | null;
  confidence: number | null;
  tokens: {
    input: number | null;
    output: number | null;
  };
  estimated_cost_usd: number | null;
  actual_cost_usd: number | null;
  model_identifier_internal: string | null;
  provider_request_id: string | null;
  fallback_used: boolean;
  notes: string[];
  template_generated: false;
  published: false;
};

export function consumeResumeResponse(
  skillRequest: SkillRequest,
  response: ReasoningResponse,
): ResumeConsumedResult {
  return {
    skill_id: skillRequest.skill_id,
    task_id: skillRequest.task_id,
    status: response.status,
    provider: response.provider,
    structured_output: response.structured_output,
    confidence: response.confidence,
    tokens: {
      input: response.input_tokens,
      output: response.output_tokens,
    },
    estimated_cost_usd: response.estimated_cost_usd,
    actual_cost_usd: response.actual_cost_usd ?? null,
    model_identifier_internal: response.model_identifier_internal ?? null,
    provider_request_id: response.provider_request_id ?? null,
    fallback_used: Boolean(response.fallback_used),
    notes: [
      "Dry-run consumption only",
      "No template JSON written",
      "No publication",
      `Skill ${skillRequest.skill_id} completed via ${response.provider}`,
    ],
    template_generated: false,
    published: false,
  };
}
