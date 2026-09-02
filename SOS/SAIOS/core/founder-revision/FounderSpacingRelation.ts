/**
 * Phase 6E — Precise Founder spacing-relation targeting.
 *
 * Resolves a Founder-named visual pair from quoted/named content and
 * same-entry siblings. Does not require a literal section word. Does not
 * use the section-wide dominant gap when a specific item is identifiable.
 *
 * Spacing truth uses visual content bottoms (Phase 5Z).
 * Collision safety stays with existing fail-closed geometry.
 */
import type { FabricCanvasDoc } from "./CanvasInventory.js";
import {
  isFabricTextObject,
  storedTextHeightScaled,
  visualTextContentBottom,
  visualTextContentHeightScaled,
} from "./TextEffectiveHeight.js";
import {
  detectSpacingIntentDirection,
  isFounderMeasurableSpacingIntent,
  measureDominantVisualGap,
  measureSectionVisualContentGaps,
  sectionTokensForSpacingIntent,
  spacingIntentSatisfied,
  SPACING_INTENT_MIN_GAP_PX,
  type SpacingIntentDirection,
  type SpacingIntentRelation,
} from "./FounderSpacingIntent.js";
import { snapCoord } from "./EquivalentHorizontalOwnership.js";
import type { CanvasOperation } from "./revision-task-types.js";

export type SpacingRelationKind =
  | "NAMED_PAIR"
  | "SECTION_RHYTHM"
  | "AMBIGUOUS"
  | "UNEVALUABLE";

export type ResolvedSpacingRelation = {
  kind: SpacingRelationKind;
  direction: SpacingIntentDirection;
  founder_feedback_item: string;
  section: string;
  group_key: string;
  upper_id: string;
  lower_id: string;
  before_gap: number;
  notes: string;
};

type TextRow = {
  id: string;
  top: number;
  text: string;
  section: string;
  role: string;
  contentBottom: number;
  storedHeight: number;
  visualHeight: number;
  obj: Record<string, unknown>;
  heading: boolean;
  bullet: boolean;
  dateLike: boolean;
  roleHeader: boolean;
  group_key: string;
};

function normalize(s: string): string {
  return s
    .replace(/^\*+\s*/, "")
    .replace(/^\d+\.\s*/, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function stripDecor(s: string): string {
  return normalize(s)
    .replace(/^[•\-–]\s*/, "")
    .replace(/[.…]+$/g, "")
    .replace(/[“”"']/g, "")
    .trim();
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

function isBulletLike(text: string): boolean {
  const t = text.trim();
  return t.startsWith("•") || t.startsWith("-") || t.startsWith("–");
}

function isDateLike(text: string): boolean {
  const n = normalize(text);
  return (
    /\b(january|february|march|april|may|june|july|august|september|october|november|december)\b/.test(
      n,
    ) || /\b(19|20)\d{2}\s*[–\-—]\s*(present|(19|20)\d{2})\b/.test(n)
  );
}

function requestsInterRole(text: string): boolean {
  const n = normalize(text);
  return /\b(between\s+(roles?|jobs?|entries|positions)|inter-?role|previous\s+(role|job|entry)|role\s+blocks?)\b/.test(
    n,
  );
}

function extractNamedNeedles(text: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const push = (raw: string) => {
    const n = stripDecor(raw);
    if (n.length < 8 || seen.has(n)) return;
    seen.add(n);
    out.push(n);
  };
  const quoted = text.matchAll(/[“"']([^”"']{6,})[”"']/g);
  for (const m of quoted) push(m[1] ?? "");
  const beforeBullet = text.match(
    /\bbefore\s+(?:the\s+)?[“"']?([^”"']{6,}?)[”"']?\s+bullet/i,
  );
  if (beforeBullet?.[1]) push(beforeBullet[1]);
  const afterBullet = text.match(
    /\bafter\s+(?:the\s+)?[“"']?([^”"']{6,}?)[”"']?\s+bullet/i,
  );
  if (afterBullet?.[1]) push(afterBullet[1]);
  return out;
}

function needleMatchesText(needle: string, haystack: string): boolean {
  const n = stripDecor(needle);
  const h = stripDecor(haystack);
  if (!n || n.length < 8 || !h) return false;
  return h.includes(n) || n.includes(h) || h.startsWith(n) || n.startsWith(h);
}

function collectTextRows(canvas: FabricCanvasDoc): TextRow[] {
  const rows: TextRow[] = [];
  const objs = (canvas.objects ?? []) as Array<Record<string, unknown>>;
  for (let i = 0; i < objs.length; i++) {
    const o = objs[i]!;
    if (!isFabricTextObject(o)) continue;
    const text = String(o.text ?? "");
    const heading = isHeadingLike(o);
    const bullet = isBulletLike(text);
    const dateLike = isDateLike(text);
    rows.push({
      id: objectId(o, i),
      top: num(o.top),
      text,
      section: sectionOf(o),
      role: roleOf(o),
      contentBottom: visualTextContentBottom(o),
      storedHeight: storedTextHeightScaled(o),
      visualHeight: visualTextContentHeightScaled(o),
      obj: o,
      heading,
      bullet,
      dateLike,
      roleHeader: !heading && !bullet && !dateLike && text.trim().length > 0,
      group_key: "",
    });
  }
  rows.sort((a, b) => a.top - b.top || a.id.localeCompare(b.id));
  assignEntryGroups(rows);
  return rows;
}

/**
 * Generic entry grouping: within a section, a non-bullet/non-date body line
 * starts a new role/entry after the previous entry already has bullets.
 */
function assignEntryGroups(rows: TextRow[]): void {
  const bySection = new Map<string, TextRow[]>();
  for (const r of rows) {
    const key = r.section || "_";
    const list = bySection.get(key) ?? [];
    list.push(r);
    bySection.set(key, list);
  }
  for (const [section, list] of bySection) {
    let entry = 0;
    let bulletsInEntry = 0;
    for (const r of list) {
      if (r.heading) {
        r.group_key = `${section}:heading`;
        continue;
      }
      if (r.roleHeader && bulletsInEntry > 0) {
        entry += 1;
        bulletsInEntry = 0;
      }
      r.group_key = `${section}:entry-${entry}`;
      if (r.bullet) bulletsInEntry += 1;
    }
  }
}

function namedObjectHits(rows: TextRow[], needles: string[]): TextRow[] {
  if (needles.length === 0) return [];
  const hits: TextRow[] = [];
  for (const row of rows) {
    if (row.heading) continue;
    if (needles.some((n) => needleMatchesText(n, row.text))) hits.push(row);
  }
  return hits;
}

function priorSiblingInGroup(
  rows: TextRow[],
  target: TextRow,
  preferBullet: boolean,
): TextRow | null {
  const group = rows.filter(
    (r) =>
      r.group_key === target.group_key &&
      r.id !== target.id &&
      r.top < target.top - 1e-9,
  );
  const bullets = group.filter((r) => r.bullet);
  const pool = preferBullet && bullets.length > 0 ? bullets : group;
  if (pool.length === 0) return null;
  return pool[pool.length - 1] ?? null;
}

function nextSiblingInGroup(
  rows: TextRow[],
  target: TextRow,
  preferBullet: boolean,
): TextRow | null {
  const group = rows.filter(
    (r) =>
      r.group_key === target.group_key &&
      r.id !== target.id &&
      r.top > target.top + 1e-9,
  );
  const bullets = group.filter((r) => r.bullet);
  const pool = preferBullet && bullets.length > 0 ? bullets : group;
  return pool[0] ?? null;
}

function pairGap(upper: TextRow, lower: TextRow): number {
  return lower.top - upper.contentBottom;
}

export function resolveFounderSpacingRelation(input: {
  requestedChange: string;
  canvas: FabricCanvasDoc;
}): ResolvedSpacingRelation {
  const raw = input.requestedChange;
  const direction = detectSpacingIntentDirection(raw);
  const base = {
    direction,
    founder_feedback_item: raw,
    section: "",
    group_key: "",
    upper_id: "",
    lower_id: "",
    before_gap: 0,
  };
  if (
    direction !== "REDUCE_GAP" &&
    direction !== "TIGHTEN_RHYTHM" &&
    direction !== "INCREASE_GAP" &&
    direction !== "SEPARATE"
  ) {
    return { ...base, kind: "UNEVALUABLE", notes: "no measurable spacing direction" };
  }

  const rows = collectTextRows(input.canvas);
  const needles = extractNamedNeedles(raw);
  const hits = namedObjectHits(rows, needles);
  const uniqueHits = [...new Map(hits.map((h) => [h.id, h])).values()];
  const n = normalize(raw);
  const beforeNamed = /\bbefore\b/.test(n);
  const afterNamed = /\bafter\b/.test(n) && !beforeNamed;
  const interRole = requestsInterRole(raw);

  if (needles.length > 0 && uniqueHits.length > 1) {
    return {
      ...base,
      kind: "AMBIGUOUS",
      notes: `named spacing target ambiguous: ${uniqueHits.map((h) => h.id).join(",")}`,
    };
  }

  if (uniqueHits.length === 1) {
    const named = uniqueHits[0]!;
    let upper: TextRow | null = null;
    let lower: TextRow | null = null;
    if (afterNamed) {
      upper = named;
      lower = interRole
        ? rows.find((r) => r.bullet && r.top > named.top + 1e-9) ?? null
        : nextSiblingInGroup(rows, named, true);
    } else {
      // "gap before X" or default: named object is the detached/lower item.
      lower = named;
      upper = interRole
        ? [...rows].reverse().find((r) => r.bullet && r.top < named.top - 1e-9) ??
          null
        : priorSiblingInGroup(rows, named, true);
    }
    if (!upper || !lower) {
      return {
        ...base,
        kind: "UNEVALUABLE",
        section: named.section,
        group_key: named.group_key,
        notes: interRole
          ? "named target has no requested inter-role sibling"
          : "named target is first/last in its role entry — refusing cross-role pair",
      };
    }
    return {
      kind: "NAMED_PAIR",
      direction,
      founder_feedback_item: raw,
      section: named.section || upper.section || lower.section,
      group_key: upper.group_key,
      upper_id: upper.id,
      lower_id: lower.id,
      before_gap: pairGap(upper, lower),
      notes: `named pair ${upper.id}→${lower.id}`,
    };
  }

  const sections = sectionTokensForSpacingIntent(raw);
  if (sections.length > 0) {
    const section = sections[0]!;
    const dom = measureDominantVisualGap(input.canvas, section);
    if (!dom) {
      return {
        ...base,
        kind: "UNEVALUABLE",
        section,
        notes: `spacing intent unevaluable: insufficient ${section} text pairs`,
      };
    }
    return {
      kind: "SECTION_RHYTHM",
      direction,
      founder_feedback_item: raw,
      section,
      group_key: `${section}:section`,
      upper_id: dom.upper_id,
      lower_id: dom.lower_id,
      before_gap: dom.gap,
      notes: `section rhythm ${section} dominant ${dom.upper_id}→${dom.lower_id}`,
    };
  }

  return {
    ...base,
    kind: "UNEVALUABLE",
    notes:
      "spacing intent unevaluable: no named object and no section token",
  };
}

function findRow(rows: TextRow[], id: string): TextRow | null {
  return rows.find((r) => r.id === id) ?? null;
}

export function measureResolvedPairGap(
  canvas: FabricCanvasDoc,
  upper_id: string,
  lower_id: string,
): number | null {
  const rows = collectTextRows(canvas);
  const upper = findRow(rows, upper_id);
  const lower = findRow(rows, lower_id);
  if (!upper || !lower) return null;
  return pairGap(upper, lower);
}

function median(nums: number[]): number {
  if (nums.length === 0) return 0;
  const s = [...nums].sort((a, b) => a - b);
  const mid = (s.length - 1) / 2;
  if (Number.isInteger(mid)) return s[mid]!;
  return (s[Math.floor(mid)]! + s[Math.ceil(mid)]!) / 2;
}

export function peerVisualGapsInGroup(
  canvas: FabricCanvasDoc,
  group_key: string,
  except?: { upper_id: string; lower_id: string },
): number[] {
  const rows = collectTextRows(canvas)
    .filter((r) => r.group_key === group_key && r.bullet)
    .sort((a, b) => a.top - b.top);
  const gaps: number[] = [];
  for (let i = 0; i < rows.length - 1; i++) {
    const a = rows[i]!;
    const b = rows[i + 1]!;
    if (
      except &&
      a.id === except.upper_id &&
      b.id === except.lower_id
    ) {
      continue;
    }
    gaps.push(pairGap(a, b));
  }
  return gaps;
}

/**
 * Deterministic safe compaction for a resolved NAMED_PAIR reduce/tighten.
 * Returns ops or [] when no safe move exists. Never hard-codes coordinates.
 */
export function buildSafeNamedSpacingRelationOps(input: {
  canvas: FabricCanvasDoc;
  requested_changes: string[];
}): CanvasOperation[] {
  const ops: CanvasOperation[] = [];
  const rows = collectTextRows(input.canvas);
  for (const change of input.requested_changes) {
    if (!isFounderMeasurableSpacingIntent(change)) continue;
    const resolved = resolveFounderSpacingRelation({
      requestedChange: change,
      canvas: input.canvas,
    });
    if (resolved.kind !== "NAMED_PAIR") continue;
    if (
      resolved.direction !== "REDUCE_GAP" &&
      resolved.direction !== "TIGHTEN_RHYTHM"
    ) {
      continue;
    }
    const upper = findRow(rows, resolved.upper_id);
    const lower = findRow(rows, resolved.lower_id);
    if (!upper || !lower) continue;

    const peers = peerVisualGapsInGroup(input.canvas, resolved.group_key, {
      upper_id: upper.id,
      lower_id: lower.id,
    }).filter((g) => g >= SPACING_INTENT_MIN_GAP_PX);
    const peerRhythm = peers.length > 0 ? median(peers) : 6;
    const desired = Math.max(SPACING_INTENT_MIN_GAP_PX, peerRhythm);
    const newTop = snapCoord(upper.contentBottom + desired);
    if (!(newTop < lower.top - 0.5)) continue;
    if (newTop + 1e-9 < upper.contentBottom + SPACING_INTENT_MIN_GAP_PX) {
      continue;
    }

    if (upper.storedHeight > upper.visualHeight + 1) {
      const scaleY =
        typeof upper.obj.scaleY === "number" && upper.obj.scaleY > 0
          ? upper.obj.scaleY
          : 1;
      ops.push({
        op: "set_dimensions",
        target_id: upper.id,
        before_summary: `${upper.id} oversized height ${upper.storedHeight} vs visual ${upper.visualHeight}`,
        intended_change: `Shrink textbox height to visual content for named spacing relation`,
        values: { height: Math.ceil(upper.visualHeight / scaleY) },
        founder_feedback_item: change,
        confidence: 1,
      });
    }

    ops.push({
      op: "set_position",
      target_id: lower.id,
      before_summary: `${lower.id} at top=${lower.top} after ${upper.id} visual_bottom=${upper.contentBottom}`,
      intended_change: `Compact named spacing pair ${upper.id}→${lower.id} to peer visual rhythm`,
      values: { top: newTop },
      founder_feedback_item: change,
      confidence: 1,
    });
  }
  return ops;
}

export function sectionGapsForResolved(
  canvas: FabricCanvasDoc,
  section: string,
): Array<{ upper_id: string; lower_id: string; gap: number }> {
  return measureSectionVisualContentGaps(canvas, section);
}

/**
 * Phase 6E evaluate: named-pair relations use exact pair gaps (not section
 * dominant). Generic section tighten still uses section rhythm.
 */
export function evaluateFounderSpacingIntentsResolved(input: {
  requested_changes: string[];
  beforeCanvas: FabricCanvasDoc;
  afterCanvas: FabricCanvasDoc;
}): {
  intents: SpacingIntentRelation[];
  all_satisfied: boolean;
  measurable_count: number;
} {
  const intents: SpacingIntentRelation[] = [];
  for (const raw of input.requested_changes) {
    const direction = detectSpacingIntentDirection(raw);
    if (
      direction !== "REDUCE_GAP" &&
      direction !== "TIGHTEN_RHYTHM" &&
      direction !== "INCREASE_GAP" &&
      direction !== "SEPARATE"
    ) {
      continue;
    }
    const resolved = resolveFounderSpacingRelation({
      requestedChange: raw,
      canvas: input.beforeCanvas,
    });
    if (
      resolved.kind === "AMBIGUOUS" ||
      resolved.kind === "UNEVALUABLE" ||
      !resolved.upper_id ||
      !resolved.lower_id
    ) {
      intents.push({
        founder_feedback_item: raw,
        direction,
        section: resolved.section,
        upper_id: resolved.upper_id,
        lower_id: resolved.lower_id,
        before_gap: resolved.before_gap,
        after_gap: resolved.before_gap,
        satisfied: false,
        notes: resolved.notes,
      });
      continue;
    }

    const after_gap =
      measureResolvedPairGap(
        input.afterCanvas,
        resolved.upper_id,
        resolved.lower_id,
      ) ?? resolved.before_gap;

    if (resolved.kind === "NAMED_PAIR") {
      const sat = spacingIntentSatisfied({
        direction,
        before_gap: resolved.before_gap,
        after_gap,
      });
      intents.push({
        founder_feedback_item: raw,
        direction,
        section: resolved.section,
        upper_id: resolved.upper_id,
        lower_id: resolved.lower_id,
        before_gap: resolved.before_gap,
        after_gap,
        satisfied: sat.satisfied,
        notes: `${resolved.notes}; ${sat.notes}`,
      });
      continue;
    }

    const beforeGaps = measureSectionVisualContentGaps(
      input.beforeCanvas,
      resolved.section,
    );
    const afterGaps = measureSectionVisualContentGaps(
      input.afterCanvas,
      resolved.section,
    );
    const sat = spacingIntentSatisfied({
      direction,
      before_gap: resolved.before_gap,
      after_gap,
      before_gaps: beforeGaps.map((g) => g.gap),
      after_gaps: afterGaps.map((g) => g.gap),
    });
    intents.push({
      founder_feedback_item: raw,
      direction,
      section: resolved.section,
      upper_id: resolved.upper_id,
      lower_id: resolved.lower_id,
      before_gap: resolved.before_gap,
      after_gap,
      satisfied: sat.satisfied,
      notes: sat.notes,
    });
  }
  const measurable = intents.filter((i) => i.direction !== "NONE");
  return {
    intents,
    measurable_count: measurable.length,
    all_satisfied:
      measurable.length === 0 || measurable.every((i) => i.satisfied),
  };
}
