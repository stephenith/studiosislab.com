/**
 * Compact FOUNDER DESIGN MEMORY prompt renderer + design_planning injection helper.
 * Phase 6B: uses canonical FounderMemoryConsumption selector + evidence.
 */
import type { SkillRequest } from "../skills/Skill.js";
import type {
  FounderPreferenceMemoryRecord,
  GenerationTargetContext,
} from "./FounderPreferenceMemoryTypes.js";
import {
  MAX_MEMORY_PROMPT_CHARS,
  renderFounderMemoryPromptBlock,
  selectFounderMemory,
  type FounderMemorySelectionResult,
  type SelectedMemoryRule,
} from "./FounderMemoryConsumption.js";

export const FOUNDER_DESIGN_MEMORY_HEADER = "FOUNDER DESIGN MEMORY";
export const MAX_PROMPT_CHARS = MAX_MEMORY_PROMPT_CHARS;

export type RenderedFounderMemory = {
  block: string;
  memory_ids: string[];
  truncated: boolean;
};

export function renderFounderDesignMemoryBlock(
  records: FounderPreferenceMemoryRecord[],
): RenderedFounderMemory {
  const selected: SelectedMemoryRule[] = records.map((rec) => ({
    memory_id: rec.memory_id,
    scope: rec.scope,
    issue_type: rec.issue_type,
    status: rec.status,
    confidence: rec.confidence,
    signal_type: rec.signal_type,
    injectable_text: rec.normalized_rule || rec.raw_founder_feedback,
    content_hash: rec.content_hash,
  }));
  return renderFounderMemoryPromptBlock(selected);
}

export function appendFounderMemoryToInstructions(
  baseInstructions: string,
  records: FounderPreferenceMemoryRecord[],
): { instructions: string; memory_ids: string[] } {
  const rendered = renderFounderDesignMemoryBlock(records);
  if (!rendered.block) {
    return { instructions: baseInstructions, memory_ids: [] };
  }
  return {
    instructions: `${baseInstructions}\n\n${rendered.block}`,
    memory_ids: rendered.memory_ids,
  };
}

export function appendFounderMemorySelectionToInstructions(
  baseInstructions: string,
  selection: FounderMemorySelectionResult,
): { instructions: string; memory_ids: string[] } {
  if (!selection.prompt_block) {
    return { instructions: baseInstructions, memory_ids: [] };
  }
  return {
    instructions: `${baseInstructions}\n\n${selection.prompt_block}`,
    memory_ids: selection.memory_ids,
  };
}

export function isDesignPlanningSkill(
  skillId: string | null | undefined,
  capability: string | null | undefined,
): boolean {
  if (capability === "design_planning") return true;
  if (skillId === "resume.layout_planning") return true;
  if (skillId === "resume.design_planning") return true;
  return false;
}

export function deriveGenerationTargetContext(
  skillRequest: SkillRequest,
): GenerationTargetContext {
  const input = skillRequest.input ?? {};
  const target =
    (input.production_target as Record<string, unknown> | undefined) ??
    undefined;
  const objective =
    typeof input.objective === "string" ? input.objective : "";
  const fam = objective.match(/design_family\s*[:=]\s*([a-z_]+)/i);
  const arch = objective.match(
    /\b(header_band|classic_single|compact_corporate|editorial_offset|narrow_ats_sidebar|technical_grid|section_index|wide_header_single)\b/i,
  );

  return {
    category:
      (typeof input.category === "string" && input.category) ||
      (typeof target?.category === "string" && target.category) ||
      null,
    role:
      (typeof input.title === "string" && input.title) ||
      (typeof target?.title === "string" && target.title) ||
      null,
    role_family:
      (typeof input.role_family === "string" && input.role_family) ||
      (typeof target?.role_family === "string" && target.role_family) ||
      null,
    design_family:
      (typeof input.design_family === "string" && input.design_family) ||
      fam?.[1]?.toLowerCase() ||
      null,
    architecture:
      (typeof input.architecture === "string" && input.architecture) ||
      arch?.[1]?.toLowerCase() ||
      null,
  };
}

/** Fail-open injection for ResumeBrainGateway design_planning only. */
export function applyFounderDesignMemoryInstructions(opts: {
  baseInstructions: string;
  skillRequest: SkillRequest;
  capability: string | null | undefined;
  repoRoot?: string;
}): {
  instructions: string;
  memory_references: string[];
  selection: FounderMemorySelectionResult | null;
} {
  try {
    if (!isDesignPlanningSkill(opts.skillRequest.skill_id, opts.capability)) {
      return {
        instructions: opts.baseInstructions,
        memory_references: opts.skillRequest.memory_references ?? [],
        selection: null,
      };
    }
    const ctx = deriveGenerationTargetContext(opts.skillRequest);
    const selection = selectFounderMemory({
      ctx,
      channel: "generation",
      repoRoot: opts.repoRoot,
    });
    const { instructions, memory_ids } =
      appendFounderMemorySelectionToInstructions(
        opts.baseInstructions,
        selection,
      );
    const refs = [
      ...(opts.skillRequest.memory_references ?? []),
      ...memory_ids.map((id) => `founder-preference-memory:${id}`),
    ];
    return {
      instructions,
      memory_references: [...new Set(refs)],
      selection,
    };
  } catch {
    return {
      instructions: opts.baseInstructions,
      memory_references: opts.skillRequest.memory_references ?? [],
      selection: null,
    };
  }
}
