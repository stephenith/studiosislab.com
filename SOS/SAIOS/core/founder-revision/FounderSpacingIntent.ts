/**
 * Phase 5Z — Founder spacing-intent contract + visual gap measurement.
 *
 * Measures vertical gaps between consecutive same-section text objects using
 * visual content bottoms (wrap estimate), not oversized stored textbox bottoms.
 * Used by DeterministicSpacingOwnership and FeedbackCoverage.
 */
import { createRequire } from "node:module";
import type { FabricCanvasDoc } from "./CanvasInventory.js";
import {
  isFabricTextObject,
  storedTextHeightScaled,
  visualTextContentBottom,
  visualTextContentHeightScaled,
} from "./TextEffectiveHeight.js";
import type { CanvasOperation } from "./revision-task-types.js";

const requireSpacingRelation = createRequire(import.meta.url);

/** Minimum improvement to count as "tighter/reduced" (matches coverage noise). */
export const SPACING_INTENT_IMPROVEMENT_PX = 2;

/** Minimum positive visual gap after tighten/reduce (fail-closed if collapsed). */
export const SPACING_INTENT_MIN_GAP_PX = 2;

export type SpacingIntentDirection =
  | "REDUCE_GAP"
  | "TIGHTEN_RHYTHM"
  | "INCREASE_GAP"
  | "SEPARATE"
  | "PRESERVE"
  | "NONE";

export type SpacingIntentRelation = {
  founder_feedback_item: string;
  direction: SpacingIntentDirection;
  section: string;
  upper_id: string;
  lower_id: string;
  before_gap: number;
  after_gap: number;
  satisfied: boolean;
  notes: string;
};

function normalize(s: string): string {
  return s
    .replace(/^\*+\s*/, "")
    .replace(/^\d+\.\s*/, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function num(v: unknown, fb = 0): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fb;
}

function objectId(o: Record<string, unknown>, index: number): string {
  if (typeof o.id === "string" && o.id.trim()) return o.id;
  const data = o.data;
  if (data && typeof data === "object" && !Array.isArray(data)) {
    const id = (data as { id?: unknown }).id;
    if (typeof id === "string" && id.trim()) return id;
  }
  return `obj-${index}`;
}

function sectionOf(o: Record<string, unknown>): string {
  const data = o.data;
  if (data && typeof data === "object" && !Array.isArray(data)) {
    return String((data as { section?: unknown }).section ?? "");
  }
  return "";
}

function roleOf(o: Record<string, unknown>): string {
  const data = o.data;
  if (data && typeof data === "object" && !Array.isArray(data)) {
    return String((data as { role?: unknown }).role ?? "");
  }
  return "";
}

const SECTION_ALIASES: Array<{ key: string; patterns: RegExp[] }> = [
  { key: "skills", patterns: [/\bskills?\b/] },
  { key: "experience", patterns: [/\bexperience\b/, /\bexp\b/] },
  { key: "projects", patterns: [/\bprojects?\b/] },
  { key: "certifications", patterns: [/\bcertifications?\b/, /\bcerts?\b/] },
  { key: "languages", patterns: [/\blanguages?\b/] },
  { key: "education", patterns: [/\beducation\b/] },
  { key: "summary", patterns: [/\bsummary\b/] },
];

export function sectionTokensForSpacingIntent(text: string): string[] {
  const n = normalize(text);
  const out: string[] = [];
  for (const row of SECTION_ALIASES) {
    if (row.patterns.some((p) => p.test(n))) out.push(row.key);
  }
  return out;
}

/**
 * Detect measurable Founder spacing mutation intents (not VA / preserve-rest).
 */
export function detectSpacingIntentDirection(
  requestedChange: string,
): SpacingIntentDirection {
  const n = normalize(requestedChange);
  if (!n) return "NONE";
  if (
    /\bpreserv(?:e|ing)\b/.test(n) &&
    /\b(spacing|gap|rhythm|positions?)\b/.test(n) &&
    !/\b(reduce|tighten|compact|close|increase|expand|separate)\b/.test(n)
  ) {
    return "PRESERVE";
  }
  if (
    /\b(increase|expand|enlarge|widen|grow)\b[\s\S]{0,48}\b(gap|spacing|space|clearance|margin)\b/.test(
      n,
    ) ||
    /\b(gap|spacing|space|clearance|margin)\b[\s\S]{0,48}\b(increase|expand|enlarge|widen|grow)\b/.test(
      n,
    )
  ) {
    // Exclude "increase … height/size … line spacing" (height/content fixes).
    if (
      !/\b(increase|expand|enlarge|grow)\b[\s\S]{0,40}\b(height|size|width|font)\b/.test(
        n,
      )
    ) {
      return "INCREASE_GAP";
    }
  }
  if (
    (/\bpush\s+apart\b/.test(n) ||
      /\bseparate\s+(?:the|them|these|those|objects?|sections?|blocks?)\b/.test(
        n,
      ) ||
      /\bkeep\s+(?:them|these|those)\s+separate\b/.test(n)) &&
    /\b(gap|spacing|space|from|away|vertically)\b/.test(n)
  ) {
    return "SEPARATE";
  }
  if (
    /\b(tighten|compact|compress|collapse)\b/.test(n) &&
    /\b(gap|spacing|space|rhythm|bullets?|lines?|entries|blocks?)\b/.test(n) &&
    // Exclude whole-column "feels compact" rebalance (not a measured section relation).
    !/\b(column|sidebar|page|available\s+vertical\s+space)\b/.test(n)
  ) {
    return "TIGHTEN_RHYTHM";
  }
  if (
    /\b(reduce|close|shrink|remove|eliminate)\b/.test(n) &&
    /\b(excessive|large|huge|extra|unnecessary|empty)?\s*(vertical\s+)?(gap|spacing|whitespace|white\s+space)\b/.test(
      n,
    )
  ) {
    return "REDUCE_GAP";
  }
  if (
    /\b(reduce|close)\b/.test(n) &&
    /\b(gap|spacing)\b/.test(n) &&
    /\b(internal|between|inside|within)\b/.test(n)
  ) {
    return "REDUCE_GAP";
  }
  if (
    /\bvisually\s+(detached|disconnected|separated)\b/.test(n) &&
    /\b(rebalance|reconnect|bring|closer|spacing|positions?)\b/.test(n)
  ) {
    return "REDUCE_GAP";
  }
  if (
    /\bconsistent\b/.test(n) &&
    /\b(line\s+spacing|reading\s+rhythm|bullet)\b/.test(n) &&
    /\b(tighten|compact|reduce|coherent|connected)?/.test(n)
  ) {
    // "consistent line spacing" with coherent block language → tighten/reduce
    if (/\b(coherent|connected|excessive|detached|tighten|compact)\b/.test(n)) {
      return "TIGHTEN_RHYTHM";
    }
  }
  return "NONE";
}

/**
 * True when coverage must prove a measured spacing relation (not op-count).
 */
export function isFounderMeasurableSpacingIntent(
  requestedChange: string,
): boolean {
  const d = detectSpacingIntentDirection(requestedChange);
  return (
    d === "REDUCE_GAP" ||
    d === "TIGHTEN_RHYTHM" ||
    d === "INCREASE_GAP" ||
    d === "SEPARATE"
  );
}

function isHeadingLike(o: Record<string, unknown>): boolean {
  const role = roleOf(o).toLowerCase();
  if (
    role === "section-heading" ||
    role === "heading" ||
    role === "section_heading"
  ) {
    return true;
  }
  const t = String(o.text ?? "")
    .trim()
    .toUpperCase();
  return /^(SKILLS|EXPERIENCE|PROJECTS|CERTIFICATIONS|LANGUAGES|EDUCATION|SUMMARY)\b/.test(
    t,
  );
}

function isBulletLike(o: Record<string, unknown>): boolean {
  const t = String(o.text ?? "").trim();
  return t.startsWith("•") || t.startsWith("-") || t.startsWith("–");
}

type TextRow = {
  id: string;
  top: number;
  obj: Record<string, unknown>;
  contentBottom: number;
};

function sectionTextRows(
  canvas: FabricCanvasDoc,
  section: string,
): TextRow[] {
  const rows: TextRow[] = [];
  const objs = (canvas.objects ?? []) as Array<Record<string, unknown>>;
  for (let i = 0; i < objs.length; i++) {
    const o = objs[i]!;
    if (!isFabricTextObject(o)) continue;
    if (sectionOf(o) !== section) continue;
    const id = objectId(o, i);
    const top = num(o.top);
    rows.push({
      id,
      top,
      obj: o,
      contentBottom: visualTextContentBottom(o),
    });
  }
  rows.sort((a, b) => a.top - b.top || a.id.localeCompare(b.id));
  return rows;
}

/**
 * Consecutive body-text visual gaps in a section (skips heading→first body).
 * For Experience, prefers bullet→bullet pairs when ≥2 bullets exist.
 */
export function measureSectionVisualContentGaps(
  canvas: FabricCanvasDoc,
  section: string,
): Array<{ upper_id: string; lower_id: string; gap: number }> {
  const rows = sectionTextRows(canvas, section);
  if (rows.length < 2) return [];
  const body = rows.filter((r) => !isHeadingLike(r.obj));
  const bullets = body.filter((r) => isBulletLike(r.obj));
  const chain = bullets.length >= 2 ? bullets : body;
  const gaps: Array<{ upper_id: string; lower_id: string; gap: number }> = [];
  for (let i = 0; i < chain.length - 1; i++) {
    const a = chain[i]!;
    const b = chain[i + 1]!;
    gaps.push({
      upper_id: a.id,
      lower_id: b.id,
      gap: b.top - a.contentBottom,
    });
  }
  return gaps;
}

/** Largest positive visual content gap in section (Founder "large empty gap"). */
export function measureDominantVisualGap(
  canvas: FabricCanvasDoc,
  section: string,
): { upper_id: string; lower_id: string; gap: number } | null {
  const gaps = measureSectionVisualContentGaps(canvas, section);
  if (gaps.length === 0) return null;
  let best = gaps[0]!;
  for (const g of gaps) {
    if (g.gap > best.gap) best = g;
  }
  return best;
}

function median(nums: number[]): number {
  if (nums.length === 0) return 0;
  const s = [...nums].sort((a, b) => a - b);
  const mid = (s.length - 1) / 2;
  if (Number.isInteger(mid)) return s[mid]!;
  return (s[Math.floor(mid)]! + s[Math.ceil(mid)]!) / 2;
}

export function spacingIntentSatisfied(input: {
  direction: SpacingIntentDirection;
  before_gap: number;
  after_gap: number;
  before_gaps?: number[];
  after_gaps?: number[];
}): { satisfied: boolean; notes: string } {
  const { direction, before_gap, after_gap } = input;
  if (direction === "NONE" || direction === "PRESERVE") {
    return { satisfied: true, notes: "no measurable reduce/tighten/increase intent" };
  }
  if (direction === "INCREASE_GAP" || direction === "SEPARATE") {
    const ok =
      after_gap > before_gap + SPACING_INTENT_IMPROVEMENT_PX - 1e-9;
    return {
      satisfied: ok,
      notes: ok
        ? `gap increased ${before_gap.toFixed(2)}→${after_gap.toFixed(2)}`
        : `gap not increased ${before_gap.toFixed(2)}→${after_gap.toFixed(2)} (need +>${SPACING_INTENT_IMPROVEMENT_PX})`,
    };
  }
  // REDUCE_GAP / TIGHTEN_RHYTHM
  if (after_gap + 1e-9 < SPACING_INTENT_MIN_GAP_PX && after_gap < -1e-9) {
    return {
      satisfied: false,
      notes: `gap collapsed/overlap after=${after_gap.toFixed(2)}`,
    };
  }
  // Material improvement: tiny nudges must not certify "excessive gap" fixes.
  const materialImprove =
    before_gap >= 24
      ? Math.max(SPACING_INTENT_IMPROVEMENT_PX, Math.min(before_gap * 0.35, 24))
      : SPACING_INTENT_IMPROVEMENT_PX;
  if (input.before_gaps && input.after_gaps && input.before_gaps.length >= 2) {
    const beforeMed = median(input.before_gaps);
    const afterMed = median(input.after_gaps);
    const beforeSpread =
      Math.max(...input.before_gaps) - Math.min(...input.before_gaps);
    const afterSpread =
      Math.max(...input.after_gaps) - Math.min(...input.after_gaps);
    const medImprove =
      beforeMed >= 24
        ? Math.max(SPACING_INTENT_IMPROVEMENT_PX, Math.min(beforeMed * 0.35, 24))
        : SPACING_INTENT_IMPROVEMENT_PX;
    const medOk = afterMed < beforeMed - medImprove + 1e-9;
    const spreadOk =
      afterSpread <= beforeSpread + 1e-9 ||
      afterSpread < beforeSpread - 0.5;
    const dominantOk =
      after_gap < before_gap - materialImprove + 1e-9;
    const ok =
      (medOk || dominantOk) &&
      after_gap + 1e-9 >= SPACING_INTENT_MIN_GAP_PX - 1e-9;
    return {
      satisfied: ok,
      notes: ok
        ? `rhythm tightened median ${beforeMed.toFixed(2)}→${afterMed.toFixed(2)}; dominant ${before_gap.toFixed(2)}→${after_gap.toFixed(2)}; spread ${beforeSpread.toFixed(2)}→${afterSpread.toFixed(2)}`
        : `rhythm not tightened median ${beforeMed.toFixed(2)}→${afterMed.toFixed(2)}; dominant ${before_gap.toFixed(2)}→${after_gap.toFixed(2)} (need −>${materialImprove.toFixed(1)}, spread_ok=${spreadOk})`,
    };
  }
  const ok =
    after_gap < before_gap - materialImprove + 1e-9 &&
    after_gap + 1e-9 >= SPACING_INTENT_MIN_GAP_PX - 1e-9;
  return {
    satisfied: ok,
    notes: ok
      ? `gap reduced ${before_gap.toFixed(2)}→${after_gap.toFixed(2)}`
      : `gap not reduced ${before_gap.toFixed(2)}→${after_gap.toFixed(2)} (need −>${materialImprove.toFixed(1)}, min=${SPACING_INTENT_MIN_GAP_PX})`,
  };
}

/**
 * Evaluate all measurable spacing intents for a before→after pair.
 * Phase 6E: lazy-load the named-pair resolver so this module stays acyclic.
 */
export function evaluateFounderSpacingIntents(input: {
  requested_changes: string[];
  beforeCanvas: FabricCanvasDoc;
  afterCanvas: FabricCanvasDoc;
  resolved_relations?: unknown;
}): {
  intents: SpacingIntentRelation[];
  all_satisfied: boolean;
  measurable_count: number;
} {
  const {
    evaluateFounderSpacingIntentsResolved,
  } = requireSpacingRelation("./FounderSpacingRelation.js") as {
    evaluateFounderSpacingIntentsResolved: (i: {
      requested_changes: string[];
      beforeCanvas: FabricCanvasDoc;
      afterCanvas: FabricCanvasDoc;
      resolved_relations?: unknown;
    }) => {
      intents: SpacingIntentRelation[];
      all_satisfied: boolean;
      measurable_count: number;
    };
  };
  return evaluateFounderSpacingIntentsResolved(input);
}

/**
 * Same-column text overlaps using visual content bottoms (not oversized
 * stored textbox bottoms). Used when deciding whether AI compaction into
 * empty allocated box space is visually safe.
 */
export function findVisualContentTextOverlaps(
  canvas: FabricCanvasDoc,
): Array<{ a: string; b: string; overlapY: number }> {
  const texts: Array<{
    id: string;
    left: number;
    right: number;
    top: number;
    bottom: number;
  }> = [];
  const objs = (canvas.objects ?? []) as Array<Record<string, unknown>>;
  for (let i = 0; i < objs.length; i++) {
    const o = objs[i]!;
    if (!isFabricTextObject(o)) continue;
    const left = num(o.left);
    const width = Math.max(0, num(o.width) * (typeof o.scaleX === "number" ? o.scaleX : 1));
    const top = num(o.top);
    const bottom = visualTextContentBottom(o);
    texts.push({
      id: objectId(o, i),
      left,
      right: left + width,
      top,
      bottom,
    });
  }
  const out: Array<{ a: string; b: string; overlapY: number }> = [];
  for (let i = 0; i < texts.length; i++) {
    for (let j = i + 1; j < texts.length; j++) {
      const a = texts[i]!;
      const b = texts[j]!;
      const overlapX = Math.min(a.right, b.right) - Math.max(a.left, b.left);
      if (overlapX < 20) continue;
      const overlapY = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
      if (overlapY > 1) out.push({ a: a.id, b: b.id, overlapY });
    }
  }
  return out;
}

/**
 * When AI compaction moves into empty allocated textbox space, shrink the
 * oversized stored height to visual content so final collision gates agree.
 */
export function buildOversizedTextboxShrinkOps(input: {
  canvas: FabricCanvasDoc;
  founder_feedback_item: string;
  founder_feedback_items?: string[];
  target_ids?: Set<string>;
}): CanvasOperation[] {
  const ops: CanvasOperation[] = [];
  const objs = (input.canvas.objects ?? []) as Array<Record<string, unknown>>;
  for (let i = 0; i < objs.length; i++) {
    const o = objs[i]!;
    if (!isFabricTextObject(o)) continue;
    const id = objectId(o, i);
    if (input.target_ids && !input.target_ids.has(id)) continue;
    const stored = storedTextHeightScaled(o);
    const visual = visualTextContentHeightScaled(o);
    if (stored <= visual + 1) continue;
    const scaleY = typeof o.scaleY === "number" && o.scaleY > 0 ? o.scaleY : 1;
    const unscaled = Math.ceil(visual / scaleY);
    ops.push({
      op: "set_dimensions",
      target_id: id,
      before_summary: `${id} oversized height ${stored} vs visual ${visual}`,
      intended_change: `Shrink textbox height to visual content for spacing intent`,
      values: { height: unscaled },
      founder_feedback_item: input.founder_feedback_item,
      founder_feedback_items: input.founder_feedback_items,
      confidence: 1,
    });
  }
  return ops;
}
