/**
 * Skill execution plan — ordered composition for Brain Router.
 */
import type { SkillDefinition, SkillId, SkillRequest } from "./Skill.js";
import { expandComposition, getSkill, stripDepartmentForProvider } from "./SkillComposition.js";
import { INITIAL_SKILLS } from "./SkillRegistry.js";

export type SkillExecutionStep = {
  order: number;
  skill_id: SkillId;
  capability: SkillDefinition["capability"];
  quality_tier: SkillDefinition["quality_tier"];
  deterministic: boolean;
  /** Provider-facing payload — department stripped. */
  provider_payload: ReturnType<typeof stripDepartmentForProvider>;
};

export type SkillExecutionPlan = {
  request_id: string;
  root_skill_id: SkillId;
  department: string;
  dry_run: boolean;
  steps: SkillExecutionStep[];
};

export function buildSkillExecutionPlan(
  request: SkillRequest,
  catalog: readonly SkillDefinition[] = INITIAL_SKILLS,
): SkillExecutionPlan {
  const order = expandComposition(request.skill_id, catalog);
  const steps: SkillExecutionStep[] = order.map((skill_id, index) => {
    const skill = getSkill(skill_id, catalog)!;
    return {
      order: index + 1,
      skill_id,
      capability: skill.capability,
      quality_tier: skill.quality_tier,
      deterministic: skill.deterministic,
      provider_payload: stripDepartmentForProvider({
        skill_id,
        task_id: request.task_id,
        input: request.input,
        context_references: request.context_references,
        memory_references: request.memory_references,
      }),
    };
  });

  return {
    request_id: request.request_id,
    root_skill_id: request.skill_id,
    department: request.department,
    dry_run: request.dry_run,
    steps,
  };
}
