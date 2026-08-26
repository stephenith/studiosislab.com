/**
 * Deterministic post-mutation layout normalization for Founder revisions.
 *
 * OpenAI owns semantic intent. This module owns:
 * - column/lane-aware vertical section flow
 * - minimum section / heading→body gaps (lane-local)
 * - Founder-gated heading→content equality across a named same-lane section system
 * - Founder-gated internal-content whitespace rhythm (body text only)
 * - coherent section-group shifts within a lane
 * - repeated section-heading style normalization within a visual system
 * - lane-local content-grid left normalization (not header/name)
 *
 * Does not call OpenAI. Does not mutate the caller-provided canvas in place
 * (works on a deep clone). Fail closed on unsafe page overflow.
 *
 * Gap constants (documented, evidence-based conservative defaults):
 * - MIN_SECTION_GAP_PX = 12  (section bottom → next section top, same lane)
 * - MIN_HEADING_BODY_GAP_PX = 8  (heading bottom → first body top)
 *   MIN_HEADING_BODY_GAP_PX is NOT an internal line-to-line minimum.
 *
 * Page-fit pipeline:
 *   reflow / heading normalize → measure → reclaim EXCESS gaps only (per lane)
 *   → remeasure → fail closed if still overflowing.
 * Never shrinks fonts, lineHeight, or scales the canvas.
 */

import type { FabricCanvasDoc } from "./CanvasInventory.js";
import {
  effectiveObjectBBox,
  effectiveTextHeightScaled,
  isFabricTextObject,
} from "./TextEffectiveHeight.js";

/** Minimum gap between consecutive stacked sections in the same lane (px). */
export const MIN_SECTION_GAP_PX = 12;
/** Minimum gap from section heading bottom to first body object (px). */
export const MIN_HEADING_BODY_GAP_PX = 8;
/** Tolerance when comparing left edges within a content grid (px). */
export const CONTENT_GRID_LEFT_TOLERANCE_PX = 2;
/**
 * Horizontal ranges must overlap by at least this many px (or share a close
 * anchor) to be considered the same layout lane.
 */
export const LANE_HORIZONTAL_OVERLAP_PX = 24;
/** Max distance between section horizontal anchors to join the same lane. */
export const LANE_ANCHOR_JOIN_PX = 72;
/**
 * Noise when comparing heading→content gaps for Founder-gated equality.
 * Matches FeedbackCoverage GAP_RELATION_NOISE_PX; not a visual-judgment threshold.
 */
const GAP_RELATION_NOISE_PX = 2;

type FabricObj = Record<string, unknown> & {
  type?: string;
  id?: string;
  left?: number;
  top?: number;
  width?: number;
  height?: number;
  scaleX?: number;
  scaleY?: number;
  text?: string;
  fill?: string;
  fontSize?: number;
  fontFamily?: string;
  fontWeight?: string | number;
  role?: string;
  data?: Record<string, unknown>;
};

export type SectionBounds = {
  section: string;
  object_ids: string[];
  top: number;
  bottom: number;
  left: number;
  right: number;
  heading_rect_id: string | null;
  heading_text_id: string | null;
  body_ids: string[];
  lane_id: string | null;
};

export type LayoutLaneReport = {
  lane_id: string;
  anchor_left: number;
  bounds_left: number;
  bounds_right: number;
  section_order: string[];
};

export type PageFitReport = {
  page_height: number;
  content_bottom_before_compaction: number;
  overflow_before: number;
  total_reclaimable_slack: number;
  pixels_reclaimed: number;
  content_bottom_after_compaction: number;
  overflow_after: number;
  fit_pass: boolean;
};

export type CompactionAction = {
  type: "section_gap_compaction" | "heading_body_gap_compaction";
  lane_id: string | null;
  previous_section: string | null;
  next_section: string | null;
  gap_before: number;
  minimum_gap: number;
  reclaimable_before: number;
  pixels_reclaimed: number;
  gap_after: number;
  shifted_sections: string[];
  shifted_object_ids: string[];
};

export type SectionSystemRhythmAction = {
  section: string;
  lane_id: string | null;
  before_gap: number;
  after_gap: number;
  canonical_gap: number;
  delta_top: number;
  object_ids: string[];
};

export type InternalContentRhythmAction = {
  section: string;
  lane_id: string | null;
  canonical_gap: number;
  canonical_source:
    | "prior_consistent"
    | "current_mode"
    | "current_median"
    | "non_negative_floor";
  before_gaps: number[];
  after_gaps: number[];
  first_content_id: string;
  moved_object_ids: string[];
  heading_id: string | null;
  marker_id: string | null;
};

export type LayoutNormalizationReport = {
  schema_version: "founder-revision-layout-normalization-1.4.0";
  at: string;
  ok: boolean;
  canvas_source: "after_openai_operations_deterministic_layout_and_gap_compaction";
  constants: {
    min_section_gap_px: number;
    min_heading_body_gap_px: number;
    content_grid_left_tolerance_px: number;
    lane_horizontal_overlap_px: number;
    lane_anchor_join_px: number;
  };
  sections_detected: string[];
  section_order: string[];
  lanes: LayoutLaneReport[];
  before_bounds: SectionBounds[];
  after_bounds: SectionBounds[];
  shifts_applied: Array<{
    section: string;
    lane_id: string | null;
    delta_top: number;
    object_ids: string[];
    reason: string;
  }>;
  heading_body_gap_repairs: Array<{
    section: string;
    delta_top: number;
    object_ids: string[];
    before_gap: number;
    after_gap: number;
  }>;
  heading_style_changes: Array<{
    section: string;
    object_id: string;
    field: string;
    before: unknown;
    after: unknown;
  }>;
  content_grid_changes: Array<{
    object_id: string;
    field: "left";
    before: number;
    after: number;
    grid: "heading_rect" | "heading_text" | "body";
    lane_id: string | null;
  }>;
  compaction_actions: CompactionAction[];
  /**
   * Body-only heading→content equality adjustments. Empty when Founder did not
   * request same heading-to-content across a named section system, or when the
   * cohort could not be safely resolved (fail closed / skip).
   */
  section_system_rhythm_actions: SectionSystemRhythmAction[];
  /**
   * Founder-gated section→next-section gap equality. Empty when Founder did not
   * request the same spacing system between named stacked sections.
   */
  section_gap_rhythm_actions: SectionSystemRhythmAction[];
  /**
   * Founder-gated internal body-text whitespace equality. Empty when Founder
   * did not request consistent line/item spacing for a resolved section, or
   * when the section was already consistent within noise.
   */
  internal_content_rhythm_actions: InternalContentRhythmAction[];
  page_fit: PageFitReport | null;
  collision_resolutions: string[];
  page_overflow: boolean;
  page_overflow_bottom: number | null;
  page_height: number | null;
  warnings: string[];
  error: string | null;
};

function deepCloneCanvas(canvas: FabricCanvasDoc): FabricCanvasDoc {
  return JSON.parse(JSON.stringify(canvas)) as FabricCanvasDoc;
}

function objectId(o: FabricObj, index: number): string {
  if (typeof o.id === "string" && o.id.trim()) return o.id;
  const data = o.data;
  if (data && typeof data.id === "string" && data.id.trim()) return data.id;
  return `obj-${index}`;
}

function sectionOf(o: FabricObj): string | null {
  const s = o.data?.section;
  return typeof s === "string" && s.trim() ? s.trim().toLowerCase() : null;
}

function isSystemBg(o: FabricObj): boolean {
  const data = o.data;
  if (!data) return false;
  return (
    data.system === true ||
    data.kind === "page-bg" ||
    data.role === "pageBackground" ||
    o.role === "pageBackground"
  );
}

/** Full-height / decorative sidebar backgrounds are not section content. */
function isDecorativeNonSection(o: FabricObj): boolean {
  const role = String(o.data?.role ?? o.role ?? "").toLowerCase();
  if (
    role === "sidebar-bg" ||
    role === "column-bg" ||
    role === "decorative" ||
    role === "background"
  ) {
    return true;
  }
  return false;
}

function isRect(o: FabricObj): boolean {
  return String(o.type ?? "")
    .toLowerCase()
    .includes("rect");
}

/** Explicit semantic marker — never inferred from fill/color alone. */
export function isSectionMarkerRole(o: {
  role?: unknown;
  data?: unknown;
}): boolean {
  const data = o.data;
  const dataRole =
    data && typeof data === "object" && !Array.isArray(data)
      ? String((data as Record<string, unknown>).role ?? "")
      : "";
  const role = String(o.role ?? dataRole)
    .trim()
    .toLowerCase();
  return role === "section-marker";
}

function isText(o: FabricObj): boolean {
  return isFabricTextObject(o);
}

/**
 * Vertical extent for stacking. Text uses wrap-aware effective height so
 * section bottoms / next-section tops respect rendered wrap, not undersized
 * stored Fabric height alone.
 */
function estHeight(o: FabricObj): number {
  if (isText(o)) return effectiveTextHeightScaled(o);
  const h = Number(o.height ?? 0) * Number(o.scaleY ?? 1);
  if (h > 0) return h;
  return 0;
}

function bbox(o: FabricObj): {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
} {
  if (isText(o)) return effectiveObjectBBox(o);
  const left = Number(o.left ?? 0);
  const top = Number(o.top ?? 0);
  const width = Number(o.width ?? 0) * Number(o.scaleX ?? 1);
  const height = estHeight(o);
  return { left, top, right: left + width, bottom: top + height, width, height };
}

const KNOWN_HEADING_LABELS: ReadonlyArray<{ section: string; label: string }> = [
  { section: "summary", label: "SUMMARY" },
  { section: "experience", label: "EXPERIENCE" },
  { section: "education", label: "EDUCATION" },
  { section: "skills", label: "SKILLS" },
  { section: "projects", label: "PROJECTS" },
  { section: "certifications", label: "CERTIFICATIONS" },
  { section: "languages", label: "LANGUAGES" },
];

function headingLabelFromText(text: string | undefined): string | null {
  if (!text) return null;
  const t = text.trim().toUpperCase();
  for (const { label } of KNOWN_HEADING_LABELS) {
    if (t === label || new RegExp(`^(0?\\d\\s+)?${label}\\b`).test(t)) {
      return label;
    }
  }
  return null;
}

type SectionMember = { o: FabricObj; index: number; id: string };

type SectionGroup = {
  section: string;
  objects: SectionMember[];
  headingRect: SectionMember | null;
  headingText: SectionMember | null;
  body: SectionMember[];
  lane_id: string | null;
};

type LayoutLane = {
  lane_id: string;
  groups: SectionGroup[];
  anchor_left: number;
  bounds_left: number;
  bounds_right: number;
};

function detectHeadingText(
  section: string,
  objs: SectionMember[],
): SectionMember | null {
  const expectedLabel =
    KNOWN_HEADING_LABELS.find((h) => h.section === section)?.label ??
    section.toUpperCase();

  let headingText =
    objs.find(
      (x) =>
        isText(x.o) &&
        headingLabelFromText(
          typeof x.o.text === "string" ? x.o.text : undefined,
        ) === expectedLabel,
    ) ?? null;

  if (!headingText) {
    headingText =
      objs.find(
        (x) =>
          isText(x.o) &&
          String(x.o.data?.role ?? "") === "section-heading",
      ) ?? null;
  }

  if (!headingText && section !== "header") {
    // Short uppercase label-like textbox near the top of the section
    const texts = objs
      .filter((x) => isText(x.o) && typeof x.o.text === "string")
      .sort((a, b) => Number(a.o.top ?? 0) - Number(b.o.top ?? 0));
    const candidate = texts.find((x) => {
      const t = String(x.o.text ?? "").trim();
      return t.length > 0 && t.length <= 24 && t === t.toUpperCase();
    });
    headingText = candidate ?? null;
  }

  return headingText;
}

function detectHeadingRect(
  objs: SectionMember[],
  headingText: SectionMember | null,
): SectionMember | null {
  const explicitMarkers = objs.filter(
    (x) => isRect(x.o) && isSectionMarkerRole(x.o),
  );
  if (explicitMarkers.length === 1) return explicitMarkers[0]!;
  if (explicitMarkers.length > 1 && headingText) {
    const ht = Number(headingText.o.top ?? 0);
    let best = explicitMarkers[0]!;
    let bestScore = Math.abs(Number(best.o.top ?? 0) - ht);
    for (const x of explicitMarkers.slice(1)) {
      const score = Math.abs(Number(x.o.top ?? 0) - ht);
      if (score < bestScore) {
        bestScore = score;
        best = x;
      }
    }
    return best;
  }
  if (explicitMarkers.length > 1) return explicitMarkers[0]!;

  // Legacy fallback: spatial Rect↔heading pairing when role metadata is absent.
  if (!headingText) return null;
  const tb = bbox(headingText.o);
  let best: SectionMember | null = null;
  let bestScore = Number.POSITIVE_INFINITY;
  for (const x of objs) {
    if (!isRect(x.o)) continue;
    if (isSectionMarkerRole(x.o)) continue;
    const rb = bbox(x.o);
    // Ignore very tall decorative rects that dwarf the heading.
    if (rb.height > 80 && rb.height > tb.height * 4) continue;
    const overlaps =
      Math.min(tb.right, rb.right) - Math.max(tb.left, rb.left) >= 1 &&
      Math.min(tb.bottom, rb.bottom) - Math.max(tb.top, rb.top) >= 1;
    const nearBehind =
      Math.abs(rb.left - tb.left) <= 24 &&
      rb.top <= tb.top + 4 &&
      rb.bottom >= tb.top &&
      rb.height >= 4 &&
      rb.height <= 48;
    if (!overlaps && !nearBehind) continue;
    const score = Math.abs(rb.top - tb.top) + Math.abs(rb.left - tb.left) * 0.25;
    if (score < bestScore) {
      bestScore = score;
      best = x;
    }
  }
  return best;
}

function buildSectionGroups(objects: FabricObj[]): {
  groups: SectionGroup[];
  warnings: string[];
} {
  const warnings: string[] = [];
  const bySection = new Map<string, SectionMember[]>();

  for (let i = 0; i < objects.length; i++) {
    const o = objects[i]!;
    if (isSystemBg(o) || isDecorativeNonSection(o)) continue;
    const sec = sectionOf(o);
    if (!sec) continue;
    if (!bySection.has(sec)) bySection.set(sec, []);
    bySection.get(sec)!.push({ o, index: i, id: objectId(o, i) });
  }

  const sectionNames = [...bySection.keys()].sort((a, b) => {
    if (a === "header") return -1;
    if (b === "header") return 1;
    const aTop = Math.min(
      ...bySection.get(a)!.map((x) => Number(x.o.top ?? 0)),
    );
    const bTop = Math.min(
      ...bySection.get(b)!.map((x) => Number(x.o.top ?? 0)),
    );
    if (aTop !== bTop) return aTop - bTop;
    return a.localeCompare(b);
  });

  const groups: SectionGroup[] = [];
  for (const section of sectionNames) {
    const objs = bySection.get(section)!;
    if (objs.length === 0) continue;

    const headingText =
      section === "header" ? null : detectHeadingText(section, objs);
    const headingRect =
      section === "header" ? null : detectHeadingRect(objs, headingText);

    if (!headingText && section !== "header") {
      warnings.push(`section=${section} has objects but no heading text detected`);
    }

    const body = objs.filter((x) => {
      if (headingText && x.id === headingText.id) return false;
      if (headingRect && x.id === headingRect.id) return false;
      return true;
    });

    groups.push({
      section,
      objects: objs,
      headingRect,
      headingText,
      body,
      lane_id: null,
    });
  }

  return { groups, warnings };
}

function sectionBounds(g: SectionGroup): SectionBounds {
  let top = Number.POSITIVE_INFINITY;
  let bottom = Number.NEGATIVE_INFINITY;
  let left = Number.POSITIVE_INFINITY;
  let right = Number.NEGATIVE_INFINITY;
  for (const x of g.objects) {
    const b = bbox(x.o);
    top = Math.min(top, b.top);
    bottom = Math.max(bottom, b.bottom);
    left = Math.min(left, b.left);
    right = Math.max(right, b.right);
  }
  if (!Number.isFinite(top)) top = 0;
  if (!Number.isFinite(bottom)) bottom = 0;
  if (!Number.isFinite(left)) left = 0;
  if (!Number.isFinite(right)) right = 0;
  return {
    section: g.section,
    object_ids: g.objects.map((x) => x.id),
    top,
    bottom,
    left,
    right,
    heading_rect_id: g.headingRect?.id ?? null,
    heading_text_id: g.headingText?.id ?? null,
    body_ids: g.body.map((x) => x.id),
    lane_id: g.lane_id,
  };
}

function sectionAnchorLeft(g: SectionGroup): number {
  if (g.headingText) return Number(g.headingText.o.left ?? 0);
  if (g.headingRect) return Number(g.headingRect.o.left ?? 0);
  const bodyTexts = g.body.filter((x) => isText(x.o));
  if (bodyTexts.length > 0) {
    const lefts = bodyTexts.map((x) => Number(x.o.left ?? 0)).sort((a, b) => a - b);
    return lefts[Math.floor(lefts.length / 2)]!;
  }
  return sectionBounds(g).left;
}

function horizontalOverlap(a: SectionBounds, b: SectionBounds): number {
  return Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
}

/**
 * Infer body layout lanes from pre-normalization geometry only.
 * Header is never placed in a body lane.
 */
export function detectLayoutLanes(groups: SectionGroup[]): LayoutLane[] {
  const body = groups.filter((g) => g.section !== "header");
  if (body.length === 0) return [];

  const meta = body.map((g) => {
    const bounds = sectionBounds(g);
    return { g, bounds, anchor: sectionAnchorLeft(g) };
  });

  // Union-find clustering by horizontal proximity / overlap.
  const parent = meta.map((_, i) => i);
  const find = (i: number): number => {
    while (parent[i] !== i) {
      parent[i] = parent[parent[i]!]!;
      i = parent[i]!;
    }
    return i;
  };
  const union = (a: number, b: number): void => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[rb] = ra;
  };

  for (let i = 0; i < meta.length; i++) {
    for (let j = i + 1; j < meta.length; j++) {
      const a = meta[i]!;
      const b = meta[j]!;
      const overlap = horizontalOverlap(a.bounds, b.bounds);
      const anchorDist = Math.abs(a.anchor - b.anchor);
      if (overlap >= LANE_HORIZONTAL_OVERLAP_PX || anchorDist <= LANE_ANCHOR_JOIN_PX) {
        union(i, j);
      }
    }
  }

  const clusters = new Map<number, typeof meta>();
  for (let i = 0; i < meta.length; i++) {
    const root = find(i);
    if (!clusters.has(root)) clusters.set(root, []);
    clusters.get(root)!.push(meta[i]!);
  }

  const lanes: LayoutLane[] = [...clusters.values()]
    .map((members) => {
      const sorted = [...members].sort((a, b) => {
        if (a.bounds.top !== b.bounds.top) return a.bounds.top - b.bounds.top;
        return a.g.section.localeCompare(b.g.section);
      });
      const anchors = sorted.map((m) => m.anchor).sort((a, b) => a - b);
      const anchor_left = anchors[Math.floor(anchors.length / 2)]!;
      return {
        lane_id: "", // assigned after sort
        groups: sorted.map((m) => m.g),
        anchor_left,
        bounds_left: Math.min(...sorted.map((m) => m.bounds.left)),
        bounds_right: Math.max(...sorted.map((m) => m.bounds.right)),
      };
    })
    .sort((a, b) => a.anchor_left - b.anchor_left || a.bounds_left - b.bounds_left);

  lanes.forEach((lane, idx) => {
    lane.lane_id = `lane-${idx}`;
    for (const g of lane.groups) g.lane_id = lane.lane_id;
  });

  return lanes;
}

function shiftSection(g: SectionGroup, delta: number): string[] {
  if (Math.abs(delta) < 0.01) return [];
  const ids: string[] = [];
  for (const x of g.objects) {
    const top = Number(x.o.top ?? 0);
    x.o.top = Number((top + delta).toFixed(2));
    ids.push(x.id);
  }
  return ids;
}

function shiftSectionBody(g: SectionGroup, delta: number): string[] {
  if (Math.abs(delta) < 0.01) return [];
  const ids: string[] = [];
  for (const x of g.objects) {
    if (g.headingText && x.id === g.headingText.id) continue;
    if (g.headingRect && x.id === g.headingRect.id) continue;
    const top = Number(x.o.top ?? 0);
    x.o.top = Number((top + delta).toFixed(2));
    ids.push(x.id);
  }
  return ids;
}

function contentMaxBottom(objects: FabricObj[]): number {
  let max = 0;
  for (const o of objects) {
    if (isSystemBg(o)) continue;
    max = Math.max(max, bbox(o).bottom);
  }
  return max;
}

/**
 * Visual system signature for heading components.
 * Uses structural/component geometry (marker vs filled label, fills), NOT
 * fontSize/fontWeight — those are the fields style normalization equalizes
 * within a system.
 */
function headingVisualSystemKey(g: SectionGroup): string | null {
  if (!g.headingText) return null;
  const t = g.headingText.o;
  const r = g.headingRect?.o ?? null;
  const rectW = r ? bbox(r).width : -1;
  const rectH = r ? estHeight(r) : -1;
  const markerClass =
    rectW >= 0 && rectW <= 12 ? "marker" : rectW > 12 ? "filled" : "text-only";
  // Height band separates compact markers from tall filled pills without
  // requiring exact equality before normalization.
  const heightBand =
    rectH < 0 ? "none" : rectH <= 18 ? "sm" : rectH <= 32 ? "md" : "lg";
  const textFill = String(t.fill ?? "").toLowerCase();
  const rectFill = String(r?.fill ?? "").toLowerCase();
  return [markerClass, `hb:${heightBand}`, `tf:${textFill}`, `rf:${rectFill}`].join(
    "|",
  );
}

function normalizeHeadingStyles(
  groups: SectionGroup[],
  lanes: LayoutLane[],
  report: LayoutNormalizationReport,
): void {
  // Prefer SUMMARY/EXPERIENCE as reference only within their own visual system + lane.
  const bodyGroups = groups.filter((g) => g.section !== "header" && g.headingText);
  const refGroup =
    bodyGroups.find((g) => g.section === "summary") ??
    bodyGroups.find((g) => g.section === "experience") ??
    bodyGroups[0] ??
    null;

  if (!refGroup?.headingText) {
    report.warnings.push(
      "heading style normalization skipped: no reference heading",
    );
    return;
  }

  const refKey = headingVisualSystemKey(refGroup);
  if (!refKey) {
    report.warnings.push(
      "heading style normalization skipped: reference visual system unknown",
    );
    return;
  }

  const refText = refGroup.headingText.o;
  const refRect = refGroup.headingRect?.o ?? null;
  const refFontSize = Number(refText.fontSize ?? 0);
  if (!(refFontSize > 0)) {
    report.warnings.push(
      "heading style normalization skipped: reference fontSize missing",
    );
    return;
  }

  const refFontFamily = refText.fontFamily;
  const refFontWeight = refText.fontWeight ?? "700";
  const refTextFill = refText.fill;
  const refRectFill = refRect?.fill;
  const refRectHeight = refRect ? estHeight(refRect) : null;
  const refPadding =
    refRect != null
      ? Number(refText.top ?? 0) - Number(refRect.top ?? 0)
      : null;
  const refRectLeft = refRect != null ? Number(refRect.left ?? 0) : null;
  const refTextLeft = Number(refText.left ?? 0);
  const textPadFromRect =
    refRectLeft != null ? refTextLeft - refRectLeft : null;

  const refLane = refGroup.lane_id;

  for (const g of bodyGroups) {
    if (g.section === refGroup.section) continue;
    if (!g.headingText) continue;
    // Same visual system required. Prefer same lane; allow same-system cross-lane
    // only when both are clearly the same marker/filled class AND same lane was
    // not required — actually user asked NOT to collapse sidebar vs main when
    // different systems. Same key already encodes marker vs filled.
    // Additionally require same lane so distinct columns with coincidentally
    // similar markers don't share padding/left tweaks that fight lane grids.
    if (headingVisualSystemKey(g) !== refKey) continue;
    if (refLane != null && g.lane_id != null && g.lane_id !== refLane) {
      // Same visual key but different lane: still allow font/fill unify for
      // identical marker systems (OA-like), but skip left/padding that fights lanes.
    }

    const t = g.headingText.o;
    const changes: Array<[string, unknown, unknown]> = [];
    const sameLane = refLane == null || g.lane_id === refLane;

    if (Number(t.fontSize ?? 0) !== refFontSize) {
      changes.push(["fontSize", t.fontSize, refFontSize]);
      t.fontSize = refFontSize;
    }
    if (
      refFontFamily != null &&
      String(t.fontFamily ?? "") !== String(refFontFamily)
    ) {
      changes.push(["fontFamily", t.fontFamily, refFontFamily]);
      t.fontFamily = refFontFamily;
    }
    if (
      refFontWeight != null &&
      String(t.fontWeight ?? "") !== String(refFontWeight)
    ) {
      changes.push(["fontWeight", t.fontWeight, refFontWeight]);
      t.fontWeight = refFontWeight;
    }
    if (
      refTextFill != null &&
      String(t.fill ?? "").toLowerCase() !== String(refTextFill).toLowerCase()
    ) {
      changes.push(["fill", t.fill, refTextFill]);
      t.fill = refTextFill;
    }

    if (g.headingRect && refRect) {
      const r = g.headingRect.o;
      if (
        refRectFill != null &&
        String(r.fill ?? "").toLowerCase() !==
          String(refRectFill).toLowerCase()
      ) {
        changes.push(["rect.fill", r.fill, refRectFill]);
        r.fill = refRectFill;
      }
      if (
        refRectHeight != null &&
        Math.abs(estHeight(r) - refRectHeight) > 0.5
      ) {
        changes.push(["rect.height", r.height, refRectHeight]);
        r.height = refRectHeight;
        if (r.scaleY != null && Number(r.scaleY) !== 1) r.scaleY = 1;
      }
      if (sameLane && refPadding != null && textPadFromRect != null) {
        const desiredTop = Number(r.top ?? 0) + refPadding;
        const beforeTop = Number(t.top ?? 0);
        if (Math.abs(beforeTop - desiredTop) > 0.5) {
          changes.push(["top(padding)", beforeTop, desiredTop]);
          t.top = Number(desiredTop.toFixed(2));
        }
        const desiredLeft = Number(r.left ?? 0) + textPadFromRect;
        const beforeLeft = Number(t.left ?? 0);
        if (Math.abs(beforeLeft - desiredLeft) > CONTENT_GRID_LEFT_TOLERANCE_PX) {
          changes.push(["left(padding)", beforeLeft, desiredLeft]);
          t.left = Number(desiredLeft.toFixed(2));
        }
      }
    }

    for (const [field, before, after] of changes) {
      report.heading_style_changes.push({
        section: g.section,
        object_id: g.headingText.id,
        field,
        before,
        after,
      });
    }
  }

  void lanes;
}

function normalizeContentGridForLane(
  lane: LayoutLane,
  report: LayoutNormalizationReport,
): void {
  const groups = lane.groups;
  const headingRects = groups
    .filter((g) => g.headingRect)
    .map((g) => g.headingRect!);
  const headingTexts = groups
    .filter((g) => g.headingText)
    .map((g) => g.headingText!);

  if (headingRects.length >= 2) {
    const lefts = headingRects.map((x) => Number(x.o.left ?? 0));
    const targetLeft = lefts[0]!;
    for (const x of headingRects.slice(1)) {
      const before = Number(x.o.left ?? 0);
      if (Math.abs(before - targetLeft) > CONTENT_GRID_LEFT_TOLERANCE_PX) {
        x.o.left = targetLeft;
        report.content_grid_changes.push({
          object_id: x.id,
          field: "left",
          before,
          after: targetLeft,
          grid: "heading_rect",
          lane_id: lane.lane_id,
        });
      }
    }
  }

  if (headingTexts.length >= 2) {
    const targetLeft = Number(headingTexts[0]!.o.left ?? 0);
    for (const x of headingTexts.slice(1)) {
      const before = Number(x.o.left ?? 0);
      if (Math.abs(before - targetLeft) > CONTENT_GRID_LEFT_TOLERANCE_PX) {
        x.o.left = targetLeft;
        report.content_grid_changes.push({
          object_id: x.id,
          field: "left",
          before,
          after: targetLeft,
          grid: "heading_text",
          lane_id: lane.lane_id,
        });
      }
    }
  }

  // Body: align each section's body column as a block (preserve intra-section
  // indentation by applying one delta per section).
  const sectionAnchors: Array<{ g: SectionGroup; anchor: number }> = [];
  for (const g of groups) {
    const bodyTexts = g.body.filter((x) => isText(x.o));
    if (bodyTexts.length === 0) continue;
    const anchor = Math.min(...bodyTexts.map((x) => Number(x.o.left ?? 0)));
    sectionAnchors.push({ g, anchor });
  }
  if (sectionAnchors.length >= 2) {
    const targetLeft = sectionAnchors[0]!.anchor;
    for (const { g, anchor } of sectionAnchors) {
      const delta = targetLeft - anchor;
      if (Math.abs(delta) <= CONTENT_GRID_LEFT_TOLERANCE_PX) continue;
      for (const x of g.body) {
        const before = Number(x.o.left ?? 0);
        const after = Number((before + delta).toFixed(2));
        x.o.left = after;
        if (isText(x.o)) {
          report.content_grid_changes.push({
            object_id: x.id,
            field: "left",
            before,
            after,
            grid: "body",
            lane_id: lane.lane_id,
          });
        }
      }
    }
  }
}

function normalizeContentGrid(
  lanes: LayoutLane[],
  report: LayoutNormalizationReport,
): void {
  for (const lane of lanes) {
    normalizeContentGridForLane(lane, report);
  }
}

function enforceHeadingBodyGaps(
  groups: SectionGroup[],
  report: LayoutNormalizationReport,
): void {
  for (const g of groups) {
    if (g.section === "header") continue;
    if (!g.headingText && !g.headingRect) continue;
    if (g.body.length === 0) continue;

    const headingBottom = Math.max(
      g.headingRect ? bbox(g.headingRect.o).bottom : Number.NEGATIVE_INFINITY,
      g.headingText ? bbox(g.headingText.o).bottom : Number.NEGATIVE_INFINITY,
    );
    if (!Number.isFinite(headingBottom)) continue;

    const content = g.body.filter((x) => isText(x.o));
    if (content.length === 0) continue;
    const bodiesSorted = [...content].sort(
      (a, b) => Number(a.o.top ?? 0) - Number(b.o.top ?? 0),
    );
    const first = bodiesSorted[0]!;
    const firstTop = Number(first.o.top ?? 0);
    const beforeGap = firstTop - headingBottom;
    if (beforeGap >= MIN_HEADING_BODY_GAP_PX) continue;

    const delta = MIN_HEADING_BODY_GAP_PX - beforeGap;
    const moved = shiftSectionBody(g, delta);
    const afterFirstTop = Number(first.o.top ?? 0);
    const afterGap = afterFirstTop - headingBottom;
    report.heading_body_gap_repairs.push({
      section: g.section,
      delta_top: delta,
      object_ids: [...new Set(moved)],
      before_gap: beforeGap,
      after_gap: afterGap,
    });
    report.collision_resolutions.push(
      `heading→body gap repaired in ${g.section}: ${beforeGap.toFixed(1)}→${afterGap.toFixed(1)}`,
    );
  }
}

function sortLaneGroupsByTop(lane: LayoutLane): SectionGroup[] {
  return [...lane.groups].sort((a, b) => {
    const at = sectionBounds(a).top;
    const bt = sectionBounds(b).top;
    if (at !== bt) return at - bt;
    return a.section.localeCompare(b.section);
  });
}

function enforceSectionStackInLane(
  lane: LayoutLane,
  report: LayoutNormalizationReport,
): void {
  const stackable = sortLaneGroupsByTop(lane);
  lane.groups = stackable;

  for (let i = 1; i < stackable.length; i++) {
    const prev = stackable[i - 1]!;
    const cur = stackable[i]!;
    const prevBounds = sectionBounds(prev);
    const curBounds = sectionBounds(cur);
    const gap = curBounds.top - prevBounds.bottom;
    if (gap >= MIN_SECTION_GAP_PX) continue;
    const delta = MIN_SECTION_GAP_PX - gap;
    const moved = shiftSection(cur, delta);
    for (let j = i + 1; j < stackable.length; j++) {
      const down = stackable[j]!;
      const downMoved = shiftSection(down, delta);
      report.shifts_applied.push({
        section: down.section,
        lane_id: lane.lane_id,
        delta_top: delta,
        object_ids: downMoved,
        reason: `downstream flow after ${cur.section} reflow (${lane.lane_id})`,
      });
    }
    report.shifts_applied.push({
      section: cur.section,
      lane_id: lane.lane_id,
      delta_top: delta,
      object_ids: moved,
      reason: `section stack (${lane.lane_id}): gap ${gap.toFixed(1)}px < min ${MIN_SECTION_GAP_PX}px after ${prev.section}`,
    });
    report.collision_resolutions.push(
      `${cur.section} pushed +${delta.toFixed(1)}px below ${prev.section} in ${lane.lane_id}`,
    );
  }
}

function enforceSectionStack(
  lanes: LayoutLane[],
  report: LayoutNormalizationReport,
): void {
  for (const lane of lanes) {
    enforceSectionStackInLane(lane, report);
  }
}

function headerHorizontalBounds(header: SectionGroup): {
  left: number;
  right: number;
} {
  const b = sectionBounds(header);
  return { left: b.left, right: b.right };
}

function rangesOverlap(
  a: { left: number; right: number },
  b: { left: number; right: number },
  minOverlap = 1,
): boolean {
  return Math.min(a.right, b.right) - Math.max(a.left, b.left) >= minOverlap;
}

/**
 * Ensure each body lane that intersects the header horizontally starts below
 * header/contact content. Contact→Summary repair is lane-local to Summary.
 */
function enforceHeaderClearance(
  groups: SectionGroup[],
  lanes: LayoutLane[],
  report: LayoutNormalizationReport,
): void {
  const header = groups.find((g) => g.section === "header");
  if (!header) return;

  const headerBounds = headerHorizontalBounds(header);
  const contact = header.objects.find(
    (x) =>
      isText(x.o) &&
      typeof x.o.text === "string" &&
      (/@/.test(x.o.text) ||
        /linkedin/i.test(x.o.text) ||
        /\+?\d[\d\s().-]{6,}\d/.test(x.o.text)),
  );
  const clearanceBottom = contact
    ? bbox(contact.o).bottom
    : sectionBounds(header).bottom;

  for (const lane of lanes) {
    if (
      !rangesOverlap(headerBounds, {
        left: lane.bounds_left,
        right: lane.bounds_right,
      })
    ) {
      continue;
    }
    const ordered = sortLaneGroupsByTop(lane);
    if (ordered.length === 0) continue;

    // Prefer Summary-specific contact gap when Summary is in this lane.
    const summary = ordered.find((g) => g.section === "summary");
    const focus = summary ?? ordered[0]!;
    const focusTop = focus.headingRect
      ? bbox(focus.headingRect.o).top
      : focus.headingText
        ? bbox(focus.headingText.o).top
        : sectionBounds(focus).top;
    const gap = focusTop - clearanceBottom;
    if (gap + 1e-9 >= MIN_SECTION_GAP_PX) continue;

    const delta = MIN_SECTION_GAP_PX - gap;
    if (delta <= 0.01) continue;

    const startIdx = ordered.findIndex((g) => g.section === focus.section);
    if (startIdx < 0) continue;
    for (let j = startIdx; j < ordered.length; j++) {
      const g = ordered[j]!;
      const moved = shiftSection(g, delta);
      report.shifts_applied.push({
        section: g.section,
        lane_id: lane.lane_id,
        delta_top: delta,
        object_ids: moved,
        reason:
          g.section === focus.section
            ? `header clearance→${focus.section} gap ${gap.toFixed(1)}px < min ${MIN_SECTION_GAP_PX}px (${lane.lane_id})`
            : `downstream flow after header clearance (${lane.lane_id})`,
      });
    }
    report.collision_resolutions.push(
      `header clearance repaired for ${focus.section} in ${lane.lane_id}: ${gap.toFixed(1)}→${(gap + delta).toFixed(1)}`,
    );
  }
}

/** @deprecated name kept via enforceHeaderClearance */
function enforceHeaderContactToSummaryGap(
  groups: SectionGroup[],
  lanes: LayoutLane[],
  report: LayoutNormalizationReport,
): void {
  enforceHeaderClearance(groups, lanes, report);
}

function headingBottomOf(g: SectionGroup): number | null {
  if (!g.headingText && !g.headingRect) return null;
  const bottom = Math.max(
    g.headingRect ? bbox(g.headingRect.o).bottom : Number.NEGATIVE_INFINITY,
    g.headingText ? bbox(g.headingText.o).bottom : Number.NEGATIVE_INFINITY,
  );
  return Number.isFinite(bottom) ? bottom : null;
}

function firstBodyTopOf(g: SectionGroup): number | null {
  const content = sectionBodyContentTexts(g);
  if (content.length === 0) return null;
  let top = Number.POSITIVE_INFINITY;
  for (const x of content) {
    top = Math.min(top, Number(x.o.top ?? 0));
  }
  return Number.isFinite(top) ? top : null;
}

/**
 * Section body TEXT objects only: excludes marker, heading, heading-associated
 * rect, and decorative/non-text body. Ordered by vertical position, then id.
 */
function sectionBodyContentTexts(g: SectionGroup): SectionMember[] {
  return g.body
    .filter((x) => isText(x.o))
    .filter((x) => !isSectionMarkerRole(x.o))
    .filter((x) => String(x.o.data?.role ?? x.o.role ?? "") !== "section-heading")
    .sort((a, b) => {
      const at = Number(a.o.top ?? 0);
      const bt = Number(b.o.top ?? 0);
      if (at !== bt) return at - bt;
      return a.id.localeCompare(b.id);
    });
}

/** Whitespace: next.top − current.bottom. Not top-to-top pitch. */
function contentWhitespaces(texts: SectionMember[]): number[] {
  const gaps: number[] = [];
  for (let i = 0; i < texts.length - 1; i++) {
    const currentBottom = bbox(texts[i]!.o).bottom;
    const nextTop = Number(texts[i + 1]!.o.top ?? 0);
    gaps.push(snapGap(nextTop - currentBottom));
  }
  return gaps;
}

/**
 * Deterministic ordered body restack: when effective previous.bottom exceeds
 * next.top, push subsequent body tops to clear the overlap (gap ≥ 0).
 * Heading/marker unchanged. Generic for n≥2 body texts.
 */
function restackOrderedBodyTextsClearEffectiveOverlap(
  g: SectionGroup,
  report: LayoutNormalizationReport,
  reason: string,
): string[] {
  const texts = sectionBodyContentTexts(g);
  if (texts.length < 2) return [];
  const moved: string[] = [];
  for (let i = 1; i < texts.length; i++) {
    const prev = texts[i - 1]!;
    const cur = texts[i]!;
    // Ceil to 0.01px so snap/float noise cannot leave a sub-pixel overlap.
    const desired = Math.ceil(bbox(prev.o).bottom * 100) / 100;
    const beforeTop = Number(cur.o.top ?? 0);
    if (beforeTop + 1e-9 < desired) {
      cur.o.top = desired;
      moved.push(cur.id);
    }
  }
  if (moved.length > 0) {
    report.collision_resolutions.push(
      `ordered-body effective overlap clear (${g.section}): moved=[${moved.join(",")}] reason=${reason}`,
    );
  }
  return moved;
}

function totalReclaimableSlack(
  header: SectionGroup | null,
  lanes: LayoutLane[],
): number {
  let sum = 0;
  const headerBottom = header ? sectionBounds(header).bottom : null;
  const headerHBounds = header ? headerHorizontalBounds(header) : null;
  for (const lane of lanes) {
    const ordered = sortLaneGroupsByTop(lane);
    if (
      header &&
      headerBottom != null &&
      headerHBounds &&
      ordered.length > 0 &&
      rangesOverlap(headerHBounds, {
        left: lane.bounds_left,
        right: lane.bounds_right,
      })
    ) {
      const firstTop = sectionBounds(ordered[0]!).top;
      sum += Math.max(0, firstTop - headerBottom - MIN_SECTION_GAP_PX);
    }
    for (let i = 1; i < ordered.length; i++) {
      const prev = sectionBounds(ordered[i - 1]!);
      const cur = sectionBounds(ordered[i]!);
      sum += Math.max(0, cur.top - prev.bottom - MIN_SECTION_GAP_PX);
    }
    for (const g of ordered) {
      const hb = headingBottomOf(g);
      const bt = firstBodyTopOf(g);
      if (hb == null || bt == null) continue;
      sum += Math.max(0, bt - hb - MIN_HEADING_BODY_GAP_PX);
    }
  }
  return Number(sum.toFixed(2));
}

function compactExcessGapsForPageFit(
  header: SectionGroup | null,
  lanes: LayoutLane[],
  objects: FabricObj[],
  pageH: number,
  report: LayoutNormalizationReport,
): void {
  const contentBefore = contentMaxBottom(objects);
  const overflowBefore = Math.max(0, contentBefore - pageH);
  const totalSlack = totalReclaimableSlack(header, lanes);
  let pixelsReclaimed = 0;

  const remainingOverflow = () =>
    Math.max(0, contentMaxBottom(objects) - pageH);

  // Phase 1 — excess inter-section gaps within a lane (largest first),
  // including header → first section in geometrically intersecting lanes.
  while (remainingOverflow() > 0.5) {
    let bestLane: LayoutLane | null = null;
    let bestIdx = -1; // 0 = header→first; >=1 = ordered[i-1]→ordered[i]
    let bestExcess = 0;
    let bestGap = 0;
    let bestOrdered: SectionGroup[] = [];
    let bestPrevSection = "header";

    for (const lane of lanes) {
      const ordered = sortLaneGroupsByTop(lane);
      if (
        header &&
        ordered.length > 0 &&
        rangesOverlap(headerHorizontalBounds(header), {
          left: lane.bounds_left,
          right: lane.bounds_right,
        })
      ) {
        const headerBottom = sectionBounds(header).bottom;
        const firstTop = sectionBounds(ordered[0]!).top;
        const gap = firstTop - headerBottom;
        const excess = gap - MIN_SECTION_GAP_PX;
        if (excess > bestExcess + 1e-9) {
          bestExcess = excess;
          bestGap = gap;
          bestIdx = 0;
          bestLane = lane;
          bestOrdered = ordered;
          bestPrevSection = "header";
        }
      }
      for (let i = 1; i < ordered.length; i++) {
        const prevB = sectionBounds(ordered[i - 1]!);
        const curB = sectionBounds(ordered[i]!);
        const gap = curB.top - prevB.bottom;
        const excess = gap - MIN_SECTION_GAP_PX;
        if (excess > bestExcess + 1e-9) {
          bestExcess = excess;
          bestGap = gap;
          bestIdx = i;
          bestLane = lane;
          bestOrdered = ordered;
          bestPrevSection = ordered[i - 1]!.section;
        }
      }
    }
    if (!bestLane || bestIdx < 0 || bestExcess <= 0) break;

    const take = Math.min(bestExcess, remainingOverflow());
    if (take <= 0.01) break;

    const next = bestOrdered[bestIdx === 0 ? 0 : bestIdx]!;
    const shiftedSections: string[] = [];
    const shiftedIds: string[] = [];
    const startJ = bestIdx === 0 ? 0 : bestIdx;
    for (let j = startJ; j < bestOrdered.length; j++) {
      const g = bestOrdered[j]!;
      const moved = shiftSection(g, -take);
      shiftedSections.push(g.section);
      shiftedIds.push(...moved);
    }
    const prevBottom =
      bestIdx === 0 && header
        ? sectionBounds(header).bottom
        : sectionBounds(bestOrdered[bestIdx - 1]!).bottom;
    const gapAfter = sectionBounds(next).top - prevBottom;
    report.compaction_actions.push({
      type: "section_gap_compaction",
      lane_id: bestLane.lane_id,
      previous_section: bestPrevSection,
      next_section: next.section,
      gap_before: Number(bestGap.toFixed(2)),
      minimum_gap: MIN_SECTION_GAP_PX,
      reclaimable_before: Number(bestExcess.toFixed(2)),
      pixels_reclaimed: Number(take.toFixed(2)),
      gap_after: Number(gapAfter.toFixed(2)),
      shifted_sections: shiftedSections,
      shifted_object_ids: [...new Set(shiftedIds)],
    });
    report.collision_resolutions.push(
      `page-fit: reclaimed ${take.toFixed(1)}px from ${bestPrevSection}→${next.section} excess gap (${bestLane.lane_id})`,
    );
    pixelsReclaimed += take;
  }

  // Phase 2 — excess heading→body gaps; move body + same-lane downstream
  while (remainingOverflow() > 0.5) {
    let bestG: SectionGroup | null = null;
    let bestLane: LayoutLane | null = null;
    let bestExcess = 0;
    let bestGap = 0;
    let bestHeadingBottom = 0;
    let bestOrdered: SectionGroup[] = [];

    for (const lane of lanes) {
      const ordered = sortLaneGroupsByTop(lane);
      for (const g of ordered) {
        const hb = headingBottomOf(g);
        const bt = firstBodyTopOf(g);
        if (hb == null || bt == null) continue;
        const gap = bt - hb;
        const excess = gap - MIN_HEADING_BODY_GAP_PX;
        if (excess > bestExcess + 1e-9) {
          bestExcess = excess;
          bestGap = gap;
          bestG = g;
          bestLane = lane;
          bestHeadingBottom = hb;
          bestOrdered = ordered;
        }
      }
    }
    if (!bestG || !bestLane || bestExcess <= 0) break;

    const take = Math.min(bestExcess, remainingOverflow());
    if (take <= 0.01) break;

    const gIndex = bestOrdered.findIndex((x) => x.section === bestG!.section);
    const shiftedSections: string[] = [bestG.section];
    const shiftedIds = shiftSectionBody(bestG, -take);
    for (let j = gIndex + 1; j < bestOrdered.length; j++) {
      const down = bestOrdered[j]!;
      const moved = shiftSection(down, -take);
      shiftedSections.push(down.section);
      shiftedIds.push(...moved);
    }
    const afterBodyTop = firstBodyTopOf(bestG) ?? bestHeadingBottom;
    const gapAfter = afterBodyTop - bestHeadingBottom;
    report.compaction_actions.push({
      type: "heading_body_gap_compaction",
      lane_id: bestLane.lane_id,
      previous_section: bestG.section,
      next_section: bestG.section,
      gap_before: Number(bestGap.toFixed(2)),
      minimum_gap: MIN_HEADING_BODY_GAP_PX,
      reclaimable_before: Number(bestExcess.toFixed(2)),
      pixels_reclaimed: Number(take.toFixed(2)),
      gap_after: Number(gapAfter.toFixed(2)),
      shifted_sections: shiftedSections,
      shifted_object_ids: [...new Set(shiftedIds)],
    });
    report.collision_resolutions.push(
      `page-fit: reclaimed ${take.toFixed(1)}px from ${bestG.section} heading→body excess gap (${bestLane.lane_id})`,
    );
    pixelsReclaimed += take;
  }

  const contentAfter = contentMaxBottom(objects);
  const overflowAfter = Math.max(0, contentAfter - pageH);
  report.page_fit = {
    page_height: pageH,
    content_bottom_before_compaction: Number(contentBefore.toFixed(2)),
    overflow_before: Number(overflowBefore.toFixed(2)),
    total_reclaimable_slack: totalSlack,
    pixels_reclaimed: Number(pixelsReclaimed.toFixed(2)),
    content_bottom_after_compaction: Number(contentAfter.toFixed(2)),
    overflow_after: Number(overflowAfter.toFixed(2)),
    fit_pass: overflowAfter <= 0.5,
  };
}

function lanesReport(lanes: LayoutLane[]): LayoutLaneReport[] {
  return lanes.map((lane) => ({
    lane_id: lane.lane_id,
    anchor_left: Number(lane.anchor_left.toFixed(2)),
    bounds_left: Number(lane.bounds_left.toFixed(2)),
    bounds_right: Number(lane.bounds_right.toFixed(2)),
    section_order: sortLaneGroupsByTop(lane).map((g) => g.section),
  }));
}

/**
 * Read-only lane detection facade for acceptance / coverage.
 * Reuses buildSectionGroups + detectLayoutLanes — does not mutate canvas
 * and does not change normalization behavior.
 */
export type LayoutLaneDetection = {
  lanes: LayoutLaneReport[];
  section_to_lane: Record<string, string>;
  object_id_to_lane: Record<string, string>;
  lane_count: number;
};

export function detectLayoutLanesFromCanvas(
  canvas: FabricCanvasDoc,
): LayoutLaneDetection {
  const objects = (canvas.objects ?? []) as FabricObj[];
  const { groups } = buildSectionGroups(objects);
  const lanes = detectLayoutLanes(groups);
  const section_to_lane: Record<string, string> = {};
  const object_id_to_lane: Record<string, string> = {};
  for (const lane of lanes) {
    for (const g of lane.groups) {
      section_to_lane[g.section] = lane.lane_id;
      for (const m of g.objects) {
        object_id_to_lane[m.id] = lane.lane_id;
      }
    }
  }
  return {
    lanes: lanesReport(lanes),
    section_to_lane,
    object_id_to_lane,
    lane_count: lanes.length,
  };
}

export type SectionGroupInspection = {
  section: string;
  heading_rect_id: string | null;
  heading_text_id: string | null;
  body_ids: string[];
  first_content_top: number | null;
  marker_recognized_by_role: boolean;
};

/** Read-only inspection of section membership after marker/body classification. */
export function inspectRevisionSectionGroups(
  canvas: FabricCanvasDoc,
): SectionGroupInspection[] {
  const objects = (canvas.objects ?? []) as FabricObj[];
  const { groups } = buildSectionGroups(objects);
  return groups.map((g) => ({
    section: g.section,
    heading_rect_id: g.headingRect?.id ?? null,
    heading_text_id: g.headingText?.id ?? null,
    body_ids: g.body.map((x) => x.id),
    first_content_top: firstBodyTopOf(g),
    marker_recognized_by_role: g.objects.some((x) => isSectionMarkerRole(x.o)),
  }));
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function snapGap(n: number): number {
  return Number(n.toFixed(2));
}

/**
 * True only when Founder text explicitly asks for the SAME heading-to-content
 * (heading-body) relationship — not generic "consistent spacing" / "section rhythm".
 */
export function isFounderHeadingToContentEqualityRequest(
  requestedChange: string,
): boolean {
  const n = requestedChange
    .replace(/^\*+\s*/, "")
    .replace(/^\d+\.\s*/, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
  if (!n) return false;
  if (!/\b(same|identical|consistent)\b/.test(n)) return false;
  return (
    /heading[-\s]?to[-\s]?content/.test(n) ||
    /heading\s*→\s*content/.test(n) ||
    /heading[-\s]?to[-\s]?body/.test(n) ||
    /heading[-\s]?body\s+(gap|relationship|spacing)/.test(n) ||
    (/heading[-\s]?body/.test(n) && /\brelationship\b/.test(n))
  );
}

/**
 * True only when Founder text explicitly asks for the SAME gap/rhythm BETWEEN
 * stacked named sections — not generic "consistent spacing", and not
 * heading-to-content equality alone.
 */
export function isFounderSectionToSectionGapEqualityRequest(
  requestedChange: string,
): boolean {
  const n = requestedChange
    .replace(/^\*+\s*/, "")
    .replace(/^\d+\.\s*/, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
  if (!n) return false;
  if (!/\b(same|identical|consistent|uniform|equal)\b/.test(n)) return false;
  if (!/\b(gap|rhythm|spacing)\b/.test(n)) return false;
  if (/section-to-section/.test(n) && /\b(rhythm|gap|spacing)\b/.test(n)) {
    return true;
  }
  if (/\bsame\s+spacing\s+system\b/.test(n) && /\b(between|skills|projects)\b/.test(n)) {
    return true;
  }
  if (
    /\bbetween\b/.test(n) &&
    (/\bsections?\b/.test(n) || /→/.test(n) || /\bto\b/.test(n)) &&
    /\b(gap|rhythm|spacing)\b/.test(n)
  ) {
    return true;
  }
  return false;
}

/**
 * True only when Founder text explicitly asks for consistent readable spacing
 * BETWEEN content lines/items of a measurable section — not generic
 * "make the section readable", and not page-wide section spacing.
 */
export function isFounderInternalContentRhythmRequest(
  requestedChange: string,
): boolean {
  const n = requestedChange
    .replace(/^\*+\s*/, "")
    .replace(/^\d+\.\s*/, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
  if (!n) return false;

  const consistency =
    /\b(consistent|consistently|even|evenly|uniform|equal)\b/.test(n);
  const lineSpacing =
    /\bline\s+spacing\b/.test(n) ||
    /\bspaced\s+lines\b/.test(n) ||
    /\blines?\s+(?:that\s+are\s+)?(?:consistently|evenly|uniformly)\s+spaced\b/.test(
      n,
    );
  const individuallyReadableLines =
    /\bindividually\s+readable\b/.test(n) && /\blines?\b/.test(n);
  const stackedConsistent =
    /\bvertically\s+stacked\b/.test(n) &&
    consistency &&
    /\bspacing\b/.test(n);
  const internalContent = /\binternal\s+content\s+spacing\b/.test(n);

  // Reflow / readable separation / overlap correction within a section body.
  const reflowReadable =
    /\breflow\b/.test(n) &&
    (/\breadable\b/.test(n) ||
      /\bvertically\s+separated\b/.test(n) ||
      /\bno\s+collision\b/.test(n) ||
      /\bno\s+overlap\b/.test(n));
  const verticallySeparatedReadable =
    /\bvertically\s+separated\b/.test(n) && /\breadable\b/.test(n);
  const noTextOverlapInSection =
    (/\bno\s+(?:text[- ]to[- ]text\s+)?overlap\b/.test(n) ||
      /\bno\s+collision\b/.test(n) ||
      /\bzero\s+text\s+overlap\b/.test(n)) &&
    (/\bsection\b/.test(n) ||
      /\bskills\b/.test(n) ||
      /\bprojects\b/.test(n) ||
      /\bcertifications?\b/.test(n) ||
      /\blanguages?\b/.test(n) ||
      /\beducation\b/.test(n) ||
      /\bexperience\b/.test(n) ||
      /\bsidebar\b/.test(n));

  if (lineSpacing && consistency) return true;
  if (individuallyReadableLines) return true;
  if (stackedConsistent) return true;
  if (internalContent) return true;
  if (reflowReadable) return true;
  if (verticallySeparatedReadable) return true;
  if (noTextOverlapInSection) return true;
  return false;
}

function sectionNameMentioned(normalized: string, section: string): boolean {
  if (new RegExp(`\\b${escapeRegExp(section)}\\b`).test(normalized)) return true;
  if (section.endsWith("s") && section.length > 3) {
    const stem = section.slice(0, -1);
    if (new RegExp(`\\b${escapeRegExp(stem)}\\b`).test(normalized)) return true;
  }
  return false;
}

function founderInternalContentRhythmCohort(
  requestedChanges: string[],
  groups: SectionGroup[],
): {
  sections: string[];
  founder_item: string | null;
  skip_reason: string | null;
} {
  const detected = groups
    .map((g) => g.section)
    .filter((s) => s !== "header");
  const sections = new Set<string>();
  let founder_item: string | null = null;
  let matchedIntentWithoutSection = false;
  for (const raw of requestedChanges) {
    if (!isFounderInternalContentRhythmRequest(raw)) continue;
    const n = raw
      .replace(/^\*+\s*/, "")
      .replace(/^\d+\.\s*/, "")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
    const named = detected.filter((s) => sectionNameMentioned(n, s));
    if (named.length === 0) {
      matchedIntentWithoutSection = true;
      continue;
    }
    if (!founder_item) founder_item = raw;
    for (const s of named) sections.add(s);
  }
  if (sections.size === 0) {
    if (matchedIntentWithoutSection) {
      return {
        sections: [],
        founder_item: null,
        skip_reason:
          "internal-content rhythm requested but no specific section could be resolved",
      };
    }
    return { sections: [], founder_item: null, skip_reason: null };
  }
  return {
    sections: [...sections],
    founder_item,
    skip_reason: null,
  };
}

function whitespaceConsistent(gaps: number[]): boolean {
  if (gaps.length === 0) return true;
  if (gaps.some((g) => g < -1e-9)) return false;
  const spread = snapGap(Math.max(...gaps) - Math.min(...gaps));
  return spread <= GAP_RELATION_NOISE_PX;
}

function medianGap(gaps: number[]): number {
  const sorted = [...gaps].map(snapGap).sort((a, b) => a - b);
  if (sorted.length === 0) return 0;
  const mid = (sorted.length - 1) / 2;
  if (Number.isInteger(mid)) return sorted[mid]!;
  return snapGap((sorted[Math.floor(mid)]! + sorted[Math.ceil(mid)]!) / 2);
}

/**
 * Canonical internal (bottom→top) whitespace.
 *
 * MIN_HEADING_BODY_GAP_PX is a heading→first-content floor, not a line-to-line
 * minimum, and is never applied here. Overlap is never chosen (gap < 0 rejected).
 *
 * Preference order when correction is warranted:
 * 1. Prior same-section whitespace if it was valid, collision-free, and consistent
 * 2. Unique repeated mode of current non-negative gaps
 * 3. Median of current non-negative gaps
 * 4. 0 (touching, not overlapping) if every current gap is negative
 */
function canonicalInternalContentGap(
  currentGaps: number[],
  priorGaps: number[] | null,
): {
  gap: number;
  source: InternalContentRhythmAction["canonical_source"];
} {
  if (
    priorGaps &&
    priorGaps.length === currentGaps.length &&
    whitespaceConsistent(priorGaps) &&
    priorGaps.every((g) => g + 1e-9 >= 0)
  ) {
    return { gap: medianGap(priorGaps), source: "prior_consistent" };
  }

  const legal = currentGaps.map(snapGap).filter((g) => g + 1e-9 >= 0);
  if (legal.length === 0) {
    return { gap: 0, source: "non_negative_floor" };
  }

  const counts = new Map<number, number>();
  for (const g of legal) {
    counts.set(g, (counts.get(g) ?? 0) + 1);
  }
  let bestCount = 0;
  const winners: number[] = [];
  for (const [g, c] of counts) {
    if (c > bestCount) {
      bestCount = c;
      winners.length = 0;
      winners.push(g);
    } else if (c === bestCount) {
      winners.push(g);
    }
  }
  if (winners.length === 1 && bestCount >= 2) {
    return { gap: winners[0]!, source: "current_mode" };
  }
  return { gap: medianGap(legal), source: "current_median" };
}

function priorContentTextsForSection(
  priorCanvas: FabricCanvasDoc | null | undefined,
  section: string,
  currentIds: string[],
): SectionMember[] | null {
  if (!priorCanvas) return null;
  const priorObjects = (deepCloneCanvas(priorCanvas).objects ?? []) as FabricObj[];
  const { groups } = buildSectionGroups(priorObjects);
  const priorG = groups.find((g) => g.section === section);
  if (!priorG) return null;
  const byId = new Map(sectionBodyContentTexts(priorG).map((t) => [t.id, t]));
  const aligned: SectionMember[] = [];
  for (const id of currentIds) {
    const hit = byId.get(id);
    if (!hit) return null;
    aligned.push(hit);
  }
  return aligned;
}

/**
 * Founder-gated: equalize internal body-text whitespace inside a named section.
 * Heading and marker are never moved. First content object is the anchor.
 * Subsequent content tops become previous.bottom + canonical_gap.
 */
function enforceFounderInternalContentRhythm(
  groups: SectionGroup[],
  requestedChanges: string[],
  report: LayoutNormalizationReport,
  priorCanvas?: FabricCanvasDoc | null,
): void {
  if (!requestedChanges.length) return;

  const resolved = founderInternalContentRhythmCohort(requestedChanges, groups);
  if (resolved.skip_reason) {
    report.warnings.push(resolved.skip_reason);
    return;
  }
  if (resolved.sections.length === 0) return;

  const bySection = new Map(groups.map((g) => [g.section, g]));
  for (const name of resolved.sections) {
    const g = bySection.get(name);
    if (!g) continue;

    const markerTop = g.headingRect ? Number(g.headingRect.o.top ?? 0) : null;
    const headingTop = g.headingText ? Number(g.headingText.o.top ?? 0) : null;
    const headingLeft = g.headingText ? Number(g.headingText.o.left ?? 0) : null;
    const markerLeft = g.headingRect ? Number(g.headingRect.o.left ?? 0) : null;

    const texts = sectionBodyContentTexts(g);
    // n≥2: two body textboxes form an ordered stack (Skills-shaped).
    if (texts.length < 2) continue;

    const beforeGaps = contentWhitespaces(texts);
    if (whitespaceConsistent(beforeGaps)) {
      // Still clear any residual effective overlap (defensive).
      restackOrderedBodyTextsClearEffectiveOverlap(
        g,
        report,
        "post-consistent-check",
      );
      continue;
    }

    const priorTexts = priorContentTextsForSection(
      priorCanvas,
      name,
      texts.map((t) => t.id),
    );
    const priorGaps = priorTexts ? contentWhitespaces(priorTexts) : null;
    const { gap: canonical, source } = canonicalInternalContentGap(
      beforeGaps,
      priorGaps,
    );

    const first = texts[0]!;
    const firstTop = Number(first.o.top ?? 0);
    const leftsBefore = texts.map((t) => Number(t.o.left ?? 0));
    const moved: string[] = [];

    for (let i = 1; i < texts.length; i++) {
      const prev = texts[i - 1]!;
      const cur = texts[i]!;
      const desired = snapGap(bbox(prev.o).bottom + canonical);
      const beforeTop = Number(cur.o.top ?? 0);
      if (Math.abs(beforeTop - desired) > 0.01) {
        cur.o.top = desired;
        moved.push(cur.id);
      }
    }

    if (Math.abs(Number(first.o.top ?? 0) - firstTop) > 0.01) {
      first.o.top = firstTop;
    }
    for (let i = 0; i < texts.length; i++) {
      texts[i]!.o.left = leftsBefore[i]!;
    }
    if (g.headingRect && markerTop != null) {
      g.headingRect.o.top = markerTop;
      if (markerLeft != null) g.headingRect.o.left = markerLeft;
    }
    if (g.headingText && headingTop != null) {
      g.headingText.o.top = headingTop;
      if (headingLeft != null) g.headingText.o.left = headingLeft;
    }

    const afterGaps = contentWhitespaces(texts);
    if (afterGaps.some((gap) => gap < -1e-9)) {
      // Prefer deterministic restack over fail-closed when effective bottoms
      // still collide after equality (e.g. under-height wrap).
      restackOrderedBodyTextsClearEffectiveOverlap(
        g,
        report,
        "post-internal-rhythm",
      );
      const repaired = contentWhitespaces(sectionBodyContentTexts(g));
      if (repaired.some((gap) => gap < -1e-9)) {
        report.ok = false;
        report.error =
          report.error ??
          `internal-content rhythm produced overlap in ${name}`;
        report.warnings.push(
          `fail closed: internal-content rhythm overlap in ${name} gaps=${repaired.join("/")}`,
        );
      }
    }

    const finalGaps = contentWhitespaces(sectionBodyContentTexts(g));
    report.internal_content_rhythm_actions.push({
      section: name,
      lane_id: g.lane_id,
      canonical_gap: canonical,
      canonical_source: source,
      before_gaps: beforeGaps,
      after_gaps: finalGaps,
      first_content_id: first.id,
      moved_object_ids: moved,
      heading_id: g.headingText?.id ?? null,
      marker_id: g.headingRect?.id ?? null,
    });
    report.collision_resolutions.push(
      `internal-content rhythm: ${name} whitespace ${beforeGaps.join("/")}→${finalGaps.join("/")} canonical=${canonical} source=${source}`,
    );
  }
}

function founderNamedSectionCohort(
  requestedChanges: string[],
  groups: SectionGroup[],
): { sections: string[]; founder_item: string | null; skip_reason: string | null } {
  const detected = groups
    .map((g) => g.section)
    .filter((s) => s !== "header");
  for (const raw of requestedChanges) {
    if (!isFounderHeadingToContentEqualityRequest(raw)) continue;
    const n = raw
      .replace(/^\*+\s*/, "")
      .replace(/^\d+\.\s*/, "")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
    const named = detected.filter((s) => new RegExp(`\\b${escapeRegExp(s)}\\b`).test(n));
    if (named.length >= 2) {
      return { sections: named, founder_item: raw, skip_reason: null };
    }
    const allEach =
      /\b(each|all|every|both|four)\b/.test(n) &&
      /\b(sections?|section\s+system)\b/.test(n);
    if (allEach && detected.length >= 2) {
      return { sections: detected, founder_item: raw, skip_reason: null };
    }
    return {
      sections: [],
      founder_item: raw,
      skip_reason:
        "heading-to-content equality requested but named/all-section cohort could not be resolved",
    };
  }
  return { sections: [], founder_item: null, skip_reason: null };
}

function canonicalHeadingContentGap(gaps: number[]): number {
  const legal = gaps
    .map(snapGap)
    .filter((g) => g + 1e-9 >= MIN_HEADING_BODY_GAP_PX);
  if (legal.length === 0) return MIN_HEADING_BODY_GAP_PX;

  const counts = new Map<number, number>();
  for (const g of legal) {
    counts.set(g, (counts.get(g) ?? 0) + 1);
  }
  let bestCount = 0;
  const winners: number[] = [];
  for (const [g, c] of counts) {
    if (c > bestCount) {
      bestCount = c;
      winners.length = 0;
      winners.push(g);
    } else if (c === bestCount) {
      winners.push(g);
    }
  }
  if (winners.length === 1 && bestCount >= 2) {
    return Math.max(winners[0]!, MIN_HEADING_BODY_GAP_PX);
  }
  // Tied modes, or every value unique: prefer the documented minimum when present.
  if (legal.some((g) => Math.abs(g - MIN_HEADING_BODY_GAP_PX) <= 1e-9)) {
    return MIN_HEADING_BODY_GAP_PX;
  }
  const sorted = [...legal].sort((a, b) => a - b);
  const mid = (sorted.length - 1) / 2;
  const median = Number.isInteger(mid)
    ? sorted[mid]!
    : snapGap((sorted[Math.floor(mid)]! + sorted[Math.ceil(mid)]!) / 2);
  return Math.max(median, MIN_HEADING_BODY_GAP_PX);
}

/**
 * Founder-gated: equalize heading→content gaps across one same-lane named
 * section system. Body-only (heading + marker preserved). Fail-closed skip
 * when the cohort is unresolvable, split across lanes, or unmeasurable.
 *
 * When a body shrinks, subsequent same-lane sections shift by the same delta
 * so existing legal section-to-section gaps are preserved. Stack enforcement
 * still runs afterward for the min-gap floor.
 */
function enforceFounderSectionSystemHeadingContentRhythm(
  groups: SectionGroup[],
  lanes: LayoutLane[],
  requestedChanges: string[],
  report: LayoutNormalizationReport,
): void {
  if (!requestedChanges.length) return;

  const resolved = founderNamedSectionCohort(requestedChanges, groups);
  if (resolved.skip_reason) {
    report.warnings.push(resolved.skip_reason);
    return;
  }
  if (resolved.sections.length < 2) return;

  const bySection = new Map(groups.map((g) => [g.section, g]));
  const cohort: SectionGroup[] = [];
  for (const name of resolved.sections) {
    const g = bySection.get(name);
    if (!g) {
      report.warnings.push(
        `section-system heading→content equality skipped: section ${name} not detected`,
      );
      return;
    }
    if (headingBottomOf(g) == null || firstBodyTopOf(g) == null) {
      report.warnings.push(
        `section-system heading→content equality skipped: ${name} heading/body unevaluable`,
      );
      return;
    }
    cohort.push(g);
  }

  const laneIds = new Set(cohort.map((g) => g.lane_id));
  if (laneIds.size !== 1 || [...laneIds][0] == null) {
    report.warnings.push(
      "section-system heading→content equality skipped: requested cohort is not a single measurable lane",
    );
    return;
  }
  const laneId = [...laneIds][0]!;
  const lane = lanes.find((l) => l.lane_id === laneId);
  if (!lane) {
    report.warnings.push(
      `section-system heading→content equality skipped: lane ${laneId} missing`,
    );
    return;
  }

  const gaps = cohort.map((g) => {
    const hb = headingBottomOf(g)!;
    const bt = firstBodyTopOf(g)!;
    return snapGap(bt - hb);
  });
  const canonical = canonicalHeadingContentGap(gaps);
  const orderedLane = sortLaneGroupsByTop(lane);
  const cohortSet = new Set(resolved.sections);

  for (const g of orderedLane) {
    if (!cohortSet.has(g.section)) continue;
    const hb = headingBottomOf(g);
    const bt = firstBodyTopOf(g);
    if (hb == null || bt == null) continue;
    const beforeGap = snapGap(bt - hb);
    const delta = snapGap(canonical - beforeGap);
    if (Math.abs(delta) <= GAP_RELATION_NOISE_PX) continue;

    const moved = shiftSectionBody(g, delta);
    const afterBt = firstBodyTopOf(g) ?? bt + delta;
    const afterGap = snapGap(afterBt - hb);
    report.section_system_rhythm_actions.push({
      section: g.section,
      lane_id: laneId,
      before_gap: beforeGap,
      after_gap: afterGap,
      canonical_gap: canonical,
      delta_top: delta,
      object_ids: [...new Set(moved)],
    });
    report.collision_resolutions.push(
      `section-system heading→content equality (${laneId}): ${g.section} ${beforeGap}→${afterGap} (canonical=${canonical})`,
    );

    // Body compact/expand must not leave effective ordered-child overlaps.
    restackOrderedBodyTextsClearEffectiveOverlap(
      g,
      report,
      "post-heading-content-equality",
    );

    // Body shrink raises the section bottom. Shift later same-lane sections by
    // the same delta so a previously legal ≥min section gap is not inflated
    // (and so a Founder-consistent 12/12/12 rhythm is preserved).
    if (delta < -GAP_RELATION_NOISE_PX) {
      const gIndex = orderedLane.findIndex((x) => x.section === g.section);
      for (let j = gIndex + 1; j < orderedLane.length; j++) {
        const down = orderedLane[j]!;
        const downMoved = shiftSection(down, delta);
        report.shifts_applied.push({
          section: down.section,
          lane_id: laneId,
          delta_top: delta,
          object_ids: downMoved,
          reason: `section-system heading→content equality: downstream restack after ${g.section} body compact (${laneId})`,
        });
      }
    }
  }

  if (report.section_system_rhythm_actions.length > 0) {
    report.collision_resolutions.push(
      `section-system heading→content equality: founder_item applied canonical_gap=${canonical}px cohort=[${resolved.sections.join(",")}] ${laneId}`,
    );
  }
}

function founderNamedSectionGapCohort(
  requestedChanges: string[],
  groups: SectionGroup[],
): { sections: string[]; founder_item: string | null; skip_reason: string | null } {
  const detected = groups
    .map((g) => g.section)
    .filter((s) => s !== "header");
  for (const raw of requestedChanges) {
    if (!isFounderSectionToSectionGapEqualityRequest(raw)) continue;
    const n = raw
      .replace(/^\*+\s*/, "")
      .replace(/^\d+\.\s*/, "")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
    const named = detected.filter((s) => new RegExp(`\\b${escapeRegExp(s)}\\b`).test(n));
    if (named.length >= 2) {
      return { sections: named, founder_item: raw, skip_reason: null };
    }
    const allEach =
      /\b(each|all|every|both|four)\b/.test(n) &&
      /\b(sections?|section\s+system)\b/.test(n);
    if (allEach && detected.length >= 2) {
      return { sections: detected, founder_item: raw, skip_reason: null };
    }
    return {
      sections: [],
      founder_item: raw,
      skip_reason:
        "section-to-section gap equality requested but named/all-section cohort could not be resolved",
    };
  }
  return { sections: [], founder_item: null, skip_reason: null };
}

function canonicalSectionGap(gaps: number[]): number {
  const legal = gaps
    .map(snapGap)
    .filter((g) => g + 1e-9 >= MIN_SECTION_GAP_PX);
  if (legal.length === 0) return MIN_SECTION_GAP_PX;
  const counts = new Map<number, number>();
  for (const g of legal) {
    counts.set(g, (counts.get(g) ?? 0) + 1);
  }
  let bestCount = 0;
  const winners: number[] = [];
  for (const [g, c] of counts) {
    if (c > bestCount) {
      bestCount = c;
      winners.length = 0;
      winners.push(g);
    } else if (c === bestCount) {
      winners.push(g);
    }
  }
  if (winners.includes(MIN_SECTION_GAP_PX)) return MIN_SECTION_GAP_PX;
  winners.sort((a, b) => a - b);
  return winners[0]!;
}

/**
 * Founder-gated: equalize section→next-section gaps across one same-lane named
 * cohort. Whole-section shifts only. Does not change MIN_SECTION_GAP_PX.
 * Fail-closed skip when the cohort is unresolvable or split across lanes.
 */
function enforceFounderSectionSystemSectionGapRhythm(
  groups: SectionGroup[],
  lanes: LayoutLane[],
  requestedChanges: string[],
  report: LayoutNormalizationReport,
): void {
  if (!requestedChanges.length) return;
  const resolved = founderNamedSectionGapCohort(requestedChanges, groups);
  if (resolved.skip_reason) {
    report.warnings.push(resolved.skip_reason);
    return;
  }
  if (resolved.sections.length < 2) return;

  const bySection = new Map(groups.map((g) => [g.section, g]));
  const cohort: SectionGroup[] = [];
  for (const name of resolved.sections) {
    const g = bySection.get(name);
    if (!g) {
      report.warnings.push(
        `section-system section-gap equality skipped: section ${name} not detected`,
      );
      return;
    }
    cohort.push(g);
  }
  const laneIds = new Set(cohort.map((g) => g.lane_id));
  if (laneIds.size !== 1 || [...laneIds][0] == null) {
    report.warnings.push(
      "section-system section-gap equality skipped: requested cohort is not a single measurable lane",
    );
    return;
  }
  const laneId = [...laneIds][0]!;
  const lane = lanes.find((l) => l.lane_id === laneId);
  if (!lane) return;

  const cohortSet = new Set(resolved.sections);
  const orderedLane = sortLaneGroupsByTop(lane);
  const orderedCohort = orderedLane.filter((g) => cohortSet.has(g.section));
  if (orderedCohort.length < 2) return;

  const gaps: number[] = [];
  for (let i = 1; i < orderedCohort.length; i++) {
    const prev = sectionBounds(orderedCohort[i - 1]!);
    const cur = sectionBounds(orderedCohort[i]!);
    gaps.push(snapGap(cur.top - prev.bottom));
  }
  const canonical = canonicalSectionGap(gaps);

  for (let i = 1; i < orderedCohort.length; i++) {
    const prev = orderedCohort[i - 1]!;
    const cur = orderedCohort[i]!;
    const prevB = sectionBounds(prev);
    const curB = sectionBounds(cur);
    const beforeGap = snapGap(curB.top - prevB.bottom);
    const delta = snapGap(canonical - beforeGap);
    if (Math.abs(delta) <= GAP_RELATION_NOISE_PX) continue;
    const gIndex = orderedLane.findIndex((x) => x.section === cur.section);
    const movedNow = shiftSection(cur, delta);
    const allMoved = [...movedNow];
    report.shifts_applied.push({
      section: cur.section,
      lane_id: laneId,
      delta_top: delta,
      object_ids: movedNow,
      reason: `section-system section-gap equality: ${prev.section}→${cur.section} ${beforeGap}→${canonical} (${laneId})`,
    });
    for (let j = gIndex + 1; j < orderedLane.length; j++) {
      const down = orderedLane[j]!;
      const downMoved = shiftSection(down, delta);
      allMoved.push(...downMoved);
      report.shifts_applied.push({
        section: down.section,
        lane_id: laneId,
        delta_top: delta,
        object_ids: downMoved,
        reason: `section-system section-gap equality: downstream restack after ${cur.section} (${laneId})`,
      });
    }
    report.section_gap_rhythm_actions.push({
      section: cur.section,
      lane_id: laneId,
      before_gap: beforeGap,
      after_gap: snapGap(sectionBounds(cur).top - sectionBounds(prev).bottom),
      canonical_gap: canonical,
      delta_top: delta,
      object_ids: [...new Set(allMoved)],
    });
    report.collision_resolutions.push(
      `section-system section-gap equality (${laneId}): ${prev.section}→${cur.section} ${beforeGap}→${canonical} (canonical=${canonical})`,
    );
  }
}

/**
 * Normalize layout after OpenAI canvas operations.
 * Returns a new canvas; input is never mutated.
 *
 * `requested_changes` is optional. When omitted, behavior is identical to the
 * pre-rhythm normalizer (minimum heading-body floor + stack + page-fit only).
 *
 * `prior_canvas` is optional and read-only. When Founder requests internal
 * content-line rhythm and the prior same-section whitespace was valid,
 * collision-free, and consistent, that proven relationship is restored
 * instead of inventing a new gap.
 */
export function normalizeRevisionLayout(input: {
  canvas: FabricCanvasDoc;
  requested_changes?: string[];
  prior_canvas?: FabricCanvasDoc;
}): { canvas: FabricCanvasDoc; report: LayoutNormalizationReport } {
  const canvas = deepCloneCanvas(input.canvas);
  const objects = (canvas.objects ?? []) as FabricObj[];
  const pageH = Number(canvas.height ?? 0);
  const pageW = Number(canvas.width ?? 0);

  const report: LayoutNormalizationReport = {
    schema_version: "founder-revision-layout-normalization-1.4.0",
    at: new Date().toISOString(),
    ok: true,
    canvas_source:
      "after_openai_operations_deterministic_layout_and_gap_compaction",
    constants: {
      min_section_gap_px: MIN_SECTION_GAP_PX,
      min_heading_body_gap_px: MIN_HEADING_BODY_GAP_PX,
      content_grid_left_tolerance_px: CONTENT_GRID_LEFT_TOLERANCE_PX,
      lane_horizontal_overlap_px: LANE_HORIZONTAL_OVERLAP_PX,
      lane_anchor_join_px: LANE_ANCHOR_JOIN_PX,
    },
    sections_detected: [],
    section_order: [],
    lanes: [],
    before_bounds: [],
    after_bounds: [],
    shifts_applied: [],
    heading_body_gap_repairs: [],
    heading_style_changes: [],
    content_grid_changes: [],
    compaction_actions: [],
    section_system_rhythm_actions: [],
    section_gap_rhythm_actions: [],
    internal_content_rhythm_actions: [],
    page_fit: null,
    collision_resolutions: [],
    page_overflow: false,
    page_overflow_bottom: null,
    page_height: pageH > 0 ? pageH : null,
    warnings: [],
    error: null,
  };

  if (!(pageW > 0) || !(pageH > 0)) {
    report.ok = false;
    report.error = "Canvas width/height missing or non-positive";
    return { canvas, report };
  }

  const { groups, warnings } = buildSectionGroups(objects);
  report.warnings.push(...warnings);
  report.sections_detected = groups.map((g) => g.section);

  const lanes = detectLayoutLanes(groups);
  report.lanes = lanesReport(lanes);
  report.section_order = [
    ...(groups.some((g) => g.section === "header") ? ["header"] : []),
    ...lanes.flatMap((l) => l.section_order),
  ];
  // Refresh section_order from live lane sort after mutations later.
  report.before_bounds = groups.map(sectionBounds);

  if (groups.filter((g) => g.section !== "header").length === 0) {
    report.warnings.push(
      "no stackable sections with data.section metadata; layout normalization skipped",
    );
    report.after_bounds = report.before_bounds;
    return { canvas, report };
  }

  if (lanes.length >= 2) {
    report.collision_resolutions.push(
      `detected ${lanes.length} body layout lanes from geometry (lane-aware normalization)`,
    );
  }

  // 1) Heading style normalization within visual system
  normalizeHeadingStyles(groups, lanes, report);

  // 2) Heading → body gaps within each section
  enforceHeadingBodyGaps(groups, report);

  // 3) Lane-local vertical stacks
  for (let pass = 0; pass < 4; pass++) {
    const before = report.shifts_applied.length;
    enforceSectionStack(lanes, report);
    enforceHeadingBodyGaps(groups, report);
    if (report.shifts_applied.length === before) break;
  }

  // 3b) Header clearance (lane-aware)
  enforceHeaderContactToSummaryGap(groups, lanes, report);

  // 4) Lane-local content grids
  normalizeContentGrid(lanes, report);

  // Final stack / clearance passes
  enforceSectionStack(lanes, report);
  enforceHeaderContactToSummaryGap(groups, lanes, report);

  // 4b) Founder-gated heading→content equality across a named same-lane
  // section system. Insertion is AFTER the heading-body minimum-gap floor
  // (steps 2–3) and AFTER content-grid / stack, so equality measures
  // post-floor gaps. Body-only. Stack is re-run immediately after so
  // section-to-section ≥ MIN_SECTION_GAP_PX. Page-fit (step 5) remains
  // the authoritative overflow / excess-gap compaction pass.
  enforceFounderSectionSystemHeadingContentRhythm(
    groups,
    lanes,
    input.requested_changes ?? [],
    report,
  );
  enforceSectionStack(lanes, report);
  enforceHeaderContactToSummaryGap(groups, lanes, report);

  // 4c) Founder-gated internal body-text whitespace equality.
  // Insertion is AFTER heading→content equality so the first content object
  // is already at the heading floor / canonical heading gap and this pass
  // can keep that anchor, heading, and marker unchanged. Stack is re-run
  // immediately after because equalizing lines may grow or shrink the
  // section. Section-gap equality (4d) then restores Founder-requested
  // section→next rhythm on the post-reflow bottoms.
  enforceFounderInternalContentRhythm(
    groups,
    input.requested_changes ?? [],
    report,
    input.prior_canvas ?? null,
  );
  enforceSectionStack(lanes, report);
  enforceHeaderContactToSummaryGap(groups, lanes, report);

  enforceFounderSectionSystemSectionGapRhythm(
    groups,
    lanes,
    input.requested_changes ?? [],
    report,
  );
  enforceSectionStack(lanes, report);
  enforceHeaderContactToSummaryGap(groups, lanes, report);

  // 5) Lane-aware page-fit compaction
  const headerGroup = groups.find((g) => g.section === "header") ?? null;
  compactExcessGapsForPageFit(headerGroup, lanes, objects, pageH, report);

  report.lanes = lanesReport(lanes);
  report.section_order = [
    ...(groups.some((g) => g.section === "header") ? ["header"] : []),
    ...lanes.flatMap((l) => sortLaneGroupsByTop(l).map((g) => g.section)),
  ];
  report.after_bounds = groups.map(sectionBounds);

  const maxBottom = contentMaxBottom(objects);
  report.page_overflow_bottom = maxBottom;
  if (maxBottom > pageH + 0.5) {
    report.page_overflow = true;
    report.ok = false;
    report.error = `Deterministic reflow exceeds page bounds: content_bottom=${maxBottom.toFixed(1)} page_height=${pageH}`;
    report.warnings.push(
      "fail closed: would not silently shrink text or arbitrarily compress layout",
    );
  }

  for (let i = 0; i < objects.length; i++) {
    const o = objects[i]!;
    if (isSystemBg(o)) continue;
    const b = bbox(o);
    if (
      b.left < -0.5 ||
      b.top < -0.5 ||
      b.right > pageW + 0.5 ||
      b.bottom > pageH + 0.5
    ) {
      report.page_overflow = true;
      report.ok = false;
      if (!report.error) {
        report.error = `Object ${objectId(o, i)} outside page bounds after normalization`;
      }
      break;
    }
  }

  return { canvas, report };
}
