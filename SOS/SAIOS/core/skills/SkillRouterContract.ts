/**
 * Skill ↔ Brain Router contract.
 * Brain Router routes Skills; Provider Adapter executes them; providers never see departments.
 */
import type { ReasoningRequest } from "../ai-brain/ReasoningRequest.js";
import type { BrainCapability, QualityTier } from "../ai-brain/types.js";
import type { SkillDefinition } from "./Skill.js";
import type { SkillExecutionStep } from "./SkillExecutionPlan.js";

export type SkillRouteIntent = {
  skill_id: string;
  capability: BrainCapability | null;
  quality_tier: QualityTier;
  deterministic: boolean;
  /** Department kept for orchestrator/audit only — not sent to provider. */
  department_for_audit_only: string;
  provider_payload: SkillExecutionStep["provider_payload"];
  dry_run: boolean;
};

export function skillStepToRouteIntent(
  step: SkillExecutionStep,
  department: string,
  dry_run: boolean,
): SkillRouteIntent {
  return {
    skill_id: step.skill_id,
    capability: step.capability,
    quality_tier: step.quality_tier,
    deterministic: step.deterministic,
    department_for_audit_only: department,
    provider_payload: step.provider_payload,
    dry_run,
  };
}

/**
 * Map a non-deterministic skill step toward a ReasoningRequest skeleton.
 * Does not invent prompts; instructions reference skill id only.
 */
export function skillToReasoningRequestSkeleton(
  skill: SkillDefinition,
  opts: {
    request_id: string;
    task_id: string;
    department: string;
    dry_run: boolean;
  },
): Pick<
  ReasoningRequest,
  | "request_id"
  | "task_id"
  | "department"
  | "capability"
  | "objective"
  | "instructions"
  | "quality_tier"
  | "privacy_classification"
  | "dry_run"
> | null {
  if (skill.deterministic || !skill.capability) return null;
  return {
    request_id: opts.request_id,
    task_id: opts.task_id,
    department: opts.department,
    capability: skill.capability,
    objective: `Execute skill ${skill.id}`,
    instructions: `Skill:${skill.id}; providers must not receive department identity in execution payload`,
    quality_tier: skill.quality_tier,
    privacy_classification: skill.privacy_classification,
    dry_run: opts.dry_run,
  };
}
