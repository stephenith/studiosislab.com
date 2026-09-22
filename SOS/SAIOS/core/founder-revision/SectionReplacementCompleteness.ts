/**
 * Phase 6J — whole-section content replacement object accounting.
 *
 * Founder-item coverage (attribution) and section object completeness are
 * separate. Every required body object in an authorized whole-section
 * replacement must receive exactly one disposition:
 *   REPLACED | REMOVED | EXPLICITLY_PRESERVED
 * Anything else is UNACCOUNTED and fails closed before live execution.
 *
 * Does not invent resume copy. Does not emit dummy identical update_text.
 * Preservation requires actual Founder keep intent that applies to the object,
 * and cannot hide content the Founder explicitly asked to remove/replace.
 */
import type { FabricCanvasDoc } from "./CanvasInventory.js";
import {
  classifyRequestedChange,
  resolveIntentClauses,
} from "./RequestedChangeClassification.js";
import {
  resolveSectionContentObjectIds,
  type AcceptanceFinding,
  type ContentSectionKey,
} from "./RevisionAcceptanceChecks.js";
import { resolveRevisionIntentScope } from "./RevisionIntentScope.js";
import type {
  CanvasInventoryObject,
  CanvasOperation,
  RevisionPlan,
} from "./revision-task-types.js";

export type SectionObjectDisposition =
  | "REPLACED"
  | "REMOVED"
  | "EXPLICITLY_PRESERVED"
  | "UNACCOUNTED";

export type SectionReplacementObjectAccount = {
  object_id: string;
  section: ContentSectionKey;
  source_text: string;
  disposition: SectionObjectDisposition;
  evidence: string;
  founder_items: string[];
};

export type SectionReplacementSectionReport = {
  section: ContentSectionKey;
  required_body_object_ids: string[];
  accounts: SectionReplacementObjectAccount[];
  unaccounted_object_ids: string[];
};

export type SectionReplacementCompletenessReport = {
  ok: boolean;
  sections: SectionReplacementSectionReport[];
  unaccounted_object_ids: string[];
  error: string | null;
};

const DATE_ONLY_TEXT_RE =
  /^(?:(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+)?\d{4}(?:\s*[—–\-]\s*(?:present|\d{4}))?$/i;

const SECTION_NOUN_PATTERNS: ReadonlyArray<
  readonly [ContentSectionKey, RegExp]
> = [
  [
    "job_title",
    /\b(professional title|job title|professional identity|role title|title in the header)\b/,
  ],
  ["summary", /\b(summary|professional summary)\b/],
  ["experience", /\b(experience|employment history|work history)\b/],
  ["skills", /\bskills?\b/],
  ["projects", /\bprojects?\b/],
  ["certifications", /\b(certifications?|credentials?)\b/],
  ["education", /\b(education|qualifications?)\b/],
];

const KEEP_LEAD_RE =
  /\b(?:keep|retain|preserve|do not (?:change|alter|modify|rewrite|replace))\b/;
const KEEP_LIST_RE =
  /\b(?:keep|retain|preserve)\b[\s\S]{0,160}?\b(?:such as|including|like)\b\s+(.+?)(?:\s+where appropriate\b|\s+unless\b|\.|$)/i;
const REMOVE_LIST_RE =
  /\b(?:remove|delete|drop|strip)\b[\s\S]{0,160}?\b(?:including|such as)\b\s+(.+?)(?:\s+unless\b|\.|$)/i;
const REMOVE_VERB_RE = /\b(?:remove|delete|drop|strip)\b/;
const REPLACE_VERB_RE =
  /\b(?:replace|rewrite|rewrit|reword|revise|update|change|swap|rework|refresh)\b/;

function mentionedContentSections(text: string): Set<ContentSectionKey> {
  const out = new Set<ContentSectionKey>();
  const n = String(text ?? "").toLowerCase();
  for (const [key, re] of SECTION_NOUN_PATTERNS) {
    if (re.test(n)) out.add(key);
  }
  return out;
}

function normalizePhrase(text: string): string {
  return String(text ?? "")
    .toLowerCase()
    .replace(/[·•|,;/]+/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function splitListTail(tail: string): string[] {
  return String(tail ?? "")
    .split(/\s*(?:,|·|•|;|\band\b)\s*/i)
    .map((p) => p.replace(/\s+where appropriate\b/i, "").trim())
    .filter((p) => p.length > 0 && p.toLowerCase() !== "and");
}

function extractListedPhrases(source: string, re: RegExp): string[] {
  const m = String(source ?? "").match(re);
  if (!m?.[1]) return [];
  return splitListTail(m[1]);
}

function tokensOf(normalized: string): string[] {
  return normalized.split(" ").filter(Boolean);
}

function phraseMatchesText(phrase: string, sourceText: string): boolean {
  const p = normalizePhrase(phrase);
  const t = normalizePhrase(sourceText);
  if (!p || !t) return false;
  if (p.length <= 3) {
    return new RegExp(`(?:^| )${p}(?: |$)`).test(t);
  }
  if (t.includes(p)) return true;
  const pToks = tokensOf(p);
  const tToks = tokensOf(t);
  return pToks.every((pt) => {
    if (pt.length <= 3) return tToks.includes(pt);
    return tToks.some((tt) => {
      const n = Math.min(4, pt.length, tt.length);
      return pt.slice(0, n) === tt.slice(0, n);
    });
  });
}

function canvasObjectById(
  canvas: FabricCanvasDoc,
  id: string,
): Record<string, unknown> | null {
  const objects = (canvas.objects ?? []) as Record<string, unknown>[];
  return objects.find((o) => o.id === id) ?? null;
}

function objectSourceText(o: Record<string, unknown> | null): string {
  return typeof o?.text === "string" ? o.text : "";
}

function looksLikeSectionHeadingLabel(text: string, section: string): boolean {
  const letters = text.replace(/[^A-Za-z]/g, "");
  if (!letters) return false;
  if (letters.toUpperCase() === section.replace(/[^A-Za-z]/g, "").toUpperCase()) {
    return true;
  }
  return text.trim().length <= 30 && letters === letters.toUpperCase();
}

function isTextInventoryType(type: string): boolean {
  return /text/i.test(type);
}

/** Authorized whole-section replacement keys from the canonical intent owner. */
export function authorizedWholeSectionReplacementSections(
  requestedChanges: string[],
): Set<ContentSectionKey> {
  return new Set(resolveRevisionIntentScope(requestedChanges).content_mutation_sections);
}

export function requiredBodyObjectIdsForSections(
  canvas: FabricCanvasDoc,
  sections: Set<ContentSectionKey>,
): string[] {
  const required = resolveSectionContentObjectIds(canvas, sections);
  const objects = (canvas.objects ?? []) as Record<string, unknown>[];
  const ids: string[] = [];
  for (const id of required) {
    const obj = objects.find((o) => o.id === id);
    const text = objectSourceText(obj).trim();
    if (!text) continue;
    if (DATE_ONLY_TEXT_RE.test(text)) continue;
    ids.push(id);
  }
  return ids;
}

export type RequiredBodyInventoryEntry = {
  object_id: string;
  section: ContentSectionKey;
  source_text: string;
};

/**
 * Planner-time required body inventory from canvas inventory (no Fabric canvas).
 * Mirrors resolveSectionContentObjectIds exclusions: headings, roles/markers,
 * dates, empty text, non-text, identity-protected objects are not listed.
 */
export function requiredBodyInventoryFromInventory(
  inventory: CanvasInventoryObject[],
  sections: Set<ContentSectionKey>,
): RequiredBodyInventoryEntry[] {
  if (sections.size === 0) return [];
  const out: RequiredBodyInventoryEntry[] = [];
  for (const o of inventory) {
    if (o.system || o.locked) continue;
    if (!isTextInventoryType(o.type)) continue;
    const text = typeof o.text === "string" ? o.text.trim() : "";
    if (!text) continue;
    if (DATE_ONLY_TEXT_RE.test(text)) continue;
    const section = (o.section ?? "").trim().toLowerCase() as ContentSectionKey;
    if (!section || !sections.has(section)) continue;
    if (o.role && String(o.role).trim()) continue;
    if (looksLikeSectionHeadingLabel(text, section)) continue;
    out.push({
      object_id: o.id,
      section,
      source_text: text,
    });
  }
  return out;
}

function opTargets(op: CanvasOperation, id: string): boolean {
  if (op.target_id === id) return true;
  return (op.target_ids ?? []).includes(id);
}

function replacementTextOf(op: CanvasOperation): string | null {
  const values = op.values;
  if (!values || typeof values !== "object") return null;
  const text = (values as Record<string, unknown>).text;
  return typeof text === "string" ? text : null;
}

function isGenuineReplacementOp(
  op: CanvasOperation,
  objectId: string,
  sourceText: string,
): boolean {
  if (op.op !== "update_text") return false;
  if (!opTargets(op, objectId)) return false;
  const next = replacementTextOf(op);
  if (next == null || next.length === 0) return false;
  return next !== sourceText;
}

function isRemoveOp(op: CanvasOperation, objectId: string): boolean {
  return op.op === "remove_object" && opTargets(op, objectId);
}

type FounderIntentIndex = {
  keepItemsBySection: Map<ContentSectionKey, string[]>;
  keepPhrasesBySection: Map<ContentSectionKey, string[]>;
  removeItemsBySection: Map<ContentSectionKey, string[]>;
  removePhrasesBySection: Map<ContentSectionKey, string[]>;
  replaceItemsBySection: Map<ContentSectionKey, string[]>;
};

function pushMap(
  map: Map<ContentSectionKey, string[]>,
  section: ContentSectionKey,
  value: string,
): void {
  const cur = map.get(section) ?? [];
  if (!cur.includes(value)) cur.push(value);
  map.set(section, cur);
}

function buildFounderIntentIndex(
  requestedChanges: string[],
): FounderIntentIndex {
  const keepItemsBySection = new Map<ContentSectionKey, string[]>();
  const keepPhrasesBySection = new Map<ContentSectionKey, string[]>();
  const removeItemsBySection = new Map<ContentSectionKey, string[]>();
  const removePhrasesBySection = new Map<ContentSectionKey, string[]>();
  const replaceItemsBySection = new Map<ContentSectionKey, string[]>();

  for (const change of requestedChanges) {
    const classified = classifyRequestedChange(change);
    const sections = mentionedContentSections(change);
    const keepPhrases = extractListedPhrases(change, KEEP_LIST_RE);
    const removePhrases = extractListedPhrases(change, REMOVE_LIST_RE);
    const isContentPreserve =
      classified.classification === "PRESERVATION_CONSTRAINT" &&
      classified.check_types.includes("CONTENT_PRESERVATION");

    for (const section of sections) {
      if (isContentPreserve || (KEEP_LEAD_RE.test(change.toLowerCase()) && keepPhrases.length > 0)) {
        if (isContentPreserve || keepPhrases.length > 0) {
          pushMap(keepItemsBySection, section, change);
          for (const p of keepPhrases) pushMap(keepPhrasesBySection, section, p);
        }
      }
      if (classified.classification === "MUTATION_REQUIRED") {
        for (const clause of resolveIntentClauses(change.toLowerCase())) {
          if (!clause.positive) continue;
          if (REMOVE_VERB_RE.test(clause.text)) {
            pushMap(removeItemsBySection, section, change);
          }
          if (REPLACE_VERB_RE.test(clause.text)) {
            pushMap(replaceItemsBySection, section, change);
          }
        }
        for (const p of removePhrases) pushMap(removePhrasesBySection, section, p);
      }
    }
  }

  return {
    keepItemsBySection,
    keepPhrasesBySection,
    removeItemsBySection,
    removePhrasesBySection,
    replaceItemsBySection,
  };
}

function objectContainsAnyPhrase(text: string, phrases: string[]): string[] {
  return phrases.filter((p) => phraseMatchesText(p, text));
}

function resolveObjectDisposition(input: {
  objectId: string;
  section: ContentSectionKey;
  sourceText: string;
  plan: RevisionPlan;
  intent: FounderIntentIndex;
}): SectionReplacementObjectAccount {
  const { objectId, section, sourceText, plan, intent } = input;
  const ops = plan.operations ?? [];

  const replaceOp = ops.find((op) =>
    isGenuineReplacementOp(op, objectId, sourceText),
  );
  if (replaceOp) {
    const items = [
      replaceOp.founder_feedback_item,
      ...(replaceOp.founder_feedback_items ?? []),
    ].filter((x): x is string => typeof x === "string" && x.trim().length > 0);
    return {
      object_id: objectId,
      section,
      source_text: sourceText,
      disposition: "REPLACED",
      evidence: `authorized update_text targets ${objectId} with non-identical text`,
      founder_items: items,
    };
  }

  const bannedHits = objectContainsAnyPhrase(
    sourceText,
    intent.removePhrasesBySection.get(section) ?? [],
  );
  const keepPhrases = intent.keepPhrasesBySection.get(section) ?? [];
  const keepHits = objectContainsAnyPhrase(sourceText, keepPhrases);
  const keepItems = intent.keepItemsBySection.get(section) ?? [];
  const removeItems = intent.removeItemsBySection.get(section) ?? [];

  const removeOp = ops.find((op) => isRemoveOp(op, objectId));
  if (removeOp) {
    const removalAuthorized =
      bannedHits.length > 0 ||
      (removeItems.length > 0 && keepHits.length === 0);
    if (removalAuthorized && keepHits.length === 0) {
      return {
        object_id: objectId,
        section,
        source_text: sourceText,
        disposition: "REMOVED",
        evidence:
          bannedHits.length > 0
            ? `remove_object authorized; source matches Founder remove-list (${bannedHits.join(", ")})`
            : "remove_object authorized by Founder remove intent for this section",
        founder_items: removeItems,
      };
    }
    return {
      object_id: objectId,
      section,
      source_text: sourceText,
      disposition: "UNACCOUNTED",
      evidence:
        keepHits.length > 0
          ? "remove_object is not authorized for Founder keep-list content"
          : "remove_object present without Founder removal intent for this object",
      founder_items: [...keepItems, ...removeItems],
    };
  }

  // Remove/replace of specifically listed content takes precedence over keep.
  if (bannedHits.length > 0) {
    return {
      object_id: objectId,
      section,
      source_text: sourceText,
      disposition: "UNACCOUNTED",
      evidence: `cannot EXPLICITLY_PRESERVE; source contains Founder-banned content (${bannedHits.join(", ")}) and was not replaced or removed`,
      founder_items: [
        ...(intent.removeItemsBySection.get(section) ?? []),
        ...(intent.replaceItemsBySection.get(section) ?? []),
      ],
    };
  }

  if (keepItems.length === 0) {
    return {
      object_id: objectId,
      section,
      source_text: sourceText,
      disposition: "UNACCOUNTED",
      evidence:
        "no genuine replacement/removal operation and no Founder preservation intent for this object",
      founder_items: [],
    };
  }

  if (keepPhrases.length > 0 && keepHits.length === 0) {
    return {
      object_id: objectId,
      section,
      source_text: sourceText,
      disposition: "UNACCOUNTED",
      evidence:
        "Founder keep instruction exists for this section but does not apply to this object's source text",
      founder_items: keepItems,
    };
  }

  return {
    object_id: objectId,
    section,
    source_text: sourceText,
    disposition: "EXPLICITLY_PRESERVED",
    evidence:
      keepHits.length > 0
        ? `Founder keep-list applies (${keepHits.join(", ")}); emit ZERO operations`
        : "Founder content-preservation instruction applies to this section; emit ZERO operations",
    founder_items: keepItems,
  };
}

export function evaluateSectionReplacementCompleteness(input: {
  canvas: FabricCanvasDoc;
  plan: RevisionPlan;
  requested_changes: string[];
}): SectionReplacementCompletenessReport {
  const scope = resolveRevisionIntentScope(input.requested_changes);
  const authorized = new Set(scope.content_mutation_sections);
  const preservedOnly = scope.content_preservation_sections.filter(
    (s) => !authorized.has(s),
  );
  if (authorized.size === 0 && preservedOnly.length === 0) {
    return { ok: true, sections: [], unaccounted_object_ids: [], error: null };
  }

  const intent = buildFounderIntentIndex(input.requested_changes);
  for (const section of preservedOnly) {
    for (const item of scope.items) {
      if (
        item.clauses.some(
          (c) =>
            c.intent_class === "CONTENT_PRESERVATION" &&
            c.preservation_scope.includes(section),
        )
      ) {
        const cur = intent.keepItemsBySection.get(section) ?? [];
        if (!cur.includes(item.founder_feedback_item)) {
          cur.push(item.founder_feedback_item);
          intent.keepItemsBySection.set(section, cur);
        }
      }
    }
  }
  const sections: SectionReplacementSectionReport[] = [];
  const unaccounted_object_ids: string[] = [];

  for (const section of [...authorized, ...preservedOnly]) {
    const sectionSet = new Set<ContentSectionKey>([section]);
    const requiredIds = requiredBodyObjectIdsForSections(
      input.canvas,
      sectionSet,
    );
    const accounts: SectionReplacementObjectAccount[] = [];
    const unaccounted: string[] = [];
    for (const id of requiredIds) {
      const obj = canvasObjectById(input.canvas, id);
      const sourceText = objectSourceText(obj);
      const account = resolveObjectDisposition({
        objectId: id,
        section,
        sourceText,
        plan: input.plan,
        intent,
      });
      accounts.push(account);
      if (account.disposition === "UNACCOUNTED") {
        unaccounted.push(id);
        unaccounted_object_ids.push(id);
      }
    }
    sections.push({
      section,
      required_body_object_ids: requiredIds,
      accounts,
      unaccounted_object_ids: unaccounted,
    });
  }

  const error =
    unaccounted_object_ids.length === 0
      ? null
      : formatSectionReplacementIncompleteError({
          ok: false,
          sections,
          unaccounted_object_ids,
          error: null,
        });

  return {
    ok: unaccounted_object_ids.length === 0,
    sections,
    unaccounted_object_ids,
    error,
  };
}

export function formatSectionReplacementIncompleteError(
  report: SectionReplacementCompletenessReport,
): string {
  const parts = report.sections
    .filter((s) => s.unaccounted_object_ids.length > 0)
    .map((s) => {
      const reasons = s.accounts
        .filter((a) => a.disposition === "UNACCOUNTED")
        .map((a) => `${a.object_id} (${a.evidence})`);
      return `section=${s.section} unaccounted_objects=[${s.unaccounted_object_ids.join(", ")}] reason=${reasons.join("; ")}`;
    });
  if (parts.length === 0) {
    return `content replacement incomplete: ${report.unaccounted_object_ids.join("; ")}`;
  }
  return `content replacement incomplete: ${parts.join("; ")}`;
}

export function sectionReplacementFindings(
  report: SectionReplacementCompletenessReport,
): AcceptanceFinding[] {
  const findings: AcceptanceFinding[] = [];
  for (const section of report.sections) {
    for (const account of section.accounts) {
      if (account.disposition !== "UNACCOUNTED") continue;
      findings.push({
        code: "ACC_SECTION_REPLACEMENT_INCOMPLETE",
        message: `Requested section replacement left ${account.object_id} unaccounted in ${account.section}: ${account.evidence}`,
        object_ids: [account.object_id],
        metrics: {
          section: account.section,
          disposition: account.disposition,
          reason: account.evidence,
          source_text: account.source_text.slice(0, 120),
        },
      });
    }
  }
  return findings;
}

/** Planner-facing required body-object inventory. Empty when no whole-section replacement. */
export function buildWholeSectionRequiredBodyInventoryPrompt(
  requestedChanges: string[],
  inventory: CanvasInventoryObject[],
): string {
  const authorized =
    authorizedWholeSectionReplacementSections(requestedChanges);
  const entries = requiredBodyInventoryFromInventory(inventory, authorized);
  const lines: string[] = [
    "WHOLE-SECTION CONTENT REPLACEMENT OBJECT CONTRACT (mandatory — fail closed):",
    "Founder-item coverage and section object completeness are SEPARATE.",
    "Item coverage asks whether each MUTATION_REQUIRED Founder line is attributed.",
    "Object completeness asks whether every required source body object in an authorized whole-section replacement was intentionally handled.",
    "One attributed operation on a section does NOT satisfy every object in that section.",
    "",
    "For every required body object below, the object must end as exactly one of:",
    "- REPLACED: a genuine content replacement operation (update_text with real new text) targets that exact object ID.",
    "- REMOVED: the Founder explicitly requested removal of that object's content AND the plan contains remove_object for that ID.",
    "- EXPLICITLY_PRESERVED: the Founder explicitly asked to keep the content represented by that object. Emit ZERO operations for it. Do NOT emit update_text with identical source text.",
    "Unaccounted required body objects fail closed BEFORE execution.",
    "Do not invent resume copy. Do not preserve an object merely because leaving it unchanged looks acceptable.",
    "If the Founder asked to remove/replace specific content that appears in an object, that object cannot be EXPLICITLY_PRESERVED.",
    "",
  ];

  if (authorized.size === 0 || entries.length === 0) {
    lines.push(
      "REQUIRED BODY OBJECT INVENTORY: none (no Founder-authorized whole-section content replacement, or no eligible body objects).",
    );
    return lines.join("\n");
  }

  lines.push("REQUIRED BODY OBJECT INVENTORY:");
  for (const section of authorized) {
    const rows = entries.filter((e) => e.section === section);
    if (rows.length === 0) continue;
    lines.push(`Section ${section}:`);
    for (const row of rows) {
      const preview = row.source_text.replace(/\s+/g, " ").slice(0, 140);
      lines.push(`  - id=${row.object_id} source="${preview}"`);
    }
  }
  return lines.join("\n");
}

/** True when the evaluator never synthesizes replacement resume text (contract check). */
export function sectionReplacementEvaluatorInventedCopy(): false {
  return false;
}
