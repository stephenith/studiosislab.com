/**
 * Phase 6C — Canonical Founder Memory selection context.
 * Exposes only actually-known generation/revision design values.
 * Never derives design_family from job title or injects a default architecture
 * solely for memory matching.
 */
import {
  getDesignFamily,
  parseDesignFamilyId,
  resolveDesignFamily,
} from "../design-families/DesignFamilyEngine.js";
import type {
  CandidateEnrichment,
  GenerationTargetContext,
} from "./FounderPreferenceMemoryTypes.js";

export const MEMORY_CONTEXT_SCHEMA = "founder-memory-context-1.0.0" as const;

export type MemoryContextSource =
  | "explicit"
  | "objective_token"
  | "family_engine"
  | "candidate_artifact"
  | "family_contract"
  | "unknown";

export type ResolvedGenerationDesignContext = {
  schema_version: typeof MEMORY_CONTEXT_SCHEMA;
  role: string | null;
  role_family: string | null;
  category: string | null;
  design_family: string | null;
  architecture: string | null;
  design_variant: number | null;
  section: string | null;
  component: string | null;
  design_family_source: MemoryContextSource;
  architecture_source: MemoryContextSource;
};

export type RevisionMemoryContext = ResolvedGenerationDesignContext & {
  REVISION_MEMORY_CONTEXT_COMPLETE: boolean;
};

function nonempty(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t.length ? t : null;
}

/** Copy only actually-known string fields. Empty/undefined → null. */
export function buildMemorySelectionContext(
  known: Partial<GenerationTargetContext>,
): GenerationTargetContext {
  return {
    role: nonempty(known.role),
    role_family: nonempty(known.role_family),
    category: nonempty(known.category),
    design_family: nonempty(known.design_family)?.toLowerCase() ?? null,
    architecture: nonempty(known.architecture)?.toLowerCase() ?? null,
    section: nonempty(known.section)?.toLowerCase() ?? null,
    component: nonempty(known.component)?.toLowerCase() ?? null,
  };
}

export function extractDesignFamilyToken(
  objective: string | null | undefined,
): string | null {
  if (!objective) return null;
  const m = objective.match(/design_family\s*[:=]\s*([a-z_]+)/i);
  return parseDesignFamilyId(m?.[1] ?? null);
}

export function extractArchitectureToken(
  objective: string | null | undefined,
): string | null {
  if (!objective) return null;
  const m = objective.match(
    /\b(header_band|classic_single|compact_corporate|editorial_offset|narrow_ats_sidebar|technical_grid|section_index|wide_header_single)\b/i,
  );
  return m?.[1]?.toLowerCase() ?? null;
}

export function architectureForFamily(
  designFamily: string | null | undefined,
): string | null {
  const id = parseDesignFamilyId(designFamily);
  if (!id) return null;
  return getDesignFamily(id).layout_architecture;
}

/**
 * Resolve the production design family/architecture the same way DesignBrief
 * already does (Family Engine). This is actual design selection — not a
 * title→family mapping and not a fake default for memory matching.
 */
export function resolveGenerationDesignContext(input: {
  objective?: string | null;
  role_family?: string | null;
  category?: string | null;
  title?: string | null;
  role?: string | null;
  design_family?: string | null;
  design_variant?: number | null;
  architecture?: string | null;
}): ResolvedGenerationDesignContext {
  const objective = nonempty(input.objective) ?? "";
  const explicitFamily = parseDesignFamilyId(input.design_family);
  const tokenFamily = extractDesignFamilyToken(objective);
  const familyHint = explicitFamily ?? tokenFamily;
  const familySource: MemoryContextSource = explicitFamily
    ? "explicit"
    : tokenFamily
      ? "objective_token"
      : "family_engine";

  const variantFromObj = objective.match(/design_variant\s*[:=]\s*(\d+)/i);
  const design_variant =
    input.design_variant !== undefined && input.design_variant !== null
      ? Number(input.design_variant)
      : variantFromObj
        ? Number(variantFromObj[1])
        : 0;

  const resolved = resolveDesignFamily({
    family_id: familyHint,
    design_variant,
    role_family: nonempty(input.role_family),
    seed: [objective, familyHint ?? "", nonempty(input.role_family) ?? ""].join(
      " ",
    ),
  });

  const explicitArch = nonempty(input.architecture)?.toLowerCase() ?? null;
  const tokenArch = extractArchitectureToken(objective);
  const architecture = resolved.layout_architecture;
  const architecture_source: MemoryContextSource = explicitArch
    ? "explicit"
    : tokenArch
      ? "objective_token"
      : "family_engine";

  return {
    schema_version: MEMORY_CONTEXT_SCHEMA,
    role: nonempty(input.role) ?? nonempty(input.title),
    role_family: nonempty(input.role_family),
    category: nonempty(input.category),
    design_family: resolved.family_id,
    architecture,
    design_variant: resolved.variant,
    section: null,
    component: null,
    design_family_source: familyHint ? familySource : "family_engine",
    architecture_source,
  };
}

export function toSelectionContext(
  resolved: ResolvedGenerationDesignContext,
): GenerationTargetContext {
  return buildMemorySelectionContext({
    role: resolved.role,
    role_family: resolved.role_family,
    category: resolved.category,
    design_family: resolved.design_family,
    architecture: resolved.architecture,
    section: resolved.section,
    component: resolved.component,
  });
}

/**
 * Revision already has a canvas / Resume Template. Prefer candidate artifacts
 * over title-inferred task.design_family. Do not treat Founder text as scope.
 */
export function deriveRevisionMemoryContext(opts: {
  task: {
    role: string;
    design_family: string | null;
    prior_candidate_id: string;
  };
  enrichment?: Partial<CandidateEnrichment> | null;
}): RevisionMemoryContext {
  const enrichment = opts.enrichment ?? {};
  const design_family =
    nonempty(enrichment.design_family)?.toLowerCase() ??
    nonempty(opts.task.design_family)?.toLowerCase() ??
    null;
  const familySource: MemoryContextSource = enrichment.design_family
    ? "candidate_artifact"
    : opts.task.design_family
      ? "explicit"
      : "unknown";

  let architecture =
    nonempty(enrichment.architecture)?.toLowerCase() ?? null;
  let architecture_source: MemoryContextSource = architecture
    ? "candidate_artifact"
    : "unknown";
  if (!architecture && design_family) {
    const fromContract = architectureForFamily(design_family);
    if (fromContract) {
      architecture = fromContract;
      architecture_source = "family_contract";
    }
  }

  const complete = Boolean(design_family && architecture);
  return {
    schema_version: MEMORY_CONTEXT_SCHEMA,
    role: nonempty(enrichment.role) ?? nonempty(opts.task.role),
    role_family: nonempty(enrichment.role_family),
    category: nonempty(enrichment.category),
    design_family,
    architecture,
    design_variant: null,
    section: null,
    component: null,
    design_family_source: familySource,
    architecture_source,
    REVISION_MEMORY_CONTEXT_COMPLETE: complete,
  };
}
