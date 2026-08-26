/**
 * Resume Department skill request builder.
 * Agent #119 — no raw prompts; named Skills only.
 */
import type { SkillRequest } from "../skills/Skill.js";
import type { ResumeOperation } from "./ResumeSkillMapper.js";
import { mapResumeOperationToSkill } from "./ResumeSkillMapper.js";

export type ResumeSkillRequestInput = {
  operation: ResumeOperation;
  task_id: string;
  objective: string;
  context_references?: string[];
  memory_references?: string[];
  input?: Record<string, unknown>;
  dry_run?: boolean;
};

/**
 * Build a SkillRequest for Resume Department.
 * Forbidden fields (prompt, model, openai) are never accepted.
 */
export function createResumeSkillRequest(
  input: ResumeSkillRequestInput,
): SkillRequest {
  const mapping = mapResumeOperationToSkill(input.operation);
  if (mapping.kind !== "skill") {
    throw new Error(
      `Operation ${input.operation} is deterministic-only and must not create a SkillRequest for Brain routing`,
    );
  }

  const rawInput = input.input ?? {};
  if ("prompt" in rawInput) {
    throw new Error("Resume Department cannot send raw prompts");
  }
  if ("model" in rawInput || "model_name" in rawInput || "openai_model" in rawInput) {
    throw new Error("Resume Department cannot reference model names");
  }

  const now = new Date().toISOString();
  const request_id = `resume-${input.task_id}-${mapping.skill_id.replace(/\./g, "-")}`;

  return {
    request_id,
    skill_id: mapping.skill_id,
    department: "resume",
    task_id: input.task_id,
    context_references: input.context_references ?? [],
    memory_references: input.memory_references ?? [],
    input: {
      ...rawInput,
      objective: input.objective,
    },
    dry_run: input.dry_run ?? true,
    created_at: now,
  };
}
