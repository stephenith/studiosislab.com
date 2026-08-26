/**
 * Normalize OpenAI Responses API payloads → ReasoningResponse structured_output.
 * Agent #201
 */
import type { ReasoningRequest } from "../../ai-brain/ReasoningRequest.js";
import { ALLOWED_OPS_ENUM } from "../../founder-revision/allowedCanvasOps.js";

export type OpenAIResponsesCreateResult = {
  id?: string;
  model?: string;
  output_text?: string;
  /** Responses API status: completed | incomplete | failed | … */
  status?: string | null;
  incomplete_details?: { reason?: string | null } | null;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    total_tokens?: number;
  } | null;
};

/**
 * Founder revision-plan JSON Schema (API structured outputs).
 * `op` is an exact allowlist enum — no synonyms (e.g. un-group_objects).
 * Business rules remain in validateRevisionPlan.
 * strict:false — operation variants / additionalProperties are incompatible with strict:true.
 */
export const REVISION_PLANNING_JSON_SCHEMA = {
  type: "object",
  additionalProperties: true,
  required: ["schema_version", "summary", "operations"],
  properties: {
    schema_version: { type: "string" },
    summary: { type: "string" },
    notes: { type: "array", items: { type: "string" } },
    operations: {
      type: "array",
      minItems: 1,
      items: {
        type: "object",
        additionalProperties: true,
        required: [
          "op",
          "values",
          "founder_feedback_item",
          "confidence",
          "intended_change",
          "before_summary",
        ],
        properties: {
          op: {
            type: "string",
            enum: [...ALLOWED_OPS_ENUM],
          },
          target_id: { type: "string" },
          target_ids: { type: "array", items: { type: "string" } },
          selector: { type: "object", additionalProperties: true },
          values: { type: "object", additionalProperties: true },
          founder_feedback_item: { type: "string" },
          founder_feedback_items: {
            type: "array",
            items: { type: "string" },
          },
          confidence: { type: "number" },
          intended_change: { type: "string" },
          before_summary: { type: "string" },
        },
      },
    },
  },
} as const;

/**
 * CoveragePlanRepair-only schema (additive repair ops).
 * Same outer RevisionPlan shape; operations minItems ≥ 1.
 * Required per-op metadata includes founder_feedback_item + confidence.
 *
 * Enforcement level: json_schema with strict:false (optional targeting fields /
 * additionalProperties are incompatible with OpenAI strict:true). Local
 * validateRevisionPlan remains the authoritative fail-closed gate.
 */
export const REVISION_COVERAGE_REPAIR_JSON_SCHEMA = {
  type: "object",
  additionalProperties: true,
  required: ["schema_version", "summary", "operations"],
  properties: {
    schema_version: { type: "string" },
    summary: { type: "string" },
    notes: { type: "array", items: { type: "string" } },
    operations: {
      type: "array",
      minItems: 1,
      items: {
        type: "object",
        additionalProperties: true,
        required: [
          "op",
          "values",
          "founder_feedback_item",
          "confidence",
          "intended_change",
          "before_summary",
        ],
        properties: {
          op: {
            type: "string",
            enum: [...ALLOWED_OPS_ENUM],
          },
          target_id: { type: "string" },
          target_ids: { type: "array", items: { type: "string" } },
          values: { type: "object", additionalProperties: true },
          founder_feedback_item: { type: "string" },
          founder_feedback_items: {
            type: "array",
            items: { type: "string" },
          },
          confidence: { type: "number" },
          intended_change: { type: "string" },
          before_summary: { type: "string" },
        },
      },
    },
  },
} as const;

function isRevisionPlanCapability(capability: string): boolean {
  return (
    capability === "revision_planning" ||
    capability === "revision_coverage_repair"
  );
}

export type StructuredParseOk = {
  ok: true;
  structured: Record<string, unknown>;
};

export type StructuredParseFail = {
  ok: false;
  code: "revision_planning_incomplete_json" | "openai_output_truncated";
  message: string;
  diagnostics: {
    capability: string;
    output_text_length: number;
    response_status: string | null;
    incomplete_reason: string | null;
    max_output_tokens: number | null;
    provider_request_id: string | null;
    output_tokens: number | null;
  };
};

export type StructuredParseResult = StructuredParseOk | StructuredParseFail;

export function buildInputPrompt(request: ReasoningRequest): string {
  if (isRevisionPlanCapability(request.capability)) {
    const opsNote =
      request.capability === "revision_coverage_repair"
        ? "- operations (non-empty array of ADDITIONAL repair operation objects only; minItems ≥ 1)"
        : "- operations (non-empty array of operation objects)";
    return [
      `Capability: ${request.capability}`,
      `Department: ${request.department}`,
      `Objective: ${request.objective}`,
      `Instructions: ${request.instructions}`,
      `Privacy: ${request.privacy_classification}`,
      "Return a single JSON object only (no markdown fences).",
      "The JSON MUST be the founder canvas revision plan with exactly these top-level keys:",
      '- schema_version (string, e.g. "founder-canvas-revision-plan-1.0.0")',
      "- summary (string)",
      opsNote,
      "- notes (optional string array)",
      "Do NOT wrap the plan inside another object.",
      "Do NOT include resume sample payloads, capability, or provider fields.",
      "Do NOT put the plan JSON inside a summary string.",
      "Output must be complete, valid JSON that can be parsed as a single object.",
    ].join("\n");
  }

  const resumeContentSchema = [
    "Also include key resume_content (required for resume templates) as a single fictional RoleSample object with:",
    "name, title, contact (single string with · separators — never an object), summary,",
    "roles (array of 2–3 objects: title, company, dates, bullets[3–4 measurable achievements]),",
    "skills (single string with · separators, or string array), education (string array),",
    "certifications (string array), projects (array of {title, detail}), languages (string).",
    "Use a unique fictional full name for this role (do not reuse Morgan Ellis / Alex Morgan / Casey Rivera).",
    "Every person, company, school, and credential must be clearly fictional sample data.",
    "Do not reuse generic filler like 'Sample Initiative'.",
    "Do not repeat identical companies or bullet text across roles.",
    "Make achievements role-specific and credible (not nonsensical metrics).",
  ].join(" ");

  return [
    `Capability: ${request.capability}`,
    `Department: ${request.department}`,
    `Objective: ${request.objective}`,
    `Instructions: ${request.instructions}`,
    `Privacy: ${request.privacy_classification}`,
    "Return a single JSON object only (no markdown). Include keys: summary, notes (string array), capability, resume_content, and any planning fields relevant to the capability.",
    resumeContentSchema,
    "Use fictional sample content only. Do not invent real personal data.",
  ].join("\n");
}

export function textFormatForRequest(
  request: ReasoningRequest,
): { type: string; name?: string; schema?: Record<string, unknown>; strict?: boolean } {
  if (request.capability === "revision_coverage_repair") {
    return {
      type: "json_schema",
      name: "founder_canvas_coverage_repair_plan",
      schema: REVISION_COVERAGE_REPAIR_JSON_SCHEMA as unknown as Record<
        string,
        unknown
      >,
      // strict:false — target_id vs target_ids optionality / additionalProperties
      // incompatible with OpenAI strict:true. Local validation is fail-closed.
      strict: false,
    };
  }
  if (request.capability === "revision_planning") {
    return {
      type: "json_schema",
      name: "founder_canvas_revision_plan",
      schema: REVISION_PLANNING_JSON_SCHEMA as unknown as Record<string, unknown>,
      strict: false,
    };
  }
  return { type: "json_object" };
}

function tryParseJsonObject(
  text: string,
): Record<string, unknown> | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    /* try fenced */
  }
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)```$/i);
  if (fenced?.[1]) {
    try {
      const parsed = JSON.parse(fenced[1].trim()) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      /* fail */
    }
  }
  return null;
}

/**
 * Parse model output into structured_output.
 * revision_planning: fail closed on incomplete/non-JSON (no synthetic summary wrapper).
 * Other capabilities: preserve legacy summary-wrapper fallback.
 */
export function tryParseStructuredOutput(
  outputText: string,
  request: ReasoningRequest,
  meta?: {
    response_status?: string | null;
    incomplete_reason?: string | null;
    provider_request_id?: string | null;
    output_tokens?: number | null;
  },
): StructuredParseResult {
  const trimmed = outputText.trim();
  const incompleteReason = meta?.incomplete_reason ?? null;
  const responseStatus = meta?.response_status ?? null;
  const diagnostics = {
    capability: request.capability,
    output_text_length: trimmed.length,
    response_status: responseStatus,
    incomplete_reason: incompleteReason,
    max_output_tokens: request.maximum_output_tokens ?? null,
    provider_request_id: meta?.provider_request_id ?? null,
    output_tokens: meta?.output_tokens ?? null,
  };

  const apiIncomplete =
    responseStatus === "incomplete" ||
    incompleteReason === "max_output_tokens" ||
    incompleteReason === "content_filter";

  if (isRevisionPlanCapability(request.capability)) {
    if (apiIncomplete) {
      return {
        ok: false,
        code: "openai_output_truncated",
        message: `openai_output_truncated: ${JSON.stringify(diagnostics)}`,
        diagnostics,
      };
    }
    const parsed = tryParseJsonObject(trimmed);
    if (!parsed) {
      return {
        ok: false,
        code: "revision_planning_incomplete_json",
        message: `revision_planning_incomplete_json: ${JSON.stringify(diagnostics)}`,
        diagnostics,
      };
    }
    return {
      ok: true,
      structured: {
        ...parsed,
        capability: request.capability,
        provider: "openai",
      },
    };
  }

  const parsed = tryParseJsonObject(trimmed);
  if (parsed) {
    return {
      ok: true,
      structured: {
        ...parsed,
        capability: request.capability,
        provider: "openai",
      },
    };
  }

  // Legacy fallback for non-revision capabilities only.
  return {
    ok: true,
    structured: {
      capability: request.capability,
      provider: "openai",
      summary: trimmed.slice(0, 4000),
      notes: ["openai_response_was_not_json_object"],
    },
  };
}

/** @deprecated Prefer tryParseStructuredOutput — kept for narrow call sites. */
export function parseStructuredOutput(
  outputText: string,
  request: ReasoningRequest,
): Record<string, unknown> {
  const result = tryParseStructuredOutput(outputText, request);
  if (result.ok) return result.structured;
  // Fail-closed path should not be used via this helper for revision_planning.
  return {
    capability: request.capability,
    provider: "openai",
    summary: "",
    notes: [result.code],
    parse_error: result.message,
  };
}

export function resolveModelIdentifier(): string {
  const fromEnv = process.env.SOS_AI_OPENAI_MODEL?.trim();
  // Internal adapter identifier only — never exposed on ReasoningRequest.
  return fromEnv && fromEnv.length > 0 ? fromEnv : "gpt-4.1-mini";
}
