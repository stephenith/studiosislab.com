/**
 * Skill manifest — catalog entry shape for registry JSON.
 */
import type { SkillDefinition, SkillDomain } from "./Skill.js";

export type SkillManifest = {
  version: string;
  generated_at: string;
  domains: SkillDomain[];
  skills: SkillDefinition[];
  rules: string[];
};

export const SKILL_LIBRARY_RULES: readonly string[] = [
  "Departments cannot send prompts directly",
  "Departments request Skills",
  "Skills may compose other Skills",
  "Brain Router routes Skills",
  "Provider Adapter executes Skills",
  "Providers never know which department requested them",
] as const;
