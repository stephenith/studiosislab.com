/**
 * Retrieve CONFIRMED Founder preference memory for generation — fail-open.
 */
import {
  CONFIDENCE_RANK,
  SCOPE_SPECIFICITY,
  type FounderPreferenceMemoryRecord,
  type GenerationTargetContext,
  type MemoryScope,
} from "./FounderPreferenceMemoryTypes.js";
import { FounderPreferenceMemoryStore } from "./FounderPreferenceMemoryStore.js";

const MAX_RECORDS = 10;

function norm(s: string | null | undefined): string {
  return (s ?? "").toLowerCase().trim();
}

function scopeMatches(
  rec: FounderPreferenceMemoryRecord,
  ctx: GenerationTargetContext,
): boolean {
  switch (rec.scope) {
    case "GLOBAL":
      return true;
    case "ARCHITECTURE":
      return Boolean(rec.architecture && norm(rec.architecture) === norm(ctx.architecture));
    case "DESIGN_FAMILY":
      return Boolean(
        rec.design_family && norm(rec.design_family) === norm(ctx.design_family),
      );
    case "CATEGORY":
      return Boolean(rec.category && norm(rec.category) === norm(ctx.category));
    case "ROLE_FAMILY":
      return Boolean(
        rec.role_family && norm(rec.role_family) === norm(ctx.role_family),
      );
    case "ROLE":
      return Boolean(rec.role && norm(rec.role) === norm(ctx.role));
    case "SECTION":
      return Boolean(rec.section && norm(rec.section) === norm(ctx.section));
    case "COMPONENT":
      return Boolean(
        rec.component && norm(rec.component) === norm(ctx.component),
      );
  }
}

function bucketRank(scope: MemoryScope): number {
  // Lower = higher priority in fill order (GLOBAL first)
  const order: MemoryScope[] = [
    "GLOBAL",
    "ARCHITECTURE",
    "DESIGN_FAMILY",
    "CATEGORY",
    "ROLE_FAMILY",
    "ROLE",
    "SECTION",
    "COMPONENT",
  ];
  return order.indexOf(scope);
}

function isInjectable(rec: FounderPreferenceMemoryRecord): boolean {
  if (!rec.active || rec.status !== "CONFIRMED") return false;
  if (rec.signal_type === "POSITIVE_EXEMPLAR") return false;
  if (rec.signal_type === "CONSTRAINT" || rec.signal_type === "PREFERENCE") {
    return Boolean(rec.normalized_rule?.trim());
  }
  if (rec.signal_type === "NEGATIVE_EXEMPLAR") {
    const rule = rec.normalized_rule?.trim() ?? "";
    if (!rule) return false;
    // Skip placeholder generic reject text without design instruction
    if (/^founder rejected this exemplar\.?$/i.test(rule)) return false;
    return true;
  }
  return false;
}

function contradicts(
  a: FounderPreferenceMemoryRecord,
  b: FounderPreferenceMemoryRecord,
): boolean {
  if (a.issue_type !== b.issue_type) return false;
  if (a.scope !== b.scope) return false;
  if (a.positive_or_negative === b.positive_or_negative) return false;
  // Same scope target
  const sameTarget =
    (a.scope === "ARCHITECTURE" &&
      norm(a.architecture) === norm(b.architecture)) ||
    (a.scope === "DESIGN_FAMILY" &&
      norm(a.design_family) === norm(b.design_family)) ||
    (a.scope === "CATEGORY" && norm(a.category) === norm(b.category)) ||
    (a.scope === "ROLE" && norm(a.role) === norm(b.role)) ||
    (a.scope === "ROLE_FAMILY" &&
      norm(a.role_family) === norm(b.role_family)) ||
    a.scope === "GLOBAL";
  return sameTarget;
}

function winner(
  a: FounderPreferenceMemoryRecord,
  b: FounderPreferenceMemoryRecord,
): FounderPreferenceMemoryRecord {
  if (CONFIDENCE_RANK[a.confidence] !== CONFIDENCE_RANK[b.confidence]) {
    return CONFIDENCE_RANK[a.confidence] > CONFIDENCE_RANK[b.confidence] ? a : b;
  }
  if (SCOPE_SPECIFICITY[a.scope] !== SCOPE_SPECIFICITY[b.scope]) {
    return SCOPE_SPECIFICITY[a.scope] > SCOPE_SPECIFICITY[b.scope] ? a : b;
  }
  const at = Date.parse(a.updated_at) || 0;
  const bt = Date.parse(b.updated_at) || 0;
  return at >= bt ? a : b;
}

export class FounderPreferenceRetriever {
  constructor(private readonly store = new FounderPreferenceMemoryStore()) {}

  retrieve(ctx: GenerationTargetContext): FounderPreferenceMemoryRecord[] {
    try {
      const active = this.store.listActive().filter(isInjectable);
      const matched = active.filter((r) => scopeMatches(r, ctx));

      // Resolve contradictions
      const resolved: FounderPreferenceMemoryRecord[] = [];
      for (const rec of matched) {
        const idx = resolved.findIndex((r) => contradicts(r, rec));
        if (idx < 0) {
          resolved.push(rec);
          continue;
        }
        resolved[idx] = winner(resolved[idx]!, rec);
      }

      resolved.sort((a, b) => {
        const br = bucketRank(a.scope) - bucketRank(b.scope);
        if (br !== 0) return br;
        const cr = CONFIDENCE_RANK[b.confidence] - CONFIDENCE_RANK[a.confidence];
        if (cr !== 0) return cr;
        return (Date.parse(b.updated_at) || 0) - (Date.parse(a.updated_at) || 0);
      });

      return resolved.slice(0, MAX_RECORDS);
    } catch {
      return [];
    }
  }
}

export function retrieveFounderPreferencesSafe(
  ctx: GenerationTargetContext,
  repoRoot?: string,
): FounderPreferenceMemoryRecord[] {
  try {
    return new FounderPreferenceRetriever(
      new FounderPreferenceMemoryStore(repoRoot),
    ).retrieve(ctx);
  } catch {
    return [];
  }
}
