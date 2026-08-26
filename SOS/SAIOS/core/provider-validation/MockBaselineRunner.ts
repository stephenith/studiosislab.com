/**
 * MockBaselineRunner — run frozen package through Mock Provider only.
 */
import { createHash, randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { MockProvider } from "../providers/mock/MockProvider.js";
import type { ReasoningRequest } from "../ai-brain/ReasoningRequest.js";
import type { MockBaselineResult, ValidationInputPackage } from "./types.js";

export class MockBaselineRunner {
  constructor(
    private readonly repoRoot = resolve(import.meta.dirname, "../../../.."),
    private readonly mock = new MockProvider(),
  ) {}

  async run(pkg: ValidationInputPackage): Promise<MockBaselineResult> {
    const started = Date.now();
    const request: ReasoningRequest = {
      request_id: `mock-base-${pkg.validation_id}`,
      task_id: pkg.task_id,
      department: pkg.department,
      capability: "design_planning",
      objective: pkg.objective,
      instructions: `Skill:design_planning; skill_id=${pkg.skill_request.skill_id}; knowledge_snapshot=${pkg.knowledge_snapshot_id ?? "none"}`,
      context_references: [...pkg.knowledge_snapshot_references],
      memory_references: [],
      expected_response_schema: pkg.expected_structured_response_schema,
      quality_tier: "strong",
      priority: "normal",
      maximum_input_tokens: 4000,
      maximum_output_tokens: 4000,
      estimated_cost_ceiling_usd: null,
      timeout_ms: 30_000,
      retry_policy: { max_retries: 0, backoff_ms: 0, retry_on: [] },
      fallback_policy: {
        enabled: false,
        allow_provider_fallback: false,
        allow_local_to_api: false,
        respect_privacy: true,
        respect_budget: true,
        respect_founder_gates: true,
        respect_live_gates: true,
      },
      privacy_classification: "INTERNAL",
      created_at: pkg.created_at,
      deadline: null,
      dry_run: true,
      founder_approval_requirement: true,
      metadata: {
        validation_id: pkg.validation_id,
        input_checksum: pkg.input_checksum,
        provider_prompt_locked: true,
      },
    };

    const response = await this.mock.execute(request);
    const duration = Date.now() - started;

    const cycleDir = join(
      this.repoRoot,
      "SOS/07_LOGS/saios/first-production-cycle",
    );
    const readRel = (name: string) => {
      const p = join(cycleDir, name);
      return existsSync(p)
        ? `SOS/07_LOGS/saios/first-production-cycle/${name}`
        : null;
    };

    const editor = existsSync(join(cycleDir, "editor-compatibility.json"))
      ? JSON.parse(
          readFileSync(join(cycleDir, "editor-compatibility.json"), "utf8"),
        )
      : { pass: true, note: "fixture_or_missing" };
    const critic = existsSync(join(cycleDir, "critic.json"))
      ? JSON.parse(readFileSync(join(cycleDir, "critic.json"), "utf8"))
      : null;
    const gate = existsSync(join(cycleDir, "gate.json"))
      ? JSON.parse(readFileSync(join(cycleDir, "gate.json"), "utf8"))
      : null;

    const deterministic_checksum = createHash("sha256")
      .update(
        JSON.stringify({
          validation_id: pkg.validation_id,
          input_checksum: pkg.input_checksum,
          provider: "mock",
          status: response.status,
          structured: response.structured_output,
        }),
      )
      .digest("hex");

    return {
      baseline_id: `mbl-${randomUUID().slice(0, 12)}`,
      validation_id: pkg.validation_id,
      provider: "mock",
      normalized_response: response,
      validation_result: response.validation_result ?? {
        ok: response.status === "COMPLETED",
        errors: [],
      },
      designbrief_reference: readRel("designbrief.json"),
      render_instructions_reference: readRel("resume-json-instructions.json"),
      canvas_json_reference: readRel("canvas.json"),
      editor_compatibility: editor,
      critic_scores: critic,
      critic_gate: gate,
      execution_duration_ms: duration,
      estimated_tokens:
        (response.input_tokens ?? 0) + (response.output_tokens ?? 0),
      cost_usd: 0,
      deterministic_checksum,
      publication_candidate_created: false,
      completed_at: new Date().toISOString(),
      fixture: pkg.fixture,
    };
  }
}
