/**
 * Deterministic post-mutation acceptance checks for VERIFICATION_ACCEPTANCE
 * Founder requested changes. No LLM. Fail closed when unevaluable.
 *
 * Geometry rules intentionally reuse SpacingCritic / LayoutCritic semantics
 * where safe (page clipping ±0.5px; same-column text overlap gap < -1 with
 * horizontal overlap ≥ 20px).
 */
import type { FabricCanvasDoc } from "./CanvasInventory.js";
import { buildCanvasInventory } from "./CanvasInventory.js";
import {
  classifyRequestedChange,
  verificationCheckTypes,
  type RequestedChangeClass,
  type VerificationCheckType,
} from "./RequestedChangeClassification.js";
import {
  detectLayoutLanesFromCanvas,
  MIN_SECTION_GAP_PX,
  type PageFitReport,
} from "./RevisionLayoutNormalizer.js";
import type { CanvasInventoryObject } from "./revision-task-types.js";
import type { RevisionPlan } from "./revision-task-types.js";
import { contentObjects } from "../resume-critic/canvasHelpers.js";
import type { CanvasDocument, CanvasObject } from "../resume-critic/types.js";
import {
  effectiveObjectBBox,
  isFabricTextObject,
} from "./TextEffectiveHeight.js";

/**
 * Text objects for acceptance checks. Fabric canvases commonly use
 * lowercase "textbox"; ResumeCritic textObjects() is strict "Textbox".
 * Geometry rules below still follow SpacingCritic overlap semantics.
 */
function acceptanceTextObjects(canvas: CanvasDocument): CanvasObject[] {
  return canvas.objects.filter((o) => {
    const t = String(o.type ?? "").toLowerCase();
    return t === "textbox" || t === "text" || t === "i-text";
  });
}

/** Left-edge / padding tolerance for repeated heading components (px). */
export const VISUAL_LEFT_TOLERANCE_PX = 2;
/** Height tolerance for heading rectangles (px). Variable width is allowed. */
export const VISUAL_HEIGHT_TOLERANCE_PX = 1;
/** Vertical padding (text.top − rect.top) tolerance (px). */
export const VISUAL_PADDING_TOLERANCE_PX = 2;
/** Font size equality tolerance (pt). */
export const VISUAL_FONT_SIZE_TOLERANCE = 0.5;

const SECTION_HEADING_LABELS = [
  "SUMMARY",
  "EXPERIENCE",
  "EDUCATION",
  "SKILLS",
  "CERTIFICATIONS",
  "LANGUAGES",
] as const;

export type AcceptanceFinding = {
  code: string;
  message: string;
  object_ids: string[];
  metrics?: Record<string, unknown>;
};

export type AcceptanceCheckResult = {
  check_id: string;
  check_type: VerificationCheckType;
  requested_change: string;
  classification: RequestedChangeClass;
  pass: boolean;
  evaluable: boolean;
  findings: AcceptanceFinding[];
  object_ids: string[];
  metrics: Record<string, unknown>;
  reason: string;
};

export type RevisionAcceptanceReport = {
  schema_version: "founder-revision-acceptance-1.0.0";
  task_id: string | null;
  revision_id: string | null;
  decision_id: string | null;
  at: string;
  canvas_source: "post_mutation";
  checks: AcceptanceCheckResult[];
  all_verification_pass: boolean;
};

function asCanvasDoc(canvas: FabricCanvasDoc): CanvasDocument {
  return {
    version: String(canvas.version ?? "5.3.0"),
    width: Number(canvas.width ?? 0),
    height: Number(canvas.height ?? 0),
    objects: (canvas.objects ?? []) as CanvasObject[],
  };
}

function objectId(o: CanvasObject, index: number): string {
  if (typeof o.id === "string" && o.id.trim()) return o.id;
  const data = o.data;
  if (data && typeof data.id === "string" && data.id.trim()) return data.id;
  return `obj-${index}`;
}

/**
 * Geometry for acceptance. Text objects use wrap-aware effective height so
 * undersized stored Fabric `height` cannot hide rendered wrap overlap.
 */
function bbox(o: CanvasObject): {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
} {
  if (isFabricTextObject(o)) {
    return effectiveObjectBBox(o);
  }
  const left = Number(o.left ?? 0);
  const top = Number(o.top ?? 0);
  const width = Number(o.width ?? 0) * Number(o.scaleX ?? 1);
  const height = Number(o.height ?? 0) * Number(o.scaleY ?? 1);
  return { left, top, right: left + width, bottom: top + height, width, height };
}

function boxesOverlap(
  a: ReturnType<typeof bbox>,
  b: ReturnType<typeof bbox>,
  minOverlapPx = 1,
): boolean {
  const ox = Math.min(a.right, b.right) - Math.max(a.left, b.left);
  const oy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
  return ox >= minOverlapPx && oy >= minOverlapPx;
}

function normalizeColor(v: unknown): string {
  return String(v ?? "")
    .trim()
    .toLowerCase();
}

function normalizeFontWeight(v: unknown): string {
  const s = String(v ?? "")
    .trim()
    .toLowerCase();
  if (s === "bold" || s === "700") return "700";
  if (s === "normal" || s === "400" || s === "") return "400";
  return s;
}

function headingLabelFromText(text: string | undefined): string | null {
  if (!text) return null;
  const t = text.trim().toUpperCase();
  for (const label of SECTION_HEADING_LABELS) {
    if (t === label || t.startsWith(`${label} `) || t.startsWith(`${label}\n`)) {
      return label;
    }
    // Allow numbered prefixes like "01 SUMMARY"
    if (new RegExp(`^(0?\\d\\s+)?${label}\\b`).test(t)) return label;
  }
  return null;
}

type HeadingComponent = {
  label: string;
  section: string | null;
  textId: string;
  text: CanvasObject;
  rectId: string | null;
  rect: CanvasObject | null;
};

/** Max height (px) for a plausible section-heading decoration rectangle. */
const HEADING_MARKER_MAX_HEIGHT_PX = 64;
/** Min height (px) for a plausible section-heading decoration rectangle. */
const HEADING_MARKER_MIN_HEIGHT_PX = 8;

/**
 * Structural page/sidebar/column backgrounds must never pair as heading rects.
 * Generic — not ID-hardcoded to page-sidebar-bg.
 */
export function isStructuralBackgroundRect(o: CanvasObject): boolean {
  if (o.system === true) return true;
  const data =
    o.data && typeof o.data === "object" && !Array.isArray(o.data)
      ? (o.data as Record<string, unknown>)
      : null;
  if (data?.system === true) return true;
  const id = String(o.id ?? data?.id ?? "").toLowerCase();
  const role = String(data?.role ?? (o as { role?: unknown }).role ?? "")
    .toLowerCase()
    .trim();
  if (
    id === "page-root" ||
    /page-?bg|page[-_]?background|background/.test(id) ||
    /sidebar[-_]?bg|sidebar[-_]?background|column[-_]?bg|column[-_]?background/.test(
      id,
    ) ||
    /[-_]container$|^container[-_]/.test(id)
  ) {
    return true;
  }
  if (
    role === "pagebackground" ||
    role === "page-background" ||
    role === "background" ||
    role === "sidebar" ||
    role === "sidebar-background" ||
    role === "sidebar_bg" ||
    role === "column-background" ||
    role === "container" ||
    role === "page"
  ) {
    return true;
  }
  const rb = bbox(o);
  // Full-column / page bands are far taller than heading markers (~10–48px).
  if (rb.height >= 200) return true;
  if (rb.height > 80 && rb.width >= 150) return true;
  return false;
}

function headingMarkerRoleBonus(o: CanvasObject): number {
  const role = String(
    (o.data as { role?: unknown } | undefined)?.role ??
      (o as { role?: unknown }).role ??
      "",
  )
    .toLowerCase()
    .trim();
  if (
    role === "section-heading" ||
    role === "section-marker" ||
    role === "heading-decoration" ||
    role === "heading-rect" ||
    role === "sectionheading"
  ) {
    return -40;
  }
  return 0;
}

function isPlausibleHeadingMarkerRect(rb: ReturnType<typeof bbox>): boolean {
  return (
    rb.height >= HEADING_MARKER_MIN_HEIGHT_PX &&
    rb.height <= HEADING_MARKER_MAX_HEIGHT_PX
  );
}

function findHeadingComponents(canvas: CanvasDocument): HeadingComponent[] {
  const texts = acceptanceTextObjects(canvas);
  const rects = contentObjects(canvas).filter((o) => {
    if (
      !String(o.type ?? "")
        .toLowerCase()
        .includes("rect")
    ) {
      return false;
    }
    // Never consider page/sidebar/column structural backgrounds as heading rects.
    if (isStructuralBackgroundRect(o)) return false;
    return true;
  });
  const out: HeadingComponent[] = [];
  const seenLabels = new Set<string>();

  for (let i = 0; i < texts.length; i++) {
    const t = texts[i]!;
    const label = headingLabelFromText(
      typeof t.text === "string" ? t.text : undefined,
    );
    if (!label || seenLabels.has(label)) continue;
    seenLabels.add(label);
    const tb = bbox(t);
    const sectionRaw = String(t.data?.section ?? "").toLowerCase().trim();
    const section = sectionRaw || null;
    // Prefer a rect that overlaps the heading text or sits immediately behind it.
    // Require marker-like dimensions; prefer same-section / heading roles.
    let best: CanvasObject | null = null;
    let bestScore = Number.POSITIVE_INFINITY;
    for (const r of rects) {
      const rb = bbox(r);
      if (!isPlausibleHeadingMarkerRect(rb)) continue;
      const sameSection =
        section && String(r.data?.section ?? "").toLowerCase() === section;
      const overlaps = boxesOverlap(tb, rb, 1);
      const nearBehind =
        Math.abs(rb.left - tb.left) <= 24 &&
        rb.top <= tb.top + 4 &&
        rb.bottom >= tb.top;
      if (!overlaps && !nearBehind && !sameSection) continue;
      if (!overlaps && !nearBehind) continue;
      const score =
        Math.abs(rb.top - tb.top) +
        Math.abs(rb.left - tb.left) * 0.25 +
        headingMarkerRoleBonus(r) +
        (sameSection ? -20 : 0);
      if (score < bestScore) {
        bestScore = score;
        best = r;
      }
    }
    const textIndex = canvas.objects.indexOf(t);
    const rectIndex = best ? canvas.objects.indexOf(best) : -1;
    out.push({
      label,
      section,
      textId: objectId(t, textIndex >= 0 ? textIndex : i),
      text: t,
      rectId: best ? objectId(best, rectIndex >= 0 ? rectIndex : 0) : null,
      rect: best,
    });
  }
  return out;
}

function compareHeadingsWithinLane(
  laneId: string,
  cohort: HeadingComponent[],
): AcceptanceFinding[] {
  if (cohort.length < 2) return [];
  const findings: AcceptanceFinding[] = [];
  const ref = cohort[0]!;
  const refLeft = Number(ref.text.left ?? 0);
  const refFontSize = Number(ref.text.fontSize ?? 0);
  const refFontFamily = String(ref.text.fontFamily ?? "").toLowerCase();
  const refFontWeight = normalizeFontWeight(ref.text.fontWeight);
  const refTextFill = normalizeColor(ref.text.fill);
  const refRectFill = ref.rect ? normalizeColor(ref.rect.fill) : null;
  const refRectHeight = ref.rect ? bbox(ref.rect).height : null;
  const refPadding =
    ref.rect != null
      ? Number(ref.text.top ?? 0) - Number(ref.rect.top ?? 0)
      : null;

  const laneMetrics = {
    lane_id: laneId,
    reference_section: ref.section,
    reference_label: ref.label,
  };

  for (const h of cohort.slice(1)) {
    const compared = {
      ...laneMetrics,
      compared_section: h.section,
      compared_label: h.label,
    };
    const left = Number(h.text.left ?? 0);
    if (Math.abs(left - refLeft) > VISUAL_LEFT_TOLERANCE_PX) {
      findings.push({
        code: "ACC_VISUAL_LEFT_MISMATCH",
        message: `Heading left mismatch ${h.label} vs ${ref.label} in ${laneId}: ${left} vs ${refLeft}`,
        object_ids: [h.textId, ref.textId],
        metrics: {
          ...compared,
          left,
          ref_left: refLeft,
          tolerance: VISUAL_LEFT_TOLERANCE_PX,
        },
      });
    }
    const fontSize = Number(h.text.fontSize ?? 0);
    if (Math.abs(fontSize - refFontSize) > VISUAL_FONT_SIZE_TOLERANCE) {
      findings.push({
        code: "ACC_VISUAL_FONT_SIZE_MISMATCH",
        message: `Heading fontSize mismatch ${h.label} vs ${ref.label} in ${laneId}`,
        object_ids: [h.textId, ref.textId],
        metrics: { ...compared, fontSize, refFontSize },
      });
    }
    const fontFamily = String(h.text.fontFamily ?? "").toLowerCase();
    if (fontFamily !== refFontFamily) {
      findings.push({
        code: "ACC_VISUAL_FONT_FAMILY_MISMATCH",
        message: `Heading fontFamily mismatch ${h.label} vs ${ref.label} in ${laneId}`,
        object_ids: [h.textId, ref.textId],
        metrics: { ...compared, fontFamily, refFontFamily },
      });
    }
    const fontWeight = normalizeFontWeight(h.text.fontWeight);
    if (fontWeight !== refFontWeight) {
      findings.push({
        code: "ACC_VISUAL_FONT_WEIGHT_MISMATCH",
        message: `Heading fontWeight mismatch ${h.label} vs ${ref.label} in ${laneId}`,
        object_ids: [h.textId, ref.textId],
        metrics: { ...compared, fontWeight, refFontWeight },
      });
    }
    const textFill = normalizeColor(h.text.fill);
    if (textFill !== refTextFill) {
      findings.push({
        code: "ACC_VISUAL_TEXT_COLOR_MISMATCH",
        message: `Heading text color mismatch ${h.label} vs ${ref.label} in ${laneId}`,
        object_ids: [h.textId, ref.textId],
        metrics: { ...compared, textFill, refTextFill },
      });
    }

    if (ref.rect && h.rect && refRectFill != null && refRectHeight != null) {
      const fill = normalizeColor(h.rect.fill);
      if (fill !== refRectFill) {
        findings.push({
          code: "ACC_VISUAL_RECT_FILL_MISMATCH",
          message: `Heading rect fill mismatch ${h.label} vs ${ref.label} in ${laneId}`,
          object_ids: [h.rectId!, ref.rectId!],
          metrics: { ...compared, fill, refRectFill },
        });
      }
      const height = bbox(h.rect).height;
      if (Math.abs(height - refRectHeight) > VISUAL_HEIGHT_TOLERANCE_PX) {
        findings.push({
          code: "ACC_VISUAL_RECT_HEIGHT_MISMATCH",
          message: `Heading rect height mismatch ${h.label} vs ${ref.label} in ${laneId}`,
          object_ids: [h.rectId!, ref.rectId!],
          metrics: {
            ...compared,
            height,
            refRectHeight,
            tolerance: VISUAL_HEIGHT_TOLERANCE_PX,
            note: "width equality not required (variable label widths allowed)",
          },
        });
      }
      const rectLeft = Number(h.rect.left ?? 0);
      const refRectLeft = Number(ref.rect.left ?? 0);
      if (Math.abs(rectLeft - refRectLeft) > VISUAL_LEFT_TOLERANCE_PX) {
        findings.push({
          code: "ACC_VISUAL_RECT_LEFT_MISMATCH",
          message: `Heading rect left mismatch ${h.label} vs ${ref.label} in ${laneId}`,
          object_ids: [h.rectId!, ref.rectId!],
          metrics: {
            ...compared,
            rectLeft,
            refRectLeft,
            tolerance: VISUAL_LEFT_TOLERANCE_PX,
          },
        });
      }
      if (refPadding != null) {
        const padding = Number(h.text.top ?? 0) - Number(h.rect.top ?? 0);
        if (Math.abs(padding - refPadding) > VISUAL_PADDING_TOLERANCE_PX) {
          findings.push({
            code: "ACC_VISUAL_PADDING_MISMATCH",
            message: `Heading text vertical padding mismatch ${h.label} vs ${ref.label} in ${laneId}`,
            object_ids: [h.textId, h.rectId!, ref.textId, ref.rectId!],
            metrics: {
              ...compared,
              padding,
              refPadding,
              tolerance: VISUAL_PADDING_TOLERANCE_PX,
            },
          });
        }
      }
    } else if (ref.rect && !h.rect) {
      findings.push({
        code: "ACC_VISUAL_RECT_MISSING",
        message: `Heading ${h.label} missing companion rectangle while ${ref.label} has one (${laneId})`,
        object_ids: [h.textId, ref.rectId!],
        metrics: { ...compared },
      });
    }
  }
  return findings;
}

/** LayoutCritic clipping semantics (±0.5px). */
export function findOutOfBoundsObjects(canvas: FabricCanvasDoc): AcceptanceFinding[] {
  const doc = asCanvasDoc(canvas);
  if (!(doc.width > 0) || !(doc.height > 0)) {
    return [
      {
        code: "ACC_BOUNDS_UNEVALUABLE",
        message: "Canvas width/height missing or non-positive",
        object_ids: [],
      },
    ];
  }
  const findings: AcceptanceFinding[] = [];
  const content = contentObjects(doc);
  for (let i = 0; i < content.length; i++) {
    const o = content[i]!;
    const b = bbox(o);
    const id = objectId(o, doc.objects.indexOf(o));
    if (
      b.bottom > doc.height + 0.5 ||
      b.right > doc.width + 0.5 ||
      b.left < -0.5 ||
      b.top < -0.5
    ) {
      findings.push({
        code: "ACC_OUT_OF_BOUNDS",
        message: `Object ${id} outside page bounds`,
        object_ids: [id],
        metrics: {
          left: b.left,
          top: b.top,
          right: b.right,
          bottom: b.bottom,
          page_width: doc.width,
          page_height: doc.height,
        },
      });
    }
  }
  return findings;
}

/**
 * SpacingCritic same-column overlap semantics (Phase 5W):
 * compare EVERY text pair with horizontal overlap ≥ 20px (not only
 * consecutive Y-neighbors). Interleaved other-column objects must not hide
 * same-column wrap collisions. Negative gap (< -1) is a collision.
 *
 * Prior bug: global Y-sort consecutive-only comparison skipped same-column
 * pairs when a right-column text sat between them in Y order (production
 * Certifications false-negative on revfb-d242f1).
 */
export function findTextOverlapFindings(canvas: FabricCanvasDoc): AcceptanceFinding[] {
  const doc = asCanvasDoc(canvas);
  const texts = acceptanceTextObjects(doc).sort(
    (a, b) => Number(a.top ?? 0) - Number(b.top ?? 0),
  );
  const findings: AcceptanceFinding[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < texts.length; i++) {
    const prev = texts[i]!;
    const prevBox = bbox(prev);
    const prevId = objectId(prev, doc.objects.indexOf(prev));
    for (let j = i + 1; j < texts.length; j++) {
      const cur = texts[j]!;
      const curBox = bbox(cur);
      const overlapX =
        Math.min(prevBox.right, curBox.right) -
        Math.max(prevBox.left, curBox.left);
      if (overlapX < 20) continue;
      // Only treat as vertical stack collision when cur is below-or-equal prev top.
      const gap = curBox.top - prevBox.bottom;
      if (gap < -1) {
        const curId = objectId(cur, doc.objects.indexOf(cur));
        const key = [prevId, curId].sort().join("|");
        if (seen.has(key)) continue;
        seen.add(key);
        findings.push({
          code: "ACC_TEXT_OVERLAP",
          message: `Overlapping text gap=${gap}`,
          object_ids: [prevId, curId],
          metrics: { gap, overlapX },
        });
      }
    }
  }
  return findings;
}

/**
 * Minimum positive gap (px) between sequential same-column text entries when
 * Founder asks for clear/positive spacing below effective rendered bottoms.
 */
export const MIN_SEQUENTIAL_RENDERED_TEXT_GAP_PX = 2;

/**
 * Pairwise same-column sequential gap findings using wrap-aware effective
 * bottoms. Detects "next entry begins before prior rendered bottom finishes"
 * even when global Y-neighbors are in another column.
 */
export function findSequentialRenderedTextGapFindings(
  canvas: FabricCanvasDoc,
  minGapPx: number = MIN_SEQUENTIAL_RENDERED_TEXT_GAP_PX,
): AcceptanceFinding[] {
  const doc = asCanvasDoc(canvas);
  const texts = acceptanceTextObjects(doc).sort(
    (a, b) => Number(a.top ?? 0) - Number(b.top ?? 0),
  );
  const findings: AcceptanceFinding[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < texts.length; i++) {
    const prev = texts[i]!;
    const prevBox = bbox(prev);
    const prevId = objectId(prev, doc.objects.indexOf(prev));
    for (let j = i + 1; j < texts.length; j++) {
      const cur = texts[j]!;
      const curBox = bbox(cur);
      const overlapX =
        Math.min(prevBox.right, curBox.right) -
        Math.max(prevBox.left, curBox.left);
      if (overlapX < 20) continue;
      const gap = curBox.top - prevBox.bottom;
      if (gap + 1e-9 < minGapPx) {
        const curId = objectId(cur, doc.objects.indexOf(cur));
        const key = [prevId, curId].sort().join("|");
        if (seen.has(key)) continue;
        seen.add(key);
        findings.push({
          code: "ACC_SEQUENTIAL_RENDERED_TEXT_GAP",
          message: `Sequential rendered-text gap=${gap} < min=${minGapPx}`,
          object_ids: [prevId, curId],
          metrics: { gap, min_gap_px: minGapPx, overlapX },
        });
      }
      // Only the immediate next same-column successor matters for sequential proof.
      break;
    }
  }
  return findings;
}

/** Heading rectangles must not obscure non-heading body text. */
export function findHeadingObscuringBodyFindings(
  canvas: FabricCanvasDoc,
): AcceptanceFinding[] {
  const doc = asCanvasDoc(canvas);
  const headings = findHeadingComponents(doc);
  const findings: AcceptanceFinding[] = [];
  const bodyTexts = acceptanceTextObjects(doc).filter((t) => {
    const label = headingLabelFromText(
      typeof t.text === "string" ? t.text : undefined,
    );
    return label == null;
  });

  for (const h of headings) {
    if (!h.rect) continue;
    const rb = bbox(h.rect);
    for (const body of bodyTexts) {
      const bb = bbox(body);
      if (!boxesOverlap(rb, bb, 2)) continue;
      const bodyId = objectId(body, doc.objects.indexOf(body));
      findings.push({
        code: "ACC_HEADING_OBSCURES_BODY",
        message: `Section heading rect ${h.rectId} obscures body text ${bodyId}`,
        object_ids: [h.rectId!, bodyId, h.textId],
        metrics: { section_label: h.label },
      });
    }
    // Heading text colliding with other body text (same SpacingCritic gap rule)
    const ht = bbox(h.text);
    for (const body of bodyTexts) {
      const bb = bbox(body);
      const overlapX =
        Math.min(ht.right, bb.right) - Math.max(ht.left, bb.left);
      if (overlapX < 20) continue;
      const gap =
        bb.top >= ht.top ? bb.top - ht.bottom : ht.top - bb.bottom;
      if (gap < -1) {
        const bodyId = objectId(body, doc.objects.indexOf(body));
        findings.push({
          code: "ACC_HEADING_TEXT_BODY_COLLISION",
          message: `Section heading text ${h.textId} collides with body ${bodyId}`,
          object_ids: [h.textId, bodyId],
          metrics: { gap, section_label: h.label },
        });
      }
    }
  }
  return findings;
}

export function runCollisionBoundsCheck(
  canvas: FabricCanvasDoc,
  requestedChange: string,
): AcceptanceCheckResult {
  const findings: AcceptanceFinding[] = [];
  const oob = findOutOfBoundsObjects(canvas);
  const unevaluable = oob.some((f) => f.code === "ACC_BOUNDS_UNEVALUABLE");
  findings.push(...oob.filter((f) => f.code !== "ACC_BOUNDS_UNEVALUABLE"));
  if (unevaluable) {
    return {
      check_id: "collision_bounds",
      check_type: "COLLISION_BOUNDS",
      requested_change: requestedChange,
      classification: "VERIFICATION_ACCEPTANCE",
      pass: false,
      evaluable: false,
      findings: oob,
      object_ids: [],
      metrics: {},
      reason: "Canvas bounds unevaluable",
    };
  }
  findings.push(...findTextOverlapFindings(canvas));
  findings.push(...findHeadingObscuringBodyFindings(canvas));
  const ids = [...new Set(findings.flatMap((f) => f.object_ids))];
  const pass = findings.length === 0;
  return {
    check_id: "collision_bounds",
    check_type: "COLLISION_BOUNDS",
    requested_change: requestedChange,
    classification: "VERIFICATION_ACCEPTANCE",
    pass,
    evaluable: true,
    findings,
    object_ids: ids,
    metrics: {
      out_of_bounds: oob.length,
      text_overlaps: findings.filter((f) => f.code === "ACC_TEXT_OVERLAP")
        .length,
      heading_obscures: findings.filter(
        (f) =>
          f.code === "ACC_HEADING_OBSCURES_BODY" ||
          f.code === "ACC_HEADING_TEXT_BODY_COLLISION",
      ).length,
    },
    reason: pass
      ? "No out-of-bounds objects, text overlaps, or heading/body collisions"
      : `${findings.length} collision/bounds finding(s)`,
  };
}

export function runVisualConsistencyCheck(
  canvas: FabricCanvasDoc,
  requestedChange: string,
): AcceptanceCheckResult {
  const doc = asCanvasDoc(canvas);
  const headings = findHeadingComponents(doc);
  const objectIds = headings.flatMap((h) =>
    [h.textId, h.rectId].filter((x): x is string => Boolean(x)),
  );
  const laneDetection = detectLayoutLanesFromCanvas(canvas);
  const tolerances = {
    left_px: VISUAL_LEFT_TOLERANCE_PX,
    height_px: VISUAL_HEIGHT_TOLERANCE_PX,
    padding_px: VISUAL_PADDING_TOLERANCE_PX,
    font_size: VISUAL_FONT_SIZE_TOLERANCE,
    width: "not_required_equal",
  };

  if (headings.length < 2) {
    return {
      check_id: "visual_consistency",
      check_type: "VISUAL_CONSISTENCY",
      requested_change: requestedChange,
      classification: "VERIFICATION_ACCEPTANCE",
      pass: false,
      evaluable: false,
      findings: [
        {
          code: "ACC_VISUAL_UNEVALUABLE",
          message: `Need ≥2 represented section headings among ${SECTION_HEADING_LABELS.join(", ")}; found ${headings.length}`,
          object_ids: objectIds,
          metrics: { found_labels: headings.map((h) => h.label) },
        },
      ],
      object_ids: objectIds,
      metrics: {
        found_count: headings.length,
        lane_count: laneDetection.lane_count,
        tolerances,
      },
      reason: "Insufficient repeated heading components to evaluate consistency",
    };
  }

  // Lane-aware: compare repeated heading systems only within the same lane.
  // One-column templates resolve as a single lane and preserve prior behavior.
  const byLane = new Map<string, HeadingComponent[]>();
  for (const h of headings) {
    const laneId =
      (h.section && laneDetection.section_to_lane[h.section]) ||
      laneDetection.object_id_to_lane[h.textId] ||
      (h.rectId ? laneDetection.object_id_to_lane[h.rectId] : undefined) ||
      (laneDetection.lane_count <= 1 ? "lane-0" : "lane-unassigned");
    if (!byLane.has(laneId)) byLane.set(laneId, []);
    byLane.get(laneId)!.push(h);
  }

  const findings: AcceptanceFinding[] = [];
  const laneSummaries: Array<{
    lane_id: string;
    reference_label: string | null;
    compared_labels: string[];
    heading_count: number;
  }> = [];

  const laneIds = [...byLane.keys()].sort();
  for (const laneId of laneIds) {
    const cohort = byLane.get(laneId)!;
    laneSummaries.push({
      lane_id: laneId,
      reference_label: cohort[0]?.label ?? null,
      compared_labels: cohort.map((h) => h.label),
      heading_count: cohort.length,
    });
    findings.push(...compareHeadingsWithinLane(laneId, cohort));
  }

  const comparableLanes = laneSummaries.filter((l) => l.heading_count >= 2);
  const pass = findings.length === 0;
  return {
    check_id: "visual_consistency",
    check_type: "VISUAL_CONSISTENCY",
    requested_change: requestedChange,
    classification: "VERIFICATION_ACCEPTANCE",
    pass,
    evaluable: true,
    findings,
    object_ids: [...new Set(objectIds)],
    metrics: {
      compared_labels: headings.map((h) => h.label),
      reference_label:
        comparableLanes.length === 1
          ? comparableLanes[0]!.reference_label
          : null,
      lane_count: laneDetection.lane_count,
      lanes: laneSummaries,
      lane_references: comparableLanes.map((l) => ({
        lane_id: l.lane_id,
        reference_label: l.reference_label,
      })),
      inventory_ids_sampled: buildCanvasInventory(canvas)
        .filter((o) => objectIds.includes(o.id))
        .map((o) => o.id),
      tolerances,
    },
    reason: pass
      ? comparableLanes.length === 0
        ? `No within-lane heading cohorts (≥2) among ${headings.length} headings across ${laneDetection.lane_count || 1} lane(s); cross-lane left differences are not findings`
        : `Repeated heading components consistent within ${comparableLanes.length} lane(s) (${headings.length} sections)`
      : `${findings.length} visual-consistency finding(s)`,
  };
}

/** Canonical text for content-preservation comparison (whitespace / case). */
export function canonicalizeResumeText(text: string): string {
  return text
    .replace(/\u00a0/g, " ")
    .replace(/[\r\n\t]+/g, " ")
    .replace(/[ \u200b]+/g, " ")
    .trim()
    .toLowerCase();
}

function isTextLikeObject(o: Record<string, unknown>): boolean {
  const t = String(o.type ?? "").toLowerCase();
  return t === "textbox" || t === "text" || t === "i-text";
}

function isSystemishObject(o: Record<string, unknown>): boolean {
  if (o.system === true) return true;
  const data = o.data;
  if (data && typeof data === "object" && !Array.isArray(data)) {
    const d = data as Record<string, unknown>;
    if (d.system === true) return true;
    if (String(d.role ?? "") === "pageBackground") return true;
  }
  const id = String(o.id ?? "");
  return id === "page-root" || /page-?bg|background/i.test(id);
}

function objectTextId(o: Record<string, unknown>, index: number): string {
  if (typeof o.id === "string" && o.id.trim()) return o.id.trim();
  const data = o.data;
  if (data && typeof data === "object" && !Array.isArray(data)) {
    const id = (data as Record<string, unknown>).id;
    if (typeof id === "string" && id.trim()) return id.trim();
  }
  return `text-${index}`;
}

export type TextContentSnapshot = {
  id: string;
  raw: string;
  canonical: string;
};

export function collectTextContentSnapshots(
  canvas: FabricCanvasDoc,
): TextContentSnapshot[] {
  const out: TextContentSnapshot[] = [];
  const objects = (canvas.objects ?? []) as Record<string, unknown>[];
  objects.forEach((o, index) => {
    if (!isTextLikeObject(o) || isSystemishObject(o)) return;
    const raw = typeof o.text === "string" ? o.text : "";
    if (!raw.trim()) return;
    out.push({
      id: objectTextId(o, index),
      raw,
      canonical: canonicalizeResumeText(raw),
    });
  });
  return out;
}

function looksLikeContentEditFounderItem(normalizedItem: string): boolean {
  const n = normalizedItem;
  return (
    /\b(rewrit|reword|paraphras|shorten|clarify|improve wording)/.test(n) ||
    /\b(update|change|replace|revise)\b[\s\S]{0,40}\b(summary|bullet|job title|wording|copy|text|skills?)\b/.test(
      n,
    ) ||
    /\badd (a |an |the )?(missing |new )?(skill|certif|bullet|achievement|metric)/.test(
      n,
    )
  );
}

function authorizedContentEditTargetIds(
  plan: RevisionPlan | null | undefined,
  requestedChanges: string[],
): Set<string> {
  const allowed = new Set<string>();
  if (!plan) return allowed;
  const mutationContentItems = new Set(
    requestedChanges
      .filter((c) => {
        const cl = classifyRequestedChange(c);
        return (
          cl.classification === "MUTATION_REQUIRED" &&
          looksLikeContentEditFounderItem(c.toLowerCase())
        );
      })
      .map((c) => c),
  );
  for (const op of plan.operations) {
    if (op.op !== "update_text") continue;
    const attrs = [
      op.founder_feedback_item,
      ...(op.founder_feedback_items ?? []),
    ].filter((x): x is string => typeof x === "string" && x.trim().length > 0);
    const authorized = attrs.some((a) => mutationContentItems.has(a));
    if (!authorized) continue;
    if (op.target_id) allowed.add(op.target_id);
    for (const id of op.target_ids ?? []) allowed.add(id);
  }
  return allowed;
}

/**
 * Deterministic resume-content preservation check.
 * Geometry/style/reorder allowed; fabricated or unauthorized text edits fail.
 */
export function runContentPreservationCheck(input: {
  beforeCanvas: FabricCanvasDoc;
  afterCanvas: FabricCanvasDoc;
  requestedChange: string;
  plan?: RevisionPlan | null;
  requested_changes?: string[];
}): AcceptanceCheckResult {
  const before = collectTextContentSnapshots(input.beforeCanvas);
  const after = collectTextContentSnapshots(input.afterCanvas);
  const authorizedIds = authorizedContentEditTargetIds(
    input.plan,
    input.requested_changes ?? [],
  );

  const findings: AcceptanceFinding[] = [];
  const beforeById = new Map(before.map((t) => [t.id, t]));
  const afterById = new Map(after.map((t) => [t.id, t]));
  const beforeCanonCounts = new Map<string, number>();
  for (const t of before) {
    beforeCanonCounts.set(
      t.canonical,
      (beforeCanonCounts.get(t.canonical) ?? 0) + 1,
    );
  }
  const afterCanonCounts = new Map<string, number>();
  for (const t of after) {
    afterCanonCounts.set(
      t.canonical,
      (afterCanonCounts.get(t.canonical) ?? 0) + 1,
    );
  }

  for (const [id, b] of beforeById) {
    const a = afterById.get(id);
    if (!a) {
      // Object removed: allow if identical canonical text still present elsewhere
      // (re-id / regroup) and multiset still covers it; else fail.
      const remaining = afterCanonCounts.get(b.canonical) ?? 0;
      if (remaining <= 0 && !authorizedIds.has(id)) {
        findings.push({
          code: "ACC_CONTENT_DELETED",
          message: `Factual text object removed without authorized content-edit: ${id}`,
          object_ids: [id],
          metrics: { before_text: b.raw.slice(0, 120) },
        });
      }
      continue;
    }
    if (a.canonical === b.canonical) continue;
    if (authorizedIds.has(id)) continue;
    findings.push({
      code: "ACC_CONTENT_REPLACED",
      message: `Text content changed without authorized content-edit Founder item: ${id}`,
      object_ids: [id],
      metrics: {
        before_text: b.raw.slice(0, 120),
        after_text: a.raw.slice(0, 120),
      },
    });
  }

  for (const [id, a] of afterById) {
    if (beforeById.has(id)) continue;
    if (authorizedIds.has(id)) continue;
    const priorCount = beforeCanonCounts.get(a.canonical) ?? 0;
    const afterCount = afterCanonCounts.get(a.canonical) ?? 0;
    // New id carrying already-known canonical text (move/reorder/copy of existing) OK
    // only when overall multiset does not introduce net-new canonical strings.
    if (priorCount > 0 && afterCount <= priorCount + 0) {
      // still may be net-new if counts exceed — checked below
      continue;
    }
    if (priorCount === 0) {
      findings.push({
        code: "ACC_CONTENT_INVENTED",
        message: `New textual content not traceable to prior resume text: ${id}`,
        object_ids: [id],
        metrics: { after_text: a.raw.slice(0, 120) },
      });
    }
  }

  // Multiset: every prior canonical string must remain; no net-new canonical strings
  // unless authorized via update_text on content-edit items.
  for (const [canon, count] of beforeCanonCounts) {
    const afterCount = afterCanonCounts.get(canon) ?? 0;
    if (afterCount < count) {
      // Authorized content-edit replacements intentionally drop prior canon on those ids.
      const authorizedLoss = before.filter((t) => {
        if (t.canonical !== canon || !authorizedIds.has(t.id)) return false;
        const a = afterById.get(t.id);
        return !a || a.canonical !== canon;
      }).length;
      if (afterCount + authorizedLoss >= count) continue;
      // May already be reported via deleted/replaced; add aggregate if needed
      const already = findings.some(
        (f) =>
          f.code === "ACC_CONTENT_DELETED" || f.code === "ACC_CONTENT_REPLACED",
      );
      if (!already) {
        findings.push({
          code: "ACC_CONTENT_MULTISET_LOSS",
          message: `Prior factual text missing from final canvas (canonical multiset)`,
          object_ids: before.filter((t) => t.canonical === canon).map((t) => t.id),
          metrics: { canonical: canon.slice(0, 80), before: count, after: afterCount },
        });
      }
    }
  }
  for (const [canon, count] of afterCanonCounts) {
    const beforeCount = beforeCanonCounts.get(canon) ?? 0;
    if (count > beforeCount) {
      // Allow if every new instance id is authorized
      const newIds = after
        .filter((t) => t.canonical === canon)
        .map((t) => t.id)
        .filter((id) => {
          const b = beforeById.get(id);
          return !b || b.canonical !== canon;
        });
      const allAuthorized =
        newIds.length > 0 && newIds.every((id) => authorizedIds.has(id));
      if (!allAuthorized && beforeCount === 0) {
        // invented already flagged per-id; ensure aggregate
        if (!findings.some((f) => f.code === "ACC_CONTENT_INVENTED")) {
          findings.push({
            code: "ACC_CONTENT_INVENTED",
            message: `Invented factual content not present in prior canvas`,
            object_ids: after
              .filter((t) => t.canonical === canon)
              .map((t) => t.id),
            metrics: { canonical: canon.slice(0, 80) },
          });
        }
      } else if (!allAuthorized && count > beforeCount) {
        findings.push({
          code: "ACC_CONTENT_DUPLICATED_OR_INVENTED",
          message: `Additional factual text instances beyond prior content without authorization`,
          object_ids: after
            .filter((t) => t.canonical === canon)
            .map((t) => t.id),
          metrics: { before: beforeCount, after: count },
        });
      }
    }
  }

  const pass = findings.length === 0;
  const objectIds = [
    ...new Set(findings.flatMap((f) => f.object_ids)),
  ];
  return {
    check_id: "content_preservation",
    check_type: "CONTENT_PRESERVATION",
    requested_change: input.requestedChange,
    classification: "VERIFICATION_ACCEPTANCE",
    pass,
    evaluable: true,
    findings,
    object_ids: objectIds,
    metrics: {
      before_text_objects: before.length,
      after_text_objects: after.length,
      authorized_content_edit_targets: [...authorizedIds],
      findings_count: findings.length,
    },
    reason: pass
      ? "Factual resume text preserved (geometry/style/reorder only; no unauthorized fabrication or rewrite)"
      : `${findings.length} content-preservation finding(s)`,
  };
}

/** Gap comparison noise tolerance (px) — matches FeedbackCoverage relational proofs. */
const LAYOUT_PRESERVATION_NOISE_PX = 2;

function invBottom(o: CanvasInventoryObject): number | null {
  if (o.top == null) return null;
  const h = o.height ?? 0;
  return o.top + h;
}

function isSummaryBodyInventory(o: CanvasInventoryObject): boolean {
  if (o.section !== "summary" || o.system) return false;
  if (
    o.role === "section-heading" ||
    o.role === "filled-label" ||
    o.role === "section-heading-accent"
  ) {
    return false;
  }
  if (o.text && /^(0?\d\s+)?SUMMARY\s*$/i.test(String(o.text).trim())) {
    return false;
  }
  if (!o.text) return false;
  return String(o.type ?? "")
    .toLowerCase()
    .includes("text");
}

function findSummaryContentBottom(
  inv: CanvasInventoryObject[],
): { bottom: number; id: string } | null {
  let best: { bottom: number; id: string } | null = null;
  for (const o of inv.filter(isSummaryBodyInventory)) {
    const bottom = invBottom(o);
    if (bottom == null) continue;
    if (!best || bottom > best.bottom) best = { bottom, id: o.id };
  }
  return best;
}

function findExperienceHeadingTop(
  inv: CanvasInventoryObject[],
): { top: number; id: string } | null {
  const inSection = inv.filter(
    (o) => o.section === "experience" && !o.system && o.top != null,
  );
  const headingText = inSection.find(
    (o) =>
      (o.text != null &&
        /^\s*EXPERIENCE\b/i.test(String(o.text).trim())) ||
      (o.role === "section-heading" && o.text != null),
  );
  if (headingText?.top != null) {
    return { top: headingText.top, id: headingText.id };
  }
  const headingLike = inSection.filter(
    (o) =>
      o.role === "section-heading" ||
      o.role === "section-heading-accent" ||
      o.role === "filled-label" ||
      (o.text == null &&
        String(o.type ?? "")
          .toLowerCase()
          .includes("rect")),
  );
  if (headingLike.length === 0) return null;
  const min = headingLike.reduce((a, b) =>
    (a.top ?? Infinity) < (b.top ?? Infinity) ? a : b,
  );
  if (min.top == null) return null;
  return { top: min.top, id: min.id };
}

export function runPageFitCheck(input: {
  page_fit: PageFitReport | null | undefined;
  afterCanvas: FabricCanvasDoc;
  requestedChange: string;
}): AcceptanceCheckResult {
  const pf = input.page_fit;
  const oob = findOutOfBoundsObjects(input.afterCanvas);
  const oobIds = oob.flatMap((f) => f.object_ids);
  if (!pf) {
    return {
      check_id: "page_fit",
      check_type: "PAGE_FIT",
      requested_change: input.requestedChange,
      classification: "VERIFICATION_ACCEPTANCE",
      pass: false,
      evaluable: false,
      findings: [
        {
          code: "ACC_PAGE_FIT_UNEVALUABLE",
          message: "page_fit report missing from layout normalization",
          object_ids: oobIds,
        },
      ],
      object_ids: oobIds,
      metrics: {},
      reason: "Page-fit verification unevaluable without normalization page_fit report",
    };
  }
  const pass =
    pf.fit_pass === true &&
    pf.overflow_after <= 0.5 &&
    oob.filter((f) => f.code !== "ACC_BOUNDS_UNEVALUABLE").length === 0;
  const findings: AcceptanceFinding[] = [];
  if (!pf.fit_pass || pf.overflow_after > 0.5) {
    findings.push({
      code: "ACC_PAGE_OVERFLOW",
      message: `Page overflow after compaction: ${pf.overflow_after}px`,
      object_ids: [],
      metrics: {
        overflow_after: pf.overflow_after,
        content_bottom_after: pf.content_bottom_after_compaction,
        page_height: pf.page_height,
      },
    });
  }
  findings.push(
    ...oob.filter((f) => f.code !== "ACC_BOUNDS_UNEVALUABLE"),
  );
  return {
    check_id: "page_fit",
    check_type: "PAGE_FIT",
    requested_change: input.requestedChange,
    classification: "VERIFICATION_ACCEPTANCE",
    pass,
    evaluable: true,
    findings,
    object_ids: [...new Set(findings.flatMap((f) => f.object_ids))],
    metrics: { page_fit: pf },
    reason: pass
      ? "One-page fit pass from authoritative normalization page_fit report"
      : "Page-fit or bounds verification failed",
  };
}

export function runLayoutPreservationCheck(input: {
  beforeCanvas: FabricCanvasDoc;
  afterCanvas: FabricCanvasDoc;
  requestedChange: string;
}): AcceptanceCheckResult {
  const beforeInv = buildCanvasInventory(input.beforeCanvas);
  const afterInv = buildCanvasInventory(input.afterCanvas);
  const beforeSummary = findSummaryContentBottom(beforeInv);
  const afterSummary = findSummaryContentBottom(afterInv);
  const beforeExp = findExperienceHeadingTop(beforeInv);
  const afterExp = findExperienceHeadingTop(afterInv);
  const ids = [
    beforeSummary?.id,
    afterSummary?.id,
    beforeExp?.id,
    afterExp?.id,
  ].filter((x): x is string => Boolean(x));

  if (!beforeSummary || !afterSummary || !beforeExp || !afterExp) {
    return {
      check_id: "layout_preservation",
      check_type: "LAYOUT_PRESERVATION",
      requested_change: input.requestedChange,
      classification: "VERIFICATION_ACCEPTANCE",
      pass: false,
      evaluable: false,
      findings: [
        {
          code: "ACC_LAYOUT_PRESERVATION_UNEVALUABLE",
          message:
            "Summary body or Experience heading geometry missing for preservation proof",
          object_ids: ids,
        },
      ],
      object_ids: ids,
      metrics: {},
      reason: "Layout preservation unevaluable: missing Summary/Experience geometry",
    };
  }

  const priorGap = Number((beforeExp.top - beforeSummary.bottom).toFixed(2));
  const finalGap = Number((afterExp.top - afterSummary.bottom).toFixed(2));
  const findings: AcceptanceFinding[] = [];
  let pass = true;

  if (finalGap < 0) {
    pass = false;
    findings.push({
      code: "ACC_LAYOUT_PRESERVATION_OVERLAP",
      message: "Summary→Experience overlap introduced (regression)",
      object_ids: ids,
      metrics: { prior_gap: priorGap, final_gap: finalGap },
    });
  } else if (finalGap + LAYOUT_PRESERVATION_NOISE_PX < priorGap) {
    pass = false;
    findings.push({
      code: "ACC_LAYOUT_PRESERVATION_GAP_REGRESSION",
      message: `Summary→Experience gap regressed: prior=${priorGap} final=${finalGap}`,
      object_ids: ids,
      metrics: {
        prior_gap: priorGap,
        final_gap: finalGap,
        noise_px: LAYOUT_PRESERVATION_NOISE_PX,
      },
    });
  } else if (finalGap + 1e-9 < MIN_SECTION_GAP_PX) {
    pass = false;
    findings.push({
      code: "ACC_LAYOUT_PRESERVATION_GAP_BELOW_MIN",
      message: `Summary→Experience gap ${finalGap}px below minimum ${MIN_SECTION_GAP_PX}px`,
      object_ids: ids,
      metrics: { final_gap: finalGap, minimum_gap_px: MIN_SECTION_GAP_PX },
    });
  }

  return {
    check_id: "layout_preservation",
    check_type: "LAYOUT_PRESERVATION",
    requested_change: input.requestedChange,
    classification: "VERIFICATION_ACCEPTANCE",
    pass,
    evaluable: true,
    findings,
    object_ids: ids,
    metrics: { prior_gap: priorGap, final_gap: finalGap },
    reason: pass
      ? `Summary→Experience spacing preserved within tolerance (prior=${priorGap} final=${finalGap})`
      : `${findings.length} layout-preservation finding(s)`,
  };
}

function headerBandObjectIds(canvas: FabricCanvasDoc): string[] {
  const pageH = Number(canvas.height ?? 1123);
  const headerMaxTop = pageH * 0.22;
  const ids: string[] = [];
  const objects = (canvas.objects ?? []) as Record<string, unknown>[];
  objects.forEach((o, index) => {
    const top = Number(o.top ?? 0);
    if (top > headerMaxTop) return;
    const t = String(o.type ?? "").toLowerCase();
    if (t !== "rect" && !t.includes("text")) return;
    const fill = String(o.fill ?? "").toLowerCase();
    const isDark =
      fill.includes("1f1f") ||
      fill.includes("0f172") ||
      fill.includes("navy") ||
      fill.includes("#1") ||
      fill === "#000" ||
      fill === "#000000";
    if (t === "rect" && !isDark && top > 80) return;
    ids.push(objectId(o as CanvasObject, index));
  });
  return ids;
}

export function runArchitecturePreservationCheck(input: {
  beforeCanvas: FabricCanvasDoc;
  afterCanvas: FabricCanvasDoc;
  requestedChange: string;
}): AcceptanceCheckResult {
  const beforeLanes = detectLayoutLanesFromCanvas(input.beforeCanvas);
  const afterLanes = detectLayoutLanesFromCanvas(input.afterCanvas);
  const findings: AcceptanceFinding[] = [];
  let pass = true;

  if (beforeLanes.lane_count !== afterLanes.lane_count) {
    pass = false;
    findings.push({
      code: "ACC_ARCHITECTURE_LANE_COUNT_CHANGED",
      message: `Lane count changed ${beforeLanes.lane_count} → ${afterLanes.lane_count}`,
      object_ids: [],
      metrics: {
        before_lane_count: beforeLanes.lane_count,
        after_lane_count: afterLanes.lane_count,
      },
    });
  }

  if (beforeLanes.lane_count >= 2 && afterLanes.lane_count < 2) {
    pass = false;
    findings.push({
      code: "ACC_ARCHITECTURE_COLUMN_COLLAPSE",
      message: "Multi-column topology collapsed",
      object_ids: [],
      metrics: {
        before_lane_count: beforeLanes.lane_count,
        after_lane_count: afterLanes.lane_count,
      },
    });
  }

  const beforeHeaderIds = headerBandObjectIds(input.beforeCanvas);
  const afterHeaderIds = headerBandObjectIds(input.afterCanvas);
  if (beforeHeaderIds.length > 0 && afterHeaderIds.length === 0) {
    pass = false;
    findings.push({
      code: "ACC_ARCHITECTURE_HEADER_BAND_LOST",
      message: "Header band structural objects no longer detected",
      object_ids: beforeHeaderIds,
      metrics: {
        before_header_objects: beforeHeaderIds.length,
        after_header_objects: afterHeaderIds.length,
      },
    });
  }

  const objectIds = [
    ...new Set([...beforeHeaderIds, ...afterHeaderIds]),
  ];

  return {
    check_id: "architecture_preservation",
    check_type: "ARCHITECTURE_PRESERVATION",
    requested_change: input.requestedChange,
    classification: "VERIFICATION_ACCEPTANCE",
    pass,
    evaluable: true,
    findings,
    object_ids: objectIds,
    metrics: {
      before_lane_count: beforeLanes.lane_count,
      after_lane_count: afterLanes.lane_count,
      before_lanes: beforeLanes.lanes.map((l) => l.lane_id),
      after_lanes: afterLanes.lanes.map((l) => l.lane_id),
      header_band_supported: true,
      typography_colors_sidebar:
        "not independently proven — lane/topology/header band only",
    },
    reason: pass
      ? `Architecture preserved (lanes=${afterLanes.lane_count}, header band present)`
      : `${findings.length} architecture-preservation finding(s)`,
  };
}

function runAcceptanceCheckForType(input: {
  checkType: VerificationCheckType;
  requestedChange: string;
  afterCanvas: FabricCanvasDoc;
  beforeCanvas?: FabricCanvasDoc | null;
  plan?: RevisionPlan | null;
  requested_changes: string[];
  page_fit?: PageFitReport | null;
}): AcceptanceCheckResult {
  switch (input.checkType) {
    case "COLLISION_BOUNDS":
      return runCollisionBoundsCheck(input.afterCanvas, input.requestedChange);
    case "VISUAL_CONSISTENCY":
      return runVisualConsistencyCheck(
        input.afterCanvas,
        input.requestedChange,
      );
    case "CONTENT_PRESERVATION":
      if (!input.beforeCanvas) {
        return {
          check_id: "content_preservation",
          check_type: "CONTENT_PRESERVATION",
          requested_change: input.requestedChange,
          classification: "VERIFICATION_ACCEPTANCE",
          pass: false,
          evaluable: false,
          findings: [
            {
              code: "ACC_CONTENT_UNEVALUABLE",
              message: "beforeCanvas missing for content-preservation check",
              object_ids: [],
            },
          ],
          object_ids: [],
          metrics: {},
          reason: "Content preservation unevaluable without prior canvas",
        };
      }
      return runContentPreservationCheck({
        beforeCanvas: input.beforeCanvas,
        afterCanvas: input.afterCanvas,
        requestedChange: input.requestedChange,
        plan: input.plan,
        requested_changes: input.requested_changes,
      });
    case "PAGE_FIT":
      return runPageFitCheck({
        page_fit: input.page_fit,
        afterCanvas: input.afterCanvas,
        requestedChange: input.requestedChange,
      });
    case "LAYOUT_PRESERVATION":
      if (!input.beforeCanvas) {
        return {
          check_id: "layout_preservation",
          check_type: "LAYOUT_PRESERVATION",
          requested_change: input.requestedChange,
          classification: "VERIFICATION_ACCEPTANCE",
          pass: false,
          evaluable: false,
          findings: [
            {
              code: "ACC_LAYOUT_PRESERVATION_UNEVALUABLE",
              message: "beforeCanvas missing for layout-preservation check",
              object_ids: [],
            },
          ],
          object_ids: [],
          metrics: {},
          reason: "Layout preservation unevaluable without prior canvas",
        };
      }
      return runLayoutPreservationCheck({
        beforeCanvas: input.beforeCanvas,
        afterCanvas: input.afterCanvas,
        requestedChange: input.requestedChange,
      });
    case "ARCHITECTURE_PRESERVATION":
      if (!input.beforeCanvas) {
        return {
          check_id: "architecture_preservation",
          check_type: "ARCHITECTURE_PRESERVATION",
          requested_change: input.requestedChange,
          classification: "VERIFICATION_ACCEPTANCE",
          pass: false,
          evaluable: false,
          findings: [
            {
              code: "ACC_ARCHITECTURE_PRESERVATION_UNEVALUABLE",
              message: "beforeCanvas missing for architecture-preservation check",
              object_ids: [],
            },
          ],
          object_ids: [],
          metrics: {},
          reason: "Architecture preservation unevaluable without prior canvas",
        };
      }
      return runArchitecturePreservationCheck({
        beforeCanvas: input.beforeCanvas,
        afterCanvas: input.afterCanvas,
        requestedChange: input.requestedChange,
      });
    default: {
      const _exhaustive: never = input.checkType;
      return _exhaustive;
    }
  }
}

export function runRevisionAcceptanceChecks(input: {
  afterCanvas: FabricCanvasDoc;
  beforeCanvas?: FabricCanvasDoc | null;
  plan?: RevisionPlan | null;
  requested_changes: string[];
  task_id?: string | null;
  revision_id?: string | null;
  decision_id?: string | null;
  /** Authoritative post-normalization page-fit report. */
  page_fit?: PageFitReport | null;
}): RevisionAcceptanceReport {
  const checks: AcceptanceCheckResult[] = [];
  for (const change of input.requested_changes) {
    const classified = classifyRequestedChange(change);
    if (classified.classification !== "VERIFICATION_ACCEPTANCE") continue;
    for (const checkType of verificationCheckTypes(classified)) {
      checks.push(
        runAcceptanceCheckForType({
          checkType,
          requestedChange: change,
          afterCanvas: input.afterCanvas,
          beforeCanvas: input.beforeCanvas,
          plan: input.plan,
          requested_changes: input.requested_changes,
          page_fit: input.page_fit,
        }),
      );
    }
  }
  return {
    schema_version: "founder-revision-acceptance-1.0.0",
    task_id: input.task_id ?? null,
    revision_id: input.revision_id ?? null,
    decision_id: input.decision_id ?? null,
    at: new Date().toISOString(),
    canvas_source: "post_mutation",
    checks,
    all_verification_pass:
      checks.length === 0 ? true : checks.every((c) => c.pass && c.evaluable),
  };
}

export function findAcceptanceChecksForChange(
  report: RevisionAcceptanceReport | null | undefined,
  requestedChange: string,
): AcceptanceCheckResult[] {
  if (!report) return [];
  const classified = classifyRequestedChange(requestedChange);
  if (classified.classification !== "VERIFICATION_ACCEPTANCE") return [];
  const required = verificationCheckTypes(classified);
  if (required.length === 0) return [];
  return report.checks.filter(
    (c) =>
      c.requested_change === requestedChange &&
      required.includes(c.check_type),
  );
}

/** First matching check (legacy). Prefer findAcceptanceChecksForChange for compound items. */
export function findAcceptanceCheckForChange(
  report: RevisionAcceptanceReport | null | undefined,
  requestedChange: string,
): AcceptanceCheckResult | null {
  const all = findAcceptanceChecksForChange(report, requestedChange);
  if (all.length > 0) return all[0]!;
  if (!report) return null;
  const classified = classifyRequestedChange(requestedChange);
  if (classified.classification !== "VERIFICATION_ACCEPTANCE") return null;
  return (
    report.checks.find(
      (c) =>
        c.check_type === classified.check_type &&
        classifyRequestedChange(c.requested_change).check_type ===
          classified.check_type,
    ) ?? null
  );
}
