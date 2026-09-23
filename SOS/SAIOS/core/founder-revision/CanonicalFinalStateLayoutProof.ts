/**
 * Phase 6K — one canonical final-state layout-intent proof.
 *
 * A layout-owned Founder requirement is judged once from the FINAL rendered
 * state (resolved relation + visual bounds + existing rhythm floors).
 * Deterministic ownership and FeedbackCoverage must consume this verdict.
 * Source-relative 35% REDUCE_GAP is not the acceptance contract.
 */
import type { FabricCanvasDoc } from "./CanvasInventory.js";
import {
  isFabricTextObject,
  storedTextHeightScaled,
  visualTextContentBottom,
  visualTextContentHeightScaled,
} from "./TextEffectiveHeight.js";
import {
  resolveFounderSpacingRelation,
  type ResolvedSpacingRelation,
} from "./FounderSpacingRelation.js";
import { SPACING_INTENT_MIN_GAP_PX } from "./FounderSpacingIntent.js";
import {
  MIN_SECTION_GAP_PX,
  READABLE_SEQUENTIAL_GAP_PX,
} from "./RevisionLayoutNormalizer.js";
import { isCollisionOrReadableGapLayoutRequest } from "./RevisionIntentScope.js";
import { sectionTokensFromText } from "./PositionOpCanonicalization.js";

export const CANONICAL_LAYOUT_SCHEMA =
  "founder-revision-canonical-layout-intent-1.0.0" as const;
export const CANONICAL_LAYOUT_COVERED_BY =
  "canonical_final_state_layout_proof" as const;

/** Matches RevisionLayoutNormalizer GAP_RELATION_NOISE_PX. */
const GAP_NOISE_PX = 2;

export type CanonicalLayoutReason =
  | "LAYOUT_RHYTHM_SATISFIED"
  | "LAYOUT_RHYTHM_UNSATISFIED"
  | "VISUAL_GAP_TOO_LARGE"
  | "VISUAL_GAP_TOO_SMALL"
  | "OVERLAP"
  | "OOB"
  | "UNEVALUABLE";

export type CanonicalLayoutGeometry = {
  upper_id: string | null;
  lower_id: string | null;
  upper_top: number | null;
  upper_stored_height: number | null;
  upper_visual_height: number | null;
  lower_top: number | null;
  stored_gap: number | null;
  visual_gap: number | null;
  unused_frame_slack: number | null;
};

export type CanonicalLayoutIntentEvidence = {
  schema_version: typeof CANONICAL_LAYOUT_SCHEMA;
  founder_feedback_item: string;
  intent_type: string;
  owner: "DETERMINISTIC_LAYOUT";
  section: string;
  relation: {
    kind: string;
    upper_id: string | null;
    lower_id: string | null;
  };
  source_geometry: CanonicalLayoutGeometry;
  final_geometry: CanonicalLayoutGeometry;
  peer_gaps: number[];
  heading_body_gap: number | null;
  final_condition: string;
  pass: boolean;
  reason: CanonicalLayoutReason;
  evidence_source: typeof CANONICAL_LAYOUT_COVERED_BY;
};

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
  return String(o.role ?? "");
}

function findById(
  canvas: FabricCanvasDoc,
  id: string,
): Record<string, unknown> | null {
  const objs = (canvas.objects ?? []) as Array<Record<string, unknown>>;
  for (let i = 0; i < objs.length; i++) {
    if (objectId(objs[i]!, i) === id) return objs[i]!;
  }
  return null;
}

function isOob(canvas: FabricCanvasDoc, o: Record<string, unknown>): boolean {
  const pageW = Number(canvas.width ?? 794);
  const pageH = Number(canvas.height ?? 1123);
  const left = Number(o.left ?? 0);
  const top = Number(o.top ?? 0);
  const w = Number(o.width ?? 0) * Number(o.scaleX ?? 1);
  const h = isFabricTextObject(o)
    ? Math.max(storedTextHeightScaled(o), visualTextContentHeightScaled(o))
    : Number(o.height ?? 0) * Number(o.scaleY ?? 1);
  return left < -1 || top < -1 || left + w > pageW + 1 || top + h > pageH + 1;
}

function measurePair(
  canvas: FabricCanvasDoc,
  upperId: string | null,
  lowerId: string | null,
): CanonicalLayoutGeometry {
  const empty: CanonicalLayoutGeometry = {
    upper_id: upperId,
    lower_id: lowerId,
    upper_top: null,
    upper_stored_height: null,
    upper_visual_height: null,
    lower_top: null,
    stored_gap: null,
    visual_gap: null,
    unused_frame_slack: null,
  };
  if (!upperId || !lowerId) return empty;
  const upper = findById(canvas, upperId);
  const lower = findById(canvas, lowerId);
  if (!upper || !lower) return empty;
  const storedH = storedTextHeightScaled(upper);
  const visualH = visualTextContentHeightScaled(upper);
  const storedBottom = Number(upper.top ?? 0) + storedH;
  const visualBottom = visualTextContentBottom(upper);
  const lowerTop = Number(lower.top ?? 0);
  return {
    upper_id: upperId,
    lower_id: lowerId,
    upper_top: Number(upper.top ?? 0),
    upper_stored_height: storedH,
    upper_visual_height: visualH,
    lower_top: lowerTop,
    stored_gap: lowerTop - storedBottom,
    visual_gap: lowerTop - visualBottom,
    unused_frame_slack: Math.max(0, storedH - visualH),
  };
}

function headingBodyVisualGap(
  canvas: FabricCanvasDoc,
  section: string,
  firstBodyId: string | null,
): number | null {
  if (!section || !firstBodyId) return null;
  const body = findById(canvas, firstBodyId);
  if (!body) return null;
  const bodyTop = Number(body.top ?? 0);
  const objs = (canvas.objects ?? []) as Array<Record<string, unknown>>;
  let heading: Record<string, unknown> | null = null;
  for (let i = 0; i < objs.length; i++) {
    const o = objs[i]!;
    if (!isFabricTextObject(o)) continue;
    if (sectionOf(o) !== section) continue;
    const role = roleOf(o);
    const text = String(o.text ?? "").trim().toUpperCase();
    const headingLike =
      role === "section-heading" ||
      text === section.toUpperCase() ||
      text === `${section.toUpperCase()}S` ||
      new RegExp(`^(0?\\d\\s+)?${section.toUpperCase()}\\b`).test(text);
    if (!headingLike) continue;
    if (Number(o.top ?? 0) >= bodyTop - 1e-9) continue;
    if (!heading || Number(o.top ?? 0) > Number(heading.top ?? 0)) heading = o;
  }
  if (!heading) return null;
  return bodyTop - visualTextContentBottom(heading);
}

function unusedSlackHole(geom: CanonicalLayoutGeometry): boolean {
  const slack = geom.unused_frame_slack ?? 0;
  const visual = geom.visual_gap;
  const stored = geom.stored_gap;
  if (visual == null || stored == null) return false;
  return slack > 1 && visual > stored + GAP_NOISE_PX;
}

function evidence(input: {
  item: string;
  intent_type: string;
  section: string;
  kind: string;
  upper_id: string | null;
  lower_id: string | null;
  source: CanonicalLayoutGeometry;
  final: CanonicalLayoutGeometry;
  peer_gaps: number[];
  heading_body_gap: number | null;
  pass: boolean;
  reason: CanonicalLayoutReason;
  condition: string;
}): CanonicalLayoutIntentEvidence {
  return {
    schema_version: CANONICAL_LAYOUT_SCHEMA,
    founder_feedback_item: input.item,
    intent_type: input.intent_type,
    owner: "DETERMINISTIC_LAYOUT",
    section: input.section,
    relation: {
      kind: input.kind,
      upper_id: input.upper_id,
      lower_id: input.lower_id,
    },
    source_geometry: input.source,
    final_geometry: input.final,
    peer_gaps: input.peer_gaps,
    heading_body_gap: input.heading_body_gap,
    final_condition: input.condition,
    pass: input.pass,
    reason: input.reason,
    evidence_source: CANONICAL_LAYOUT_COVERED_BY,
  };
}

function bodyPeerGaps(
  canvas: FabricCanvasDoc,
  section: string,
  excludeUpper: string | null,
  excludeLower: string | null,
): number[] {
  const gaps: number[] = [];
  for (const pair of sequentialTextPairs(canvas, section)) {
    if (isHeadingLikeRole(pair.upper)) continue;
    if (pair.upper_id === excludeUpper && pair.lower_id === excludeLower) continue;
    const geom = measurePair(canvas, pair.upper_id, pair.lower_id);
    if (geom.visual_gap != null && geom.visual_gap + 1e-9 >= 0) {
      gaps.push(geom.visual_gap);
    }
  }
  return gaps;
}

function isHeadingLikeRole(o: Record<string, unknown>): boolean {
  const role = roleOf(o).toLowerCase();
  return (
    role === "section-heading" ||
    role === "heading" ||
    role === "section_heading"
  );
}

function judgeFinalPair(input: {
  item: string;
  rel: ResolvedSpacingRelation;
  source: CanonicalLayoutGeometry;
  final: CanonicalLayoutGeometry;
  after: FabricCanvasDoc;
}): CanonicalLayoutIntentEvidence {
  const { rel, source, final, after, item } = input;
  const headingBody = headingBodyVisualGap(after, rel.section, final.upper_id);
  const peers = headingBody == null ? [] : [headingBody];
  const upper = final.upper_id ? findById(after, final.upper_id) : null;
  const lower = final.lower_id ? findById(after, final.lower_id) : null;
  const base = {
    item,
    intent_type: rel.direction || rel.kind,
    section: rel.section,
    kind: rel.kind,
    upper_id: final.upper_id,
    lower_id: final.lower_id,
    source,
    final,
    peer_gaps: peers,
    heading_body_gap: headingBody,
  };

  if (!upper || !lower || final.visual_gap == null) {
    return evidence({
      ...base,
      pass: false,
      reason: "UNEVALUABLE",
      condition: "resolved pair missing on final canvas",
    });
  }
  if (isOob(after, upper) || isOob(after, lower)) {
    return evidence({
      ...base,
      pass: false,
      reason: "OOB",
      condition: "resolved pair object outside page bounds",
    });
  }
  if (final.visual_gap < -1e-9) {
    return evidence({
      ...base,
      pass: false,
      reason: "OVERLAP",
      condition: `final visual gap ${final.visual_gap.toFixed(2)} < 0`,
    });
  }
  const minGap = isCollisionOrReadableGapLayoutRequest(item)
    ? READABLE_SEQUENTIAL_GAP_PX
    : SPACING_INTENT_MIN_GAP_PX;
  if (final.visual_gap + 1e-9 < minGap) {
    return evidence({
      ...base,
      pass: false,
      reason: "VISUAL_GAP_TOO_SMALL",
      condition: `final visual gap ${final.visual_gap.toFixed(2)} < min ${minGap}`,
    });
  }
  if (unusedSlackHole(final)) {
    return evidence({
      ...base,
      pass: false,
      reason: "VISUAL_GAP_TOO_LARGE",
      condition: `unused text-frame slack ${final.unused_frame_slack?.toFixed(2)} inflates visual gap ${final.visual_gap.toFixed(2)} vs stored ${final.stored_gap?.toFixed(2)}`,
    });
  }
  if (
    headingBody != null &&
    final.visual_gap > headingBody + GAP_NOISE_PX &&
    final.visual_gap > MIN_SECTION_GAP_PX
  ) {
    return evidence({
      ...base,
      pass: false,
      reason: "VISUAL_GAP_TOO_LARGE",
      condition: `final visual gap ${final.visual_gap.toFixed(2)} disconnected vs heading→body ${headingBody.toFixed(2)}`,
    });
  }
  const consistencyRequested =
    /\b(same|consistent|inconsistent|equal|uniform|other consecutive|peer)\b/i.test(
      item,
    );
  const peerCandidates = [
    ...bodyPeerGaps(after, rel.section, final.upper_id, final.lower_id),
    ...(source.visual_gap != null && source.visual_gap + 1e-9 >= minGap
      ? [source.visual_gap]
      : []),
  ];
  const peer =
    peerCandidates.length > 0
      ? peerCandidates.slice().sort((a, b) => a - b)[
          Math.floor(peerCandidates.length / 2)
        ]!
      : null;
  if (
    consistencyRequested &&
    peer != null &&
    final.visual_gap > peer + GAP_NOISE_PX
  ) {
    return evidence({
      ...base,
      pass: false,
      reason: "LAYOUT_RHYTHM_UNSATISFIED",
      condition: `final visual gap ${final.visual_gap.toFixed(2)} exceeds peer rhythm ${peer.toFixed(2)}`,
    });
  }
  return evidence({
    ...base,
    pass: true,
    reason: "LAYOUT_RHYTHM_SATISFIED",
    condition: `final visual gap ${final.visual_gap.toFixed(2)} readable; slack=${(final.unused_frame_slack ?? 0).toFixed(2)}; heading_body=${headingBody == null ? "n/a" : headingBody.toFixed(2)}; peer=${peer == null ? "n/a" : peer.toFixed(2)}`,
  });
}

function sequentialTextPairs(
  canvas: FabricCanvasDoc,
  section: string,
): Array<{ upper: Record<string, unknown>; lower: Record<string, unknown>; upper_id: string; lower_id: string }> {
  const objs = (canvas.objects ?? []) as Array<Record<string, unknown>>;
  const rows = objs
    .map((o, i) => ({ o, id: objectId(o, i) }))
    .filter((x) => isFabricTextObject(x.o) && sectionOf(x.o) === section)
    .sort((a, b) => Number(a.o.top ?? 0) - Number(b.o.top ?? 0) || a.id.localeCompare(b.id));
  const pairs: Array<{
    upper: Record<string, unknown>;
    lower: Record<string, unknown>;
    upper_id: string;
    lower_id: string;
  }> = [];
  for (let i = 0; i < rows.length - 1; i++) {
    pairs.push({
      upper: rows[i]!.o,
      lower: rows[i + 1]!.o,
      upper_id: rows[i]!.id,
      lower_id: rows[i + 1]!.id,
    });
  }
  return pairs;
}

function sectionHeadingTop(
  canvas: FabricCanvasDoc,
  section: string,
): number | null {
  const objs = (canvas.objects ?? []) as Array<Record<string, unknown>>;
  let top: number | null = null;
  for (const o of objs) {
    if (!isFabricTextObject(o) || sectionOf(o) !== section) continue;
    if (!isHeadingLikeRole(o) && roleOf(o).toLowerCase() !== "") continue;
    const t = Number(o.top ?? 0);
    if (top == null || t < top) top = t;
  }
  if (top != null) return top;
  for (const o of objs) {
    if (!isFabricTextObject(o) || sectionOf(o) !== section) continue;
    const t = Number(o.top ?? 0);
    if (top == null || t < top) top = t;
  }
  return top;
}

function sectionContentBottom(
  canvas: FabricCanvasDoc,
  section: string,
): number | null {
  const objs = (canvas.objects ?? []) as Array<Record<string, unknown>>;
  let bottom: number | null = null;
  for (const o of objs) {
    if (!isFabricTextObject(o) || sectionOf(o) !== section) continue;
    const b = visualTextContentBottom(o);
    if (bottom == null || b > bottom) bottom = b;
  }
  return bottom;
}

function interSectionGaps(canvas: FabricCanvasDoc, sections: string[]): number[] {
  const ordered = sections
    .map((s) => ({ s, top: sectionHeadingTop(canvas, s) }))
    .filter((x): x is { s: string; top: number } => x.top != null)
    .sort((a, b) => a.top - b.top);
  const gaps: number[] = [];
  for (let i = 1; i < ordered.length; i++) {
    const prevBottom = sectionContentBottom(canvas, ordered[i - 1]!.s);
    const nextTop = ordered[i]!.top;
    if (prevBottom == null) continue;
    gaps.push(nextTop - prevBottom);
  }
  return gaps;
}

const SIDEBAR_LANE_SECTIONS = new Set([
  "skills",
  "projects",
  "certifications",
  "languages",
]);

function mentionedSections(item: string, canvas: FabricCanvasDoc): string[] {
  const present = new Set<string>();
  for (const o of (canvas.objects ?? []) as Array<Record<string, unknown>>) {
    const s = sectionOf(o);
    if (s && s !== "header") present.add(s);
  }
  const focused = sectionTokensFromText(item).filter((s) => present.has(s));
  if (focused.length > 0) return focused;
  const n = item.toLowerCase();
  const named = [...present].filter((s) => new RegExp(`\\b${s}\\b`, "i").test(n));
  if (named.length > 0) return named;
  if (/\bsidebar\b/.test(n)) {
    return [...present].filter((s) => SIDEBAR_LANE_SECTIONS.has(s));
  }
  return [];
}

function judgeSectionFinal(input: {
  item: string;
  before: FabricCanvasDoc;
  after: FabricCanvasDoc;
}): CanonicalLayoutIntentEvidence {
  const sections = mentionedSections(input.item, input.after);
  const cramped: string[] = [];
  const overlaps: string[] = [];
  let oob = false;
  for (const section of sections) {
    for (const pair of sequentialTextPairs(input.after, section)) {
      if (isOob(input.after, pair.upper) || isOob(input.after, pair.lower)) {
        oob = true;
      }
      const geom = measurePair(input.after, pair.upper_id, pair.lower_id);
      if ((geom.visual_gap ?? 0) < -1e-9) overlaps.push(`${pair.upper_id}→${pair.lower_id}`);
      else if (
        (geom.visual_gap ?? 0) + 1e-9 <
        (isCollisionOrReadableGapLayoutRequest(input.item)
          ? READABLE_SEQUENTIAL_GAP_PX
          : SPACING_INTENT_MIN_GAP_PX)
      ) {
        cramped.push(`${pair.upper_id}→${pair.lower_id}`);
      }
    }
  }
  const source = measurePair(input.before, null, null);
  const final = measurePair(input.after, null, null);
  const base = {
    item: input.item,
    intent_type: "SECTION_RHYTHM",
    section: sections.join(",") || "unresolved",
    kind: sections.length ? "SECTION_RHYTHM" : "UNEVALUABLE",
    upper_id: null as string | null,
    lower_id: null as string | null,
    source,
    final,
    peer_gaps: [] as number[],
    heading_body_gap: null as number | null,
  };
  if (oob) {
    return evidence({ ...base, pass: false, reason: "OOB", condition: "section object outside page bounds" });
  }
  if (overlaps.length > 0) {
    return evidence({
      ...base,
      pass: false,
      reason: "OVERLAP",
      condition: `overlapping pairs ${overlaps.join(",")}`,
    });
  }
  if (cramped.length > 0) {
    return evidence({
      ...base,
      pass: false,
      reason: "VISUAL_GAP_TOO_SMALL",
      condition: `cramped pairs ${cramped.join(",")}`,
    });
  }
  const headingToBodyOnly =
    /\bheading\b/i.test(input.item) &&
    /\bfirst body\b/i.test(input.item);
  const wantsSectionEquality =
    !headingToBodyOnly &&
    (/\b(consistent|equal|uniform)\b/i.test(input.item) ||
      /\bsame\b.{0,40}\b(spacing|rhythm|gap|separation)\b/i.test(input.item)) &&
    /\b(section|sidebar)\b/i.test(input.item) &&
    /\b(spacing|rhythm|gap|separation)\b/i.test(input.item);
  if (wantsSectionEquality && sections.length >= 2) {
    const lane = sections.some((s) => SIDEBAR_LANE_SECTIONS.has(s))
      ? sections.filter((s) => SIDEBAR_LANE_SECTIONS.has(s))
      : sections;
    const inter = interSectionGaps(input.after, lane.length >= 2 ? lane : sections);
    if (inter.length >= 2) {
      const spread = Math.max(...inter) - Math.min(...inter);
      if (spread > GAP_NOISE_PX) {
        return evidence({
          ...base,
          pass: false,
          reason: "LAYOUT_RHYTHM_UNSATISFIED",
          condition: `sidebar section gaps inconsistent: ${inter.map((g) => g.toFixed(2)).join("/")} spread=${spread.toFixed(2)}`,
        });
      }
    }
  }
  return evidence({
    ...base,
    pass: true,
    reason: "LAYOUT_RHYTHM_SATISFIED",
    condition: "final section rhythm has positive readable separation and no unused-frame holes",
  });
}

export function evaluateCanonicalFinalStateLayoutProof(input: {
  requestedChange: string;
  beforeCanvas: FabricCanvasDoc;
  afterCanvas: FabricCanvasDoc;
  resolved_relation?: ResolvedSpacingRelation | null;
}): CanonicalLayoutIntentEvidence {
  const resolved =
    input.resolved_relation ??
    resolveFounderSpacingRelation({
      requestedChange: input.requestedChange,
      canvas: input.afterCanvas,
    });
  const pairReady =
    resolved.upper_id &&
    resolved.lower_id &&
    (resolved.kind === "NAMED_PAIR" || resolved.kind === "SECTION_RHYTHM");
  if (pairReady) {
    return judgeFinalPair({
      item: input.requestedChange,
      rel: resolved,
      source: measurePair(
        input.beforeCanvas,
        resolved.upper_id,
        resolved.lower_id,
      ),
      final: measurePair(
        input.afterCanvas,
        resolved.upper_id,
        resolved.lower_id,
      ),
      after: input.afterCanvas,
    });
  }
  return judgeSectionFinal({
    item: input.requestedChange,
    before: input.beforeCanvas,
    after: input.afterCanvas,
  });
}

export function evaluateOwnedCanonicalLayoutProofs(input: {
  requested_changes: string[];
  beforeCanvas: FabricCanvasDoc;
  afterCanvas: FabricCanvasDoc;
  owned_item: (change: string) => boolean;
}): CanonicalLayoutIntentEvidence[] {
  return input.requested_changes
    .filter((c) => input.owned_item(c))
    .map((c) =>
      evaluateCanonicalFinalStateLayoutProof({
        requestedChange: c,
        beforeCanvas: input.beforeCanvas,
        afterCanvas: input.afterCanvas,
      }),
    );
}
