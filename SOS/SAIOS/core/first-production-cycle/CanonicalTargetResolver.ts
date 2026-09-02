/**
 * Phase 6D — Resolve one existing canonical production taxonomy target.
 * Does not invent titles, design_family, or architecture.
 */
import {
  PRODUCTION_ROLE_TAXONOMY,
  buildTargetFromRoleEntry,
  type RoleTaxonomyEntry,
} from "./ProductionRoleTaxonomy.js";
import type { ProductionTarget } from "./ProductionTarget.js";
import { CYCLE_LOG } from "./runFirstProductionCycle.js";
import { evaluateDuplicate } from "./DuplicateDetector.js";
import { resolveGenerationDesignContext } from "../founder-memory/FounderMemoryContext.js";

export const CANONICAL_TARGET_REGISTRY = "production-role-taxonomy-1.0.0" as const;

/** Families that currently have CONFIRMED injectable Founder Memory. */
export const CONFIRMED_MEMORY_DESIGN_FAMILIES = new Set([
  "creative",
  "technical",
  "minimal",
  "executive",
  "editorial",
  "swiss",
  "contemporary_accent",
]);

/** Known CONFIRMED injectable rule IDs from the production corpus (Phase 6C). */
export const CONFIRMED_MEMORY_RULE_BY_FAMILY: Record<string, string> = {
  creative: "fpm-4feec9cb-f33",
  technical: "fpm-19702a7f-e76",
  minimal: "fpm-9a158a17-bc8",
  executive: "fpm-08cb9b4f-0c5",
  editorial: "fpm-043ecda2-84c",
  swiss: "fpm-4d3ca249-c5b",
  contemporary_accent: "fpm-7910dc08-3ef",
};

/** Prior live ROLE_INTEGRITY_FAILED / historical mismatch — avoid for the 6C proof. */
export const ROLE_INTEGRITY_PROOF_AVOID_TITLES = new Set([
  "operations analyst",
  "graphic designer",
  "director of strategy",
  "vp of sales",
]);

export type CanonicalTargetResolution =
  | {
      ok: true;
      reason: "resolved";
      entry: RoleTaxonomyEntry;
      target: ProductionTarget;
    }
  | {
      ok: false;
      reason: "unknown" | "ambiguous" | "empty";
      detail: string;
      matches: RoleTaxonomyEntry[];
    };

function norm(raw: string): string {
  return raw.trim().toLowerCase().replace(/[\s_]+/g, "-");
}

function slugOf(entry: RoleTaxonomyEntry): string {
  return entry.id.split(":")[1] ?? "";
}

export function listCanonicalTaxonomyEntries(): RoleTaxonomyEntry[] {
  return [...PRODUCTION_ROLE_TAXONOMY];
}

export function buildCanonicalTarget(entry: RoleTaxonomyEntry): ProductionTarget {
  return buildTargetFromRoleEntry(entry);
}

/**
 * Resolve an operator token to exactly one taxonomy entry.
 * Accepts: taxonomy id, unique slug, unique exact title, unique role_family.
 */
export function resolveCanonicalProductionTarget(
  raw: string | null | undefined,
): CanonicalTargetResolution {
  const input = String(raw ?? "").trim();
  if (!input) {
    return { ok: false, reason: "empty", detail: "canonical target is required", matches: [] };
  }
  const lowered = input.toLowerCase();
  const compact = norm(input);
  const categories = new Set(
    PRODUCTION_ROLE_TAXONOMY.map((e) => e.category.toLowerCase()),
  );
  if (categories.has(lowered) || categories.has(compact.replace(/-/g, "_"))) {
    const matches = PRODUCTION_ROLE_TAXONOMY.filter(
      (e) => e.category.toLowerCase() === lowered || e.category === compact.replace(/-/g, "_"),
    );
    return {
      ok: false,
      reason: "ambiguous",
      detail: `category '${input}' matches ${matches.length} canonical targets`,
      matches,
    };
  }

  const byId = PRODUCTION_ROLE_TAXONOMY.filter(
    (e) => e.id.toLowerCase() === lowered,
  );
  if (byId.length === 1) {
    return {
      ok: true,
      reason: "resolved",
      entry: byId[0]!,
      target: buildTargetFromRoleEntry(byId[0]!),
    };
  }

  const bySlug = PRODUCTION_ROLE_TAXONOMY.filter((e) => slugOf(e) === compact);
  if (bySlug.length === 1) {
    return {
      ok: true,
      reason: "resolved",
      entry: bySlug[0]!,
      target: buildTargetFromRoleEntry(bySlug[0]!),
    };
  }
  if (bySlug.length > 1) {
    return {
      ok: false,
      reason: "ambiguous",
      detail: `slug '${input}' matches ${bySlug.length} canonical targets`,
      matches: bySlug,
    };
  }

  const byTitle = PRODUCTION_ROLE_TAXONOMY.filter(
    (e) => e.title.toLowerCase() === lowered,
  );
  if (byTitle.length === 1) {
    return {
      ok: true,
      reason: "resolved",
      entry: byTitle[0]!,
      target: buildTargetFromRoleEntry(byTitle[0]!),
    };
  }
  if (byTitle.length > 1) {
    return {
      ok: false,
      reason: "ambiguous",
      detail: `title '${input}' matches ${byTitle.length} canonical targets`,
      matches: byTitle,
    };
  }

  const roleFamily = input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
  const byRole = PRODUCTION_ROLE_TAXONOMY.filter((e) => {
    const rf = e.title
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_|_$/g, "");
    return rf === roleFamily;
  });
  if (byRole.length === 1) {
    return {
      ok: true,
      reason: "resolved",
      entry: byRole[0]!,
      target: buildTargetFromRoleEntry(byRole[0]!),
    };
  }
  if (byRole.length > 1) {
    return {
      ok: false,
      reason: "ambiguous",
      detail: `role_family '${input}' matches ${byRole.length} canonical targets`,
      matches: byRole,
    };
  }

  return {
    ok: false,
    reason: "unknown",
    detail: `not an existing canonical production target: ${input}`,
    matches: [],
  };
}

export function naturalDesignForCanonicalTarget(target: ProductionTarget): {
  design_family: string | null;
  architecture: string | null;
} {
  const resolved = resolveGenerationDesignContext({
    objective: target.objective,
    role_family: target.role_family,
    category: target.category,
    title: target.title,
    role: target.title,
  });
  return {
    design_family: resolved.design_family,
    architecture: resolved.architecture,
  };
}

export function evaluateCanonicalTargetEligibility(
  target: ProductionTarget,
  opts?: { cycleLog?: string; repoRoot?: string },
): {
  duplicate_decision: ReturnType<typeof evaluateDuplicate>;
  eligible: boolean;
} {
  const cycleLog = opts?.cycleLog ?? CYCLE_LOG;
  const duplicate_decision = evaluateDuplicate({
    target,
    cycleLog,
    registry_kind: "production",
  });
  return {
    duplicate_decision,
    eligible: duplicate_decision.decision === "ALLOW",
  };
}

export type ProofTargetRecommendation = {
  id: string;
  title: string;
  role_family: string;
  category: string;
  target: ProductionTarget;
  design_family: string | null;
  architecture: string | null;
  eligible: boolean;
  skip_reason: string | null;
};

export function recommendControlledProofTarget(opts?: {
  cycleLog?: string;
  preferId?: string;
}): ProofTargetRecommendation | null {
  const prefer = opts?.preferId ?? "executive:chief-marketing-officer";
  const ranked = [...PRODUCTION_ROLE_TAXONOMY].sort((a, b) => {
    if (a.id === prefer) return -1;
    if (b.id === prefer) return 1;
    return a.id.localeCompare(b.id);
  });

  let fallback: ProofTargetRecommendation | null = null;
  for (const entry of ranked) {
    const target = buildTargetFromRoleEntry(entry);
    const design = naturalDesignForCanonicalTarget(target);
    const elig = evaluateCanonicalTargetEligibility(target, opts);
    const avoided = ROLE_INTEGRITY_PROOF_AVOID_TITLES.has(
      entry.title.toLowerCase(),
    );
    const memoryCovered = Boolean(
      design.design_family &&
        CONFIRMED_MEMORY_DESIGN_FAMILIES.has(design.design_family),
    );
    const rec: ProofTargetRecommendation = {
      id: entry.id,
      title: entry.title,
      role_family: target.role_family,
      category: entry.category,
      target,
      design_family: design.design_family,
      architecture: design.architecture,
      eligible: elig.eligible && memoryCovered && !avoided,
      skip_reason: !elig.eligible
        ? `duplicate:${elig.duplicate_decision.duplicate_type ?? "blocked"}`
        : !memoryCovered
          ? `family ${design.design_family} has no CONFIRMED injectable memory`
          : avoided
            ? "known role-integrity risk"
            : null,
    };
    if (rec.eligible) {
      if (entry.id === prefer) return rec;
      if (!fallback) fallback = rec;
    }
  }
  return fallback;
}
