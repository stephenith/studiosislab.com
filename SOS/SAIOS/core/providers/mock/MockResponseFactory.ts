/**
 * Deterministic mock response payloads per capability.
 * Same capability + objective always yields the same structured_output.
 * Agent #118 — no randomness, no network.
 */
import type { ReasoningRequest } from "../../ai-brain/ReasoningRequest.js";
import type { BrainCapability } from "../../ai-brain/types.js";

/** Stable non-crypto hash for deterministic metrics. */
export function stableHash(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function fingerprint(request: ReasoningRequest): string {
  return [
    request.capability,
    request.objective,
    request.instructions,
    request.quality_tier,
    request.department,
  ].join("|");
}

function baseMeta(capability: BrainCapability, fp: string) {
  return {
    mock: true,
    capability,
    fingerprint: fp,
    dry_run: true,
  };
}

export function buildStructuredOutput(
  request: ReasoningRequest,
): Record<string, unknown> {
  const fp = fingerprint(request);
  const capability = request.capability;
  const meta = baseMeta(capability, fp);

  switch (capability) {
    case "design_planning":
      return {
        ...meta,
        plan_type: "design_planning",
        sections: ["header", "summary", "experience", "skills", "education"],
        layout: {
          columns: 1,
          margins_mm: { top: 12, right: 12, bottom: 12, left: 12 },
          page_size: "A4",
        },
        typography: {
          heading: "Inter",
          body: "Inter",
          scale: ["24", "14", "11"],
        },
        notes: [
          "Mock design plan for dry-run validation",
          "Use fictional sample content only",
        ],
      };

    case "founder_feedback_interpretation":
      return {
        ...meta,
        plan_type: "revision_from_founder_feedback",
        interpretation: "Mock interpretation of structured founder feedback",
        revision_actions: [
          { area: "spacing", action: "increase section gaps by 4px" },
          { area: "typography", action: "normalize body size to 11pt" },
          { area: "ats", action: "ensure single-column text flow" },
        ],
        priority_order: ["ats", "spacing", "typography"],
      };

    case "complex_visual_critique":
      return {
        ...meta,
        critique: {
          hierarchy: "acceptable",
          contrast: "acceptable",
          whitespace: "needs_revision",
          overall: "REVISION",
        },
        issues: ["Mock: tighten vertical rhythm in experience block"],
        approval_prediction: "REVISION",
      };

    case "failure_diagnosis":
      return {
        ...meta,
        diagnosis: "Mock failure diagnosis — pipeline stage timeout simulated",
        root_cause: "dry_run_fixture",
        suggested_fix: ["retry stage", "check artifact path"],
        severity: "low",
      };

    case "production_strategy":
      return {
        ...meta,
        strategy: "one_template_per_cycle",
        gates: ["G0", "G1"],
        recommendations: ["Keep batch_size=1", "Require founder approval"],
      };

    case "revision_planning":
    case "revision_coverage_repair":
      return {
        ...meta,
        revision_plan: [
          { step: 1, change: "Adjust margins" },
          { step: 2, change: "Re-run ATS checks" },
          { step: 3, change: "Resubmit to approval queue" },
        ],
      };

    case "task_classification":
      return {
        ...meta,
        class: "resume_production",
        labels: ["template", "dry_run"],
        confidence_note: "mock_deterministic",
      };

    case "structured_json_generation":
      return {
        ...meta,
        json_plan: {
          pages: 1,
          objects: ["text:name", "text:summary", "group:experience"],
        },
      };

    case "report_summarization":
      return {
        ...meta,
        report: {
          title: "Mock Report Summary",
          bullets: [
            "Pipeline dry-run completed",
            "No external API calls",
            "Awaiting founder review before LIVE",
          ],
          status: "DRY_RUN_OK",
        },
      };

    case "log_interpretation":
      return {
        ...meta,
        interpretation: "Mock log cluster: heartbeat fresh, no critical errors",
        signals: ["heartbeat_ok", "queue_idle"],
      };

    case "duplicate_explanation":
      return {
        ...meta,
        is_duplicate: false,
        similarity: 0.12,
        explanation: "Mock: candidate sufficiently distinct from catalog peers",
      };

    case "status_reporting":
      return {
        ...meta,
        status: "READY",
        summary: "Mock status report — AIOS dry-run healthy",
      };

    case "scheduling":
    case "time_tracking":
    case "catalog_id_assignment":
    case "checksum":
    case "dimension_validation":
    case "ats_rule_validation":
    case "publication_gate":
    case "server_monitoring":
    case "cost_arithmetic":
      return {
        ...meta,
        code_path_required: true,
        message:
          "Deterministic capability — Mock acknowledges but Brain Router rejects provider routing by policy",
        capability,
      };

    default:
      return {
        ...meta,
        message: `Mock structured output for capability ${capability}`,
      };
  }
}

export function estimateTokensAndCost(request: ReasoningRequest): {
  input_tokens: number;
  output_tokens: number;
  estimated_cost_usd: number;
  latency_ms: number;
} {
  const h = stableHash(fingerprint(request));
  const input_tokens = 80 + (h % 40);
  const output_tokens = 120 + (h % 80);
  // Deterministic fake micro-cost for ledger dry-run only
  const estimated_cost_usd = Number(
    ((input_tokens + output_tokens) * 0.000001).toFixed(6),
  );
  const latency_ms = 5 + (h % 20);
  return { input_tokens, output_tokens, estimated_cost_usd, latency_ms };
}
