/**
 * Compact FOUNDER DESIGN MEMORY prompt renderer + design_planning injection helper.
 */
import type { SkillRequest } from "../skills/Skill.js";
import type {
  FounderPreferenceMemoryRecord,
  GenerationTargetContext,
} from "./FounderPreferenceMemoryTypes.js";
import { retrieveFounderPreferencesSafe } from "./FounderPreferenceRetriever.js";

export const FOUNDER_DESIGN_MEMORY_HEADER = "FOUNDER DESIGN MEMORY";
export const MAX_PROMPT_CHARS = 600;

export type RenderedFounderMemory = {
  block: string;
  memory_ids: string[];
  truncated: boolean;
};

export function renderFounderDesignMemoryBlock(
  records: FounderPreferenceMemoryRecord[],
): RenderedFounderMemory {
  if (!records.length) {
    return { block: "", memory_ids: [], truncated: false };
  }

  const header = [
    FOUNDER_DESIGN_MEMORY_HEADER,
    "Use these as learned StudiosisLab Founder preferences and constraints.",
    "They must not override the current production objective or factual-content safety.",
  ].join("\n");

  const footer =
    "Do not fabricate skills, credentials, employers, metrics or content to satisfy memory.";

  const lines: string[] = [];
  const ids: string[] = [];
  let truncated = false;

  for (const rec of records) {
    const line = `- [${rec.scope}|${rec.confidence}] ${rec.normalized_rule}`;
    const trial = [header, ...lines, line, "", footer].join("\n");
    if (trial.length > MAX_PROMPT_CHARS) {
      truncated = true;
      break;
    }
    lines.push(line);
    ids.push(rec.memory_id);
  }

  if (!lines.length) {
    return { block: "", memory_ids: [], truncated: true };
  }

  const block = [header, ...lines, "", footer].join("\n");
  return { block, memory_ids: ids, truncated };
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
}): { instructions: string; memory_references: string[] } {
  try {
    if (!isDesignPlanningSkill(opts.skillRequest.skill_id, opts.capability)) {
      return {
        instructions: opts.baseInstructions,
        memory_references: opts.skillRequest.memory_references ?? [],
      };
    }
    const ctx = deriveGenerationTargetContext(opts.skillRequest);
    const records = retrieveFounderPreferencesSafe(ctx, opts.repoRoot);
    const { instructions, memory_ids } = appendFounderMemoryToInstructions(
      opts.baseInstructions,
      records,
    );
    const refs = [
      ...(opts.skillRequest.memory_references ?? []),
      ...memory_ids.map((id) => `founder-preference-memory:${id}`),
    ];
    return { instructions, memory_references: [...new Set(refs)] };
  } catch {
    return {
      instructions: opts.baseInstructions,
      memory_references: opts.skillRequest.memory_references ?? [],
    };
  }
}
