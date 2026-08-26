/**
 * ValidationInputFreezer — immutable input package for Mock and Real runs.
 */
import { createHash, randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import type { ValidationCandidate, ValidationInputPackage } from "./types.js";

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const obj = value as Record<string, unknown>;
  return `{${Object.keys(obj)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`)
    .join(",")}}`;
}

export class ValidationInputFreezer {
  constructor(
    private readonly repoRoot = resolve(import.meta.dirname, "../../../.."),
  ) {}

  freeze(candidate: ValidationCandidate): ValidationInputPackage {
    if (!candidate.eligible || !candidate.founder_decision_id) {
      throw new Error("Cannot freeze ineligible resume template");
    }

    const cycleDir = join(this.repoRoot, candidate.artifact_dir);
    const knowledge = existsSync(join(cycleDir, "knowledge.json"))
      ? (JSON.parse(readFileSync(join(cycleDir, "knowledge.json"), "utf8")) as {
          snapshot_id?: string;
          references?: string[];
        })
      : null;
    const skills = existsSync(join(cycleDir, "skills.json"))
      ? (JSON.parse(readFileSync(join(cycleDir, "skills.json"), "utf8")) as {
          skill_id?: string;
          status?: string;
        })
      : null;

    const objective =
      "Produce an ATS-friendly Marketing Manager resume construction cycle (dry-run)";

    const core = {
      candidate_id: candidate.candidate_id,
      task_id: candidate.task_id,
      cycle_id: candidate.cycle_id,
      founder_decision_id: candidate.founder_decision_id,
      objective,
      department: "resume" as const,
      capability: "design_planning",
      quality_tier: "strong",
      skill_request: {
        skill_id: skills?.skill_id ?? "resume.layout_planning",
        status: skills?.status ?? "COMPLETED",
      },
      knowledge_snapshot_references: knowledge?.references ?? [],
      knowledge_snapshot_id: knowledge?.snapshot_id ?? null,
      expected_structured_response_schema: "reasoning-response.schema.json",
      privacy_classification: "INTERNAL",
      token_ceilings_placeholder: {
        max_input_tokens: null,
        max_output_tokens: null,
      },
      cost_ceiling_placeholder: {
        max_cost_usd: null,
      },
      designbrief_contract_version: "1.0.0",
      renderer_contract_version: "1.0.0",
      critic_rules_version: "1.0.0",
      provider_prompt_locked: true as const,
      dry_run: true as const,
      publication_allowed: false as const,
    };

    const input_checksum = createHash("sha256")
      .update(stableStringify(core))
      .digest("hex");

    return {
      validation_id: `val-${randomUUID().slice(0, 12)}`,
      ...core,
      input_checksum,
      created_at: new Date().toISOString(),
      fixture: candidate.fixture,
    };
  }
}
