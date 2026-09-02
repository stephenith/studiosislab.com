/**
 * Phase 6B — Canonical Founder Memory consumption (read-side).
 * Write-side store/retriever remain authoritative; this layer decides what is
 * safe to inject into generation/revision prompts with bounded, scoped selection.
 */
import { createHash } from "node:crypto";
import {
  CONFIDENCE_RANK,
  SCOPE_SPECIFICITY,
  type FounderPreferenceMemoryRecord,
  type GenerationTargetContext,
  type MemoryScope,
} from "./FounderPreferenceMemoryTypes.js";
import { FounderPreferenceMemoryStore } from "./FounderPreferenceMemoryStore.js";
import { classifyIssueType } from "./FounderPreferenceNormalizer.js";

export const FOUNDER_MEMORY_SELECTION_SCHEMA =
  "founder-memory-selection-1.0.0" as const;

export const MAX_SELECTED_RULES = 8;
export const MAX_MEMORY_PROMPT_CHARS = 600;

export type MemoryEligibilityKind =
  | "ELIGIBLE"
  | "INELIGIBLE"
  | "SUPERSEDED"
  | "CONFLICTING"
  | "IRRELEVANT"
  | "AMBIGUOUS";

export type MemoryExclusion = {
  memory_id: string;
  kind: MemoryEligibilityKind;
  reason: string;
};

export type SelectedMemoryRule = {
  memory_id: string;
  scope: MemoryScope;
  issue_type: string;
  status: string;
  confidence: string;
  signal_type: string;
  injectable_text: string;
  content_hash: string;
};

export type FounderMemorySelectionResult = {
  schema_version: typeof FOUNDER_MEMORY_SELECTION_SCHEMA;
  channel: "generation" | "revision";
  selected: SelectedMemoryRule[];
  excluded: MemoryExclusion[];
  memory_ids: string[];
  prompt_block: string;
  truncated: boolean;
  prompt_hash: string;
  FOUNDER_MEMORY_CONSUMED: boolean;
  evaluated_at: string;
};

const LAYOUT_ISSUE_TYPES = new Set([
  "SPACING",
  "HIERARCHY",
  "TYPOGRAPHY",
  "LAYOUT_BALANCE",
  "UNIQUENESS",
]);

const FACTUAL_RE =
  /\b(aws|azure|gcp|certification|certified|bachelor|master'?s|phd|degree|gpa|employer|worked at|years? of experience|\d+\+?\s*years|salary|revenue of \$|increased sales by \d+|linkedin\.com\/in\/)\b/i;

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
      return Boolean(
        rec.architecture && norm(rec.architecture) === norm(ctx.architecture),
      );
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
      // Without a section context, section-scoped rules are irrelevant.
      return Boolean(rec.section && norm(rec.section) === norm(ctx.section));
    case "COMPONENT":
      return Boolean(
        rec.component && norm(rec.component) === norm(ctx.component),
      );
  }
}

/** True when text is layout/design/quality — not resume factual content. */
export function isLayoutDesignConstraintText(text: string): boolean {
  const t = text.trim();
  if (!t || FACTUAL_RE.test(t)) return false;
  const issue = classifyIssueType(t);
  if (issue === "CONTENT_INTEGRITY") return false;
  if (LAYOUT_ISSUE_TYPES.has(issue)) return true;
  // OTHER may still be layout-ish
  return /\b(spacing|gap|padding|margin|overlap|collision|align|hierarchy|typography|font|layout|sidebar|column|rhythm|whitespace|balance|compact)\b/i.test(
    t,
  );
}

export function injectableTextForRecord(
  rec: FounderPreferenceMemoryRecord,
): string | null {
  if (rec.signal_type === "CONSTRAINT" || rec.signal_type === "PREFERENCE") {
    const t = rec.normalized_rule?.trim() ?? "";
    return t || null;
  }
  if (rec.signal_type === "POSITIVE_EXEMPLAR") {
    // Prefer Founder's design praise over boilerplate "approved this exemplar".
    const raw = rec.raw_founder_feedback?.trim() ?? "";
    if (raw && isLayoutDesignConstraintText(raw)) return raw.slice(0, 160);
    return null;
  }
  if (rec.signal_type === "NEGATIVE_EXEMPLAR") {
    const rule = rec.normalized_rule?.trim() ?? "";
    if (!rule) return null;
    if (/^founder rejected this exemplar\.?$/i.test(rule)) return null;
    return rule;
  }
  return null;
}

export function classifyMemoryEligibility(
  rec: FounderPreferenceMemoryRecord,
  ctx: GenerationTargetContext,
  currentFounderRequests: string[] = [],
): { kind: MemoryEligibilityKind; reason: string; injectable_text?: string } {
  if (!rec.active) {
    return { kind: "INELIGIBLE", reason: "inactive record" };
  }
  if (rec.status === "SUPERSEDED" || rec.superseded_by) {
    return { kind: "SUPERSEDED", reason: "superseded by newer memory" };
  }
  if (rec.status === "REJECTED") {
    return { kind: "INELIGIBLE", reason: "status REJECTED" };
  }
  if (rec.acceptance_result === "rejected") {
    return { kind: "INELIGIBLE", reason: "acceptance_result rejected" };
  }

  if (!scopeMatches(rec, ctx)) {
    return { kind: "IRRELEVANT", reason: `scope ${rec.scope} does not match context` };
  }

  const text = injectableTextForRecord(rec);
  if (!text) {
    return {
      kind: "INELIGIBLE",
      reason: "no injectable design/preference text",
    };
  }
  if (!isLayoutDesignConstraintText(text)) {
    return {
      kind: "INELIGIBLE",
      reason: "factual or non-layout content excluded from design memory",
    };
  }

  // Lifecycle / outcome safety
  if (rec.status === "CONFIRMED") {
    // ok
  } else if (rec.status === "PROVISIONAL") {
    // Fail closed on single low-confidence provisional (often written before revision outcome).
    if (rec.confidence === "low") {
      return {
        kind: "AMBIGUOUS",
        reason: "PROVISIONAL + low confidence — outcome not validated",
      };
    }
    if (!LAYOUT_ISSUE_TYPES.has(rec.issue_type) && rec.issue_type !== "OTHER") {
      return {
        kind: "AMBIGUOUS",
        reason: `PROVISIONAL issue_type ${rec.issue_type} not layout-safe`,
      };
    }
  } else {
    return { kind: "INELIGIBLE", reason: `status ${rec.status}` };
  }

  if (conflictsWithCurrentFounderRequest(text, currentFounderRequests)) {
    return {
      kind: "CONFLICTING",
      reason: "conflicts with current Founder request (current wins)",
    };
  }

  return { kind: "ELIGIBLE", reason: "eligible for prompt injection", injectable_text: text };
}

export function conflictsWithCurrentFounderRequest(
  memoryText: string,
  currentRequests: string[],
): boolean {
  if (!currentRequests.length) return false;
  const mem = memoryText.toLowerCase();
  for (const req of currentRequests) {
    const r = req.toLowerCase();
    // Preserve/keep vs explicit move/change on same object class
    const memPreserve =
      /\b(keep|preserve|do not move|don't move|leave|maintain)\b/.test(mem) &&
      /\b(contact|header|position|location)\b/.test(mem);
    const reqMove =
      /\b(move|shift|lower|raise|downward|upward|down by|up by)\b/.test(r) &&
      /\b(contact|header)\b/.test(r);
    if (memPreserve && reqMove) return true;

    const memNoChange = /\b(do not change|don't change|keep current)\b/.test(mem);
    const reqChange = /\b(change|update|restyle|recolor|resize)\b/.test(r);
    if (memNoChange && reqChange) {
      // Same subject token overlap
      const subjects = ["contact", "header", "skills", "experience", "sidebar"];
      if (subjects.some((s) => mem.includes(s) && r.includes(s))) return true;
    }
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
  return true;
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

function bucketRank(scope: MemoryScope): number {
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

function dedupeKey(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .slice(0, 120);
}

export function renderFounderMemoryPromptBlock(
  selected: SelectedMemoryRule[],
  opts?: { maxChars?: number },
): { block: string; memory_ids: string[]; truncated: boolean } {
  const maxChars = opts?.maxChars ?? MAX_MEMORY_PROMPT_CHARS;
  if (!selected.length) return { block: "", memory_ids: [], truncated: false };

  const header = [
    "FOUNDER DESIGN MEMORY",
    "These are StudiosisLab Founder layout/design/quality preferences.",
    "They are NOT resume facts. Do not invent employers, credentials, metrics, or skills from memory.",
    "CURRENT FOUNDER REQUEST (if any) always has higher authority than memory.",
  ].join("\n");
  const footer =
    "Memory guides compatible layout quality only; never override current Founder instructions or factual-content safety.";

  const lines: string[] = [];
  const ids: string[] = [];
  let truncated = false;
  for (const rec of selected) {
    const line = `- [${rec.scope}|${rec.confidence}|${rec.status}] ${rec.injectable_text}`;
    const trial = [header, ...lines, line, "", footer].join("\n");
    if (trial.length > maxChars) {
      truncated = true;
      break;
    }
    lines.push(line);
    ids.push(rec.memory_id);
  }
  if (!lines.length) return { block: "", memory_ids: [], truncated: true };
  return {
    block: [header, ...lines, "", footer].join("\n"),
    memory_ids: ids,
    truncated,
  };
}

export function selectFounderMemory(opts: {
  ctx: GenerationTargetContext;
  channel: "generation" | "revision";
  currentFounderRequests?: string[];
  repoRoot?: string;
  store?: FounderPreferenceMemoryStore;
  maxRules?: number;
  maxChars?: number;
}): FounderMemorySelectionResult {
  const store =
    opts.store ?? new FounderPreferenceMemoryStore(opts.repoRoot);
  const current = opts.currentFounderRequests ?? [];
  const maxRules = opts.maxRules ?? MAX_SELECTED_RULES;
  const excluded: MemoryExclusion[] = [];
  const eligibleRecs: Array<{
    rec: FounderPreferenceMemoryRecord;
    text: string;
  }> = [];

  let active: FounderPreferenceMemoryRecord[] = [];
  try {
    active = store.listActive();
  } catch {
    active = [];
  }

  for (const rec of active) {
    const verdict = classifyMemoryEligibility(rec, opts.ctx, current);
    if (verdict.kind !== "ELIGIBLE" || !verdict.injectable_text) {
      excluded.push({
        memory_id: rec.memory_id,
        kind: verdict.kind,
        reason: verdict.reason,
      });
      continue;
    }
    eligibleRecs.push({ rec, text: verdict.injectable_text });
  }

  // Resolve contradictory pairs
  const resolved: Array<{ rec: FounderPreferenceMemoryRecord; text: string }> =
    [];
  for (const item of eligibleRecs) {
    const idx = resolved.findIndex((r) => contradicts(r.rec, item.rec));
    if (idx < 0) {
      resolved.push(item);
      continue;
    }
    const keep = winner(resolved[idx]!.rec, item.rec);
    const drop =
      keep.memory_id === item.rec.memory_id ? resolved[idx]!.rec : item.rec;
    excluded.push({
      memory_id: drop.memory_id,
      kind: "CONFLICTING",
      reason: "contradictory preference pair — kept higher confidence/specificity",
    });
    resolved[idx] = {
      rec: keep,
      text:
        keep.memory_id === item.rec.memory_id
          ? item.text
          : resolved[idx]!.text,
    };
  }

  // Dedupe semantically identical text
  const deduped: typeof resolved = [];
  const seen = new Set<string>();
  for (const item of resolved) {
    const key = dedupeKey(item.text);
    if (seen.has(key)) {
      excluded.push({
        memory_id: item.rec.memory_id,
        kind: "INELIGIBLE",
        reason: "duplicate semantic preference",
      });
      continue;
    }
    seen.add(key);
    deduped.push(item);
  }

  deduped.sort((a, b) => {
    const br = bucketRank(a.rec.scope) - bucketRank(b.rec.scope);
    if (br !== 0) return br;
    const cr =
      CONFIDENCE_RANK[b.rec.confidence] - CONFIDENCE_RANK[a.rec.confidence];
    if (cr !== 0) return cr;
    return (Date.parse(b.rec.updated_at) || 0) - (Date.parse(a.rec.updated_at) || 0);
  });

  const capped = deduped.slice(0, maxRules);
  for (const dropped of deduped.slice(maxRules)) {
    excluded.push({
      memory_id: dropped.rec.memory_id,
      kind: "INELIGIBLE",
      reason: "exceeded max selected rules budget",
    });
  }

  const selected: SelectedMemoryRule[] = capped.map(({ rec, text }) => ({
    memory_id: rec.memory_id,
    scope: rec.scope,
    issue_type: rec.issue_type,
    status: rec.status,
    confidence: rec.confidence,
    signal_type: rec.signal_type,
    injectable_text: text,
    content_hash: rec.content_hash,
  }));

  const rendered = renderFounderMemoryPromptBlock(selected, {
    maxChars: opts.maxChars ?? MAX_MEMORY_PROMPT_CHARS,
  });
  // If char budget truncated further, mark extras excluded
  if (rendered.truncated) {
    for (const s of selected) {
      if (!rendered.memory_ids.includes(s.memory_id)) {
        excluded.push({
          memory_id: s.memory_id,
          kind: "INELIGIBLE",
          reason: "exceeded memory prompt character budget",
        });
      }
    }
  }
  const finalSelected = selected.filter((s) =>
    rendered.memory_ids.includes(s.memory_id),
  );

  const prompt_hash = createHash("sha256")
    .update(rendered.block || "")
    .digest("hex")
    .slice(0, 16);

  return {
    schema_version: FOUNDER_MEMORY_SELECTION_SCHEMA,
    channel: opts.channel,
    selected: finalSelected,
    excluded,
    memory_ids: finalSelected.map((s) => s.memory_id),
    prompt_block: rendered.block,
    truncated: rendered.truncated,
    prompt_hash,
    FOUNDER_MEMORY_CONSUMED: finalSelected.length > 0,
    evaluated_at: new Date().toISOString(),
  };
}
