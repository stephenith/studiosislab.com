/**
 * Skill validator — structural and policy checks.
 */
import type { SkillDefinition, SkillRequest } from "./Skill.js";
import { getSkill, expandComposition } from "./SkillComposition.js";
import { INITIAL_SKILLS } from "./SkillRegistry.js";

export type SkillValidationResult = {
  ok: boolean;
  errors: string[];
};

export function validateSkillDefinition(
  skill: SkillDefinition,
  catalog: readonly SkillDefinition[] = INITIAL_SKILLS,
): SkillValidationResult {
  const errors: string[] = [];
  if (!skill.id) errors.push("missing id");
  if (!skill.name) errors.push("missing name");
  if (!skill.domain) errors.push("missing domain");
  if (skill.deterministic && skill.capability && skill.quality_tier !== "deterministic") {
    errors.push("deterministic skill should use deterministic tier");
  }
  if (!skill.deterministic && !skill.capability) {
    errors.push("non-deterministic skill requires capability");
  }
  for (const child of skill.composes) {
    if (!getSkill(child, catalog)) errors.push(`unknown composed skill: ${child}`);
  }
  // Detect cycles
  try {
    expandComposition(skill.id, catalog);
  } catch (e) {
    errors.push(e instanceof Error ? e.message : String(e));
  }
  return { ok: errors.length === 0, errors };
}

export function validateSkillRequest(
  request: SkillRequest,
  catalog: readonly SkillDefinition[] = INITIAL_SKILLS,
): SkillValidationResult {
  const errors: string[] = [];
  if (!request.request_id) errors.push("missing request_id");
  if (!request.department) errors.push("missing department");
  if (!request.skill_id) errors.push("missing skill_id");
  const skill = getSkill(request.skill_id, catalog);
  if (!skill) errors.push(`unknown skill: ${request.skill_id}`);
  else if (!skill.enabled) errors.push(`skill disabled: ${request.skill_id}`);
  // Forbidden: raw prompt / model fields
  if ("prompt" in request.input) errors.push("raw prompt forbidden in skill input");
  if ("model" in request.input || "model_name" in request.input) {
    errors.push("model names forbidden in skill input");
  }
  return { ok: errors.length === 0, errors };
}

export function validateCatalog(
  catalog: readonly SkillDefinition[] = INITIAL_SKILLS,
): SkillValidationResult {
  const errors: string[] = [];
  const ids = new Set<string>();
  for (const s of catalog) {
    if (ids.has(s.id)) errors.push(`duplicate skill id: ${s.id}`);
    ids.add(s.id);
    const r = validateSkillDefinition(s, catalog);
    errors.push(...r.errors.map((e) => `${s.id}: ${e}`));
  }
  return { ok: errors.length === 0, errors };
}
