/**
 * Skill composition — expand skill trees without provider knowledge.
 */
import type { SkillDefinition, SkillId } from "./Skill.js";
import { INITIAL_SKILLS } from "./SkillRegistry.js";

export function getSkill(
  id: SkillId,
  skills: readonly SkillDefinition[] = INITIAL_SKILLS,
): SkillDefinition | undefined {
  return skills.find((s) => s.id === id);
}

export function expandComposition(
  rootId: SkillId,
  skills: readonly SkillDefinition[] = INITIAL_SKILLS,
): SkillId[] {
  const seen = new Set<SkillId>();
  const order: SkillId[] = [];

  const walk = (id: SkillId) => {
    if (seen.has(id)) return;
    seen.add(id);
    const skill = getSkill(id, skills);
    if (!skill) throw new Error(`Unknown skill: ${id}`);
    for (const child of skill.composes) walk(child);
    order.push(id);
  };

  walk(rootId);
  return order;
}

export function buildDependencyMap(
  skills: readonly SkillDefinition[] = INITIAL_SKILLS,
): Record<SkillId, SkillId[]> {
  const map: Record<SkillId, SkillId[]> = {};
  for (const s of skills) {
    map[s.id] = [...s.composes];
  }
  return map;
}

/**
 * Providers must never receive department identity.
 * Strip department before adapter execution.
 */
export function stripDepartmentForProvider(input: {
  skill_id: SkillId;
  task_id: string;
  input: Record<string, unknown>;
  context_references: string[];
  memory_references: string[];
}): {
  skill_id: SkillId;
  task_id: string;
  input: Record<string, unknown>;
  context_references: string[];
  memory_references: string[];
} {
  return {
    skill_id: input.skill_id,
    task_id: input.task_id,
    input: input.input,
    context_references: input.context_references,
    memory_references: input.memory_references,
  };
}
