/**
 * Skill — reusable intelligence unit.
 * Agent #117.5 — departments compose Skills; never raw prompts or provider APIs.
 */
import type {
  BrainCapability,
  PrivacyClassification,
  QualityTier,
} from "../ai-brain/types.js";

export type SkillDomain = "resume" | "website" | "common";

export type SkillId = string;

export type SkillDefinition = {
  id: SkillId;
  name: string;
  domain: SkillDomain;
  description: string;
  /** Maps to AI Brain capability when intelligence is required; null = deterministic. */
  capability: BrainCapability | null;
  quality_tier: QualityTier;
  privacy_classification: PrivacyClassification;
  /** Other skill ids this skill may compose. */
  composes: SkillId[];
  /** Input contract keys (schema-free labels for v1). */
  inputs: string[];
  /** Output contract keys. */
  outputs: string[];
  deterministic: boolean;
  enabled: boolean;
};

/**
 * Skill invocation — what departments send (no prompts, no model names).
 */
export type SkillRequest = {
  request_id: string;
  skill_id: SkillId;
  department: string;
  task_id: string;
  context_references: string[];
  memory_references: string[];
  input: Record<string, unknown>;
  dry_run: boolean;
  created_at: string;
};
