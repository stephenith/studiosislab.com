/**
 * Phase 5V — AI companion-op Founder attribution repair.
 *
 * Invariant: every mutation operation reaching validateRevisionPlanShape must
 * carry a truthful, exact Founder requested_changes line as founder_feedback_item.
 *
 * Repairs ONLY when provenance is deterministically resolvable from:
 * - founder_feedback_items that exact-match MUTATION_REQUIRED requested_changes
 * - same-section sibling ops that already carry a valid primary FBI
 *
 * Never fabricates Founder quotes. Ambiguity fails closed (leaves field empty).
 */
import {
  classifyRequestedChange,
  isVerificationAcceptance,
} from "./RequestedChangeClassification.js";
import { normalizeFounderFeedbackItem } from "./RevisionPromptBuilder.js";

export const REVISION_OPERATION_PROVENANCE_INVARIANT =
  "Every mutation operation reaching validateRevisionPlanShapeAndOperations MUST have founder_feedback_item set to an exact MUTATION_REQUIRED Founder requested_changes line (truthful provenance). Companion ops may inherit that line via deterministic repair from founder_feedback_items and/or same-section sibling attribution; ambiguous or unverifiable provenance MUST fail closed.";

export type ProvenanceRepairRecord = {
  index: number;
  founder_feedback_item: string;
  reason: string;
};

export type ProvenanceUnresolvedRecord = {
  index: number;
  reason: string;
};

export type ProvenanceRepairResult = {
  repaired: unknown;
  repairs: ProvenanceRepairRecord[];
  unresolved: ProvenanceUnresolvedRecord[];
};

function requestedByNorm(requestedChanges: string[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const change of requestedChanges) {
    const n = normalizeFounderFeedbackItem(change);
    if (n) map.set(n, change);
  }
  return map;
}

function isMutationRequiredExact(
  text: string,
  byNorm: Map<string, string>,
): string | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  const n = normalizeFounderFeedbackItem(trimmed);
  const canonical = byNorm.get(n);
  if (!canonical) return null;
  if (isVerificationAcceptance(canonical)) return null;
  if (classifyRequestedChange(canonical).classification !== "MUTATION_REQUIRED") {
    return null;
  }
  return canonical;
}

/**
 * Section family key from target_id (e.g. block-projects-5-t1 → block-projects-5)
 * or selector.section.
 */
export function operationSectionFamilyKey(op: Record<string, unknown>): string {
  const selector =
    op.selector && typeof op.selector === "object" && !Array.isArray(op.selector)
      ? (op.selector as Record<string, unknown>)
      : null;
  const sectionSel = String(selector?.section ?? "")
    .trim()
    .toLowerCase();
  if (sectionSel) return `section:${sectionSel}`;

  const tid = String(op.target_id ?? "").trim();
  const m = tid.match(/^(block-[a-z0-9_-]+-\d+)/i);
  if (m?.[1]) return `idfam:${m[1].toLowerCase()}`;
  if (tid) return `id:${tid.toLowerCase()}`;
  return "";
}

function tokenOverlapScore(a: string, b: string): number {
  const tok = (s: string) =>
    new Set(
      normalizeFounderFeedbackItem(s)
        .split(/[^a-z0-9]+/)
        .filter((t) => t.length > 2),
    );
  const A = tok(a);
  const B = tok(b);
  if (A.size === 0 || B.size === 0) return 0;
  let hit = 0;
  for (const t of A) if (B.has(t)) hit++;
  return hit / Math.max(A.size, B.size);
}

function listSecondaryItems(op: Record<string, unknown>): string[] {
  if (!Array.isArray(op.founder_feedback_items)) return [];
  return op.founder_feedback_items
    .map((x) => String(x ?? "").trim())
    .filter(Boolean);
}

/**
 * Promote/repair missing founder_feedback_item on AI companion ops when
 * provenance is unambiguous. Does not loosen schema.
 */
export function repairAiPlanFounderAttribution(input: {
  extracted: unknown;
  requested_changes: string[];
}): ProvenanceRepairResult {
  const empty: ProvenanceRepairResult = {
    repaired: input.extracted,
    repairs: [],
    unresolved: [],
  };
  if (
    !input.extracted ||
    typeof input.extracted !== "object" ||
    Array.isArray(input.extracted)
  ) {
    return empty;
  }
  const root = input.extracted as Record<string, unknown>;
  if (!Array.isArray(root.operations)) return empty;

  const byNorm = requestedByNorm(input.requested_changes);
  const ops = root.operations.map((raw) => {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return raw;
    return { ...(raw as Record<string, unknown>) };
  });

  // Sibling primary FBI by section family (only ops that already have primary).
  const siblingPrimaryByFamily = new Map<string, Set<string>>();
  for (const raw of ops) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue;
    const op = raw as Record<string, unknown>;
    const fbi = String(op.founder_feedback_item ?? "").trim();
    const canonical = isMutationRequiredExact(fbi, byNorm);
    if (!canonical) continue;
    const fam = operationSectionFamilyKey(op);
    if (!fam) continue;
    const set = siblingPrimaryByFamily.get(fam) ?? new Set<string>();
    set.add(canonical);
    siblingPrimaryByFamily.set(fam, set);
  }

  const repairs: ProvenanceRepairRecord[] = [];
  const unresolved: ProvenanceUnresolvedRecord[] = [];

  for (let i = 0; i < ops.length; i++) {
    const raw = ops[i];
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue;
    const op = raw as Record<string, unknown>;
    const existing = String(op.founder_feedback_item ?? "").trim();
    if (existing) {
      // Already present — still require it to be a real RC when RCs provided.
      continue;
    }

    const secondaries = listSecondaryItems(op);
    const mutationFromItems: string[] = [];
    const seen = new Set<string>();
    for (const item of secondaries) {
      const canonical = isMutationRequiredExact(item, byNorm);
      if (!canonical) continue;
      const n = normalizeFounderFeedbackItem(canonical);
      if (seen.has(n)) continue;
      seen.add(n);
      mutationFromItems.push(canonical);
    }

    const fam = operationSectionFamilyKey(op);
    const siblingPrimaries = fam
      ? [...(siblingPrimaryByFamily.get(fam) ?? [])]
      : [];

    let chosen: string | null = null;
    let reason = "";

    if (mutationFromItems.length === 1) {
      chosen = mutationFromItems[0]!;
      reason = "promoted_sole_mutation_founder_feedback_items";
    } else if (mutationFromItems.length > 1) {
      const siblingHits = mutationFromItems.filter((c) =>
        siblingPrimaries.some(
          (s) =>
            normalizeFounderFeedbackItem(s) ===
            normalizeFounderFeedbackItem(c),
        ),
      );
      if (siblingHits.length === 1) {
        chosen = siblingHits[0]!;
        reason =
          "promoted_founder_feedback_items_matching_same_section_sibling_primary";
      } else {
        const intended = String(op.intended_change ?? "").trim();
        if (intended) {
          const scored = mutationFromItems
            .map((c) => ({ c, score: tokenOverlapScore(intended, c) }))
            .sort((a, b) => b.score - a.score);
          const best = scored[0];
          const second = scored[1];
          if (
            best &&
            best.score >= 0.28 &&
            (!second || best.score - second.score >= 0.08)
          ) {
            chosen = best.c;
            reason =
              "promoted_founder_feedback_items_by_unique_intended_change_overlap";
          }
        }
      }
    } else if (siblingPrimaries.length === 1) {
      // No items, but exactly one same-section sibling primary — companion inherit.
      chosen = siblingPrimaries[0]!;
      reason = "inherited_same_section_sibling_primary";
    }

    if (!chosen) {
      unresolved.push({
        index: i,
        reason:
          mutationFromItems.length > 1
            ? "ambiguous_multiple_mutation_founder_feedback_items"
            : siblingPrimaries.length > 1
              ? "ambiguous_multiple_same_section_sibling_primaries"
              : "no_deterministic_founder_provenance",
      });
      continue;
    }

    op.founder_feedback_item = chosen;
    // Keep remaining secondary attributions; drop duplicate of primary.
    const chosenN = normalizeFounderFeedbackItem(chosen);
    const rest = secondaries.filter(
      (s) => normalizeFounderFeedbackItem(s) !== chosenN,
    );
    if (rest.length > 0) {
      op.founder_feedback_items = rest;
    } else {
      delete op.founder_feedback_items;
    }
    ops[i] = op;
    repairs.push({ index: i, founder_feedback_item: chosen, reason });

    // Newly attributed ops can help later companion siblings in the same pass.
    if (fam) {
      const set = siblingPrimaryByFamily.get(fam) ?? new Set<string>();
      set.add(chosen);
      siblingPrimaryByFamily.set(fam, set);
    }
  }

  return {
    repaired: { ...root, operations: ops },
    repairs,
    unresolved,
  };
}
