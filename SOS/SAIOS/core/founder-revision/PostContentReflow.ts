/**
 * Phase 6H — post-content reflow for mixed content + layout revisions.
 *
 * After authorized update_text (and other non-position content ops) change
 * wrap height, downstream objects in the same column must be pushed by the
 * minimum amount that restores positive separation. This is not a page-wide
 * redesign: left/width/fonts stay put.
 *
 * Visual wrap bounds come from TextEffectiveHeight (the existing model).
 */
import type { FabricCanvasDoc } from "./CanvasInventory.js";
import {
  effectiveObjectBBox,
  effectiveTextHeightScaled,
  isFabricTextObject,
  storedTextHeightScaled,
  visualTextContentHeightScaled,
} from "./TextEffectiveHeight.js";
import {
  detectLayoutLanesFromCanvas,
  MIN_SECTION_GAP_PX,
} from "./RevisionLayoutNormalizer.js";
import {
  findTextOverlapFindings,
  MIN_SEQUENTIAL_RENDERED_TEXT_GAP_PX,
} from "./RevisionAcceptanceChecks.js";
import { executeCanvasOperations } from "./CanvasOperationExecutor.js";
import type { CanvasOperation } from "./revision-task-types.js";

export const POST_CONTENT_SAME_ROW_PX = 2;
/** Fallback column split when lane metadata is unavailable. */
export const POST_CONTENT_COLUMN_SPLIT_PX = 200;

export type PostContentReflowReport = {
  schema_version: "founder-revision-post-content-reflow-1.0.0";
  grown_object_ids: string[];
  shifted_object_ids: string[];
  intra_section_pushes: number;
  cross_section_pushes: number;
};

function deepCloneCanvas(canvas: FabricCanvasDoc): FabricCanvasDoc {
  return JSON.parse(JSON.stringify(canvas)) as FabricCanvasDoc;
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

function isSystemBg(o: Record<string, unknown>): boolean {
  const data = o.data;
  if (data && typeof data === "object" && !Array.isArray(data)) {
    const d = data as Record<string, unknown>;
    return d.system === true || d.kind === "page-bg" || d.role === "pageBackground";
  }
  return false;
}

function columnOf(o: Record<string, unknown>): "left" | "right" {
  const left = Number(o.left ?? 0);
  return left < POST_CONTENT_COLUMN_SPLIT_PX ? "left" : "right";
}

function snap(n: number): number {
  return Number(n.toFixed(2));
}

function overlapX(
  a: ReturnType<typeof effectiveObjectBBox>,
  b: ReturnType<typeof effectiveObjectBBox>,
): number {
  return Math.min(a.right, b.right) - Math.max(a.left, b.left);
}

function geomBox(o: Record<string, unknown>): ReturnType<typeof effectiveObjectBBox> {
  if (isFabricTextObject(o)) return effectiveObjectBBox(o);
  const left = Number(o.left ?? 0);
  const top = Number(o.top ?? 0);
  const width = Number(o.width ?? 0) * Number(o.scaleX ?? 1);
  const height = Number(o.height ?? 0) * Number(o.scaleY ?? 1);
  return {
    left,
    top,
    right: left + width,
    bottom: top + height,
    width,
    height,
  };
}

/**
 * Grow stored textbox height when rendered wrap exceeds it, so later stacking
 * and clipping checks see the same extent the Founder sees.
 */
export function syncStoredTextHeightsToVisual(
  canvas: FabricCanvasDoc,
): string[] {
  const grown: string[] = [];
  const objects = (canvas.objects ?? []) as Array<Record<string, unknown>>;
  for (let i = 0; i < objects.length; i++) {
    const o = objects[i]!;
    if (!isFabricTextObject(o)) continue;
    const visual = visualTextContentHeightScaled(o);
    const stored = storedTextHeightScaled(o);
    if (visual <= stored + 0.5) continue;
    const scaleY = typeof o.scaleY === "number" && o.scaleY > 0 ? o.scaleY : 1;
    o.height = snap(visual / scaleY);
    grown.push(objectId(o, i));
  }
  return grown;
}

function laneKeyOf(
  o: Record<string, unknown>,
  id: string,
  objectToLane: Record<string, string>,
): string | null {
  if (isSystemBg(o)) return null;
  if (sectionOf(o) === "header") return null;
  if (objectToLane[id]) return objectToLane[id]!;
  const sec = sectionOf(o);
  if (!sec) return null;
  return `fallback-${columnOf(o)}`;
}

/**
 * Push the next sequential object in the same layout lane just enough to
 * restore a positive gap after wrap growth. Same-section pairs use the
 * sequential text floor; adjacent-section pairs use the section-stack
 * minimum. Decorative / unsectioned backgrounds are not flow objects.
 */
export function reflowDownstreamAfterContent(
  canvas: FabricCanvasDoc,
): {
  shifted_object_ids: string[];
  intra_section_pushes: number;
  cross_section_pushes: number;
} {
  const objects = (canvas.objects ?? []) as Array<Record<string, unknown>>;
  const objectToLane = detectLayoutLanesFromCanvas(canvas).object_id_to_lane;
  const shifted = new Set<string>();
  let intra = 0;
  let cross = 0;

  const members = objects
    .map((o, i) => ({ o, i, id: objectId(o, i) }))
    .map((x) => ({ ...x, lane: laneKeyOf(x.o, x.id, objectToLane) }))
    .filter((x) => x.lane != null) as Array<{
    o: Record<string, unknown>;
    i: number;
    id: string;
    lane: string;
  }>;

  const lanes = [...new Set(members.map((m) => m.lane))];
  for (const lane of lanes) {
    const items = members
      .filter((m) => m.lane === lane)
      .sort((a, b) => {
        const dt = Number(a.o.top ?? 0) - Number(b.o.top ?? 0);
        if (dt !== 0) return dt;
        return a.id.localeCompare(b.id);
      });

    for (let i = 0; i < items.length; i++) {
      const upper = items[i]!;
      const upperBox = geomBox(upper.o);
      const upperSection = sectionOf(upper.o);
      let lowerIndex = -1;
      for (let j = i + 1; j < items.length; j++) {
        const candidateTop = Number(items[j]!.o.top ?? 0);
        if (candidateTop - Number(upper.o.top ?? 0) < POST_CONTENT_SAME_ROW_PX) {
          continue;
        }
        const lowerBox = geomBox(items[j]!.o);
        if (overlapX(upperBox, lowerBox) < 20) continue;
        lowerIndex = j;
        break;
      }
      if (lowerIndex < 0) continue;

      const lower = items[lowerIndex]!;
      const lowerTop = Number(lower.o.top ?? 0);
      const sameSection =
        upperSection !== "" && upperSection === sectionOf(lower.o);
      const minGap = sameSection
        ? MIN_SEQUENTIAL_RENDERED_TEXT_GAP_PX
        : MIN_SECTION_GAP_PX;
      const gap = lowerTop - upperBox.bottom;
      if (gap + 1e-9 >= minGap) continue;

      const delta = snap(minGap - gap);
      if (delta <= 0) continue;
      const threshold = lowerTop - 0.01;
      for (const item of items) {
        if (Number(item.o.top ?? 0) + 1e-9 < threshold) continue;
        item.o.top = snap(Number(item.o.top ?? 0) + delta);
        shifted.add(item.id);
      }
      if (sameSection) intra += 1;
      else cross += 1;
    }
  }

  return {
    shifted_object_ids: [...shifted],
    intra_section_pushes: intra,
    cross_section_pushes: cross,
  };
}

export function applyPostContentReflow(input: {
  canvas: FabricCanvasDoc;
}): { canvas: FabricCanvasDoc; report: PostContentReflowReport } {
  const canvas = deepCloneCanvas(input.canvas);
  const grown_object_ids = syncStoredTextHeightsToVisual(canvas);
  const pushed = reflowDownstreamAfterContent(canvas);
  return {
    canvas,
    report: {
      schema_version: "founder-revision-post-content-reflow-1.0.0",
      grown_object_ids,
      shifted_object_ids: pushed.shifted_object_ids,
      intra_section_pushes: pushed.intra_section_pushes,
      cross_section_pushes: pushed.cross_section_pushes,
    },
  };
}

export function isContentMutationOp(op: CanvasOperation): boolean {
  switch (op.op) {
    case "update_text":
    case "set_fill":
    case "set_stroke":
    case "adjust_font_size":
    case "adjust_line_height":
    case "add_object":
    case "remove_object":
    case "set_dimensions":
    case "resize_object":
    case "extend_shape":
      return true;
    default:
      return false;
  }
}

export function isAiGeometryOp(op: CanvasOperation): boolean {
  switch (op.op) {
    case "set_position":
    case "move_object":
    case "align_objects":
    case "adjust_spacing":
      return true;
    default:
      return false;
  }
}

function countPageOob(canvas: FabricCanvasDoc): number {
  const pageW = Number(canvas.width ?? 794);
  const pageH = Number(canvas.height ?? 1123);
  let n = 0;
  for (const o of (canvas.objects ?? []) as Array<Record<string, unknown>>) {
    if (isSystemBg(o)) continue;
    const box = geomBox(o);
    if (
      box.left < -1 ||
      box.top < -1 ||
      box.right > pageW + 1 ||
      box.bottom > pageH + 1
    ) {
      n += 1;
    }
  }
  return n;
}

export function dropUnsafeGeometryOps(input: {
  canvas: FabricCanvasDoc;
  plan: { schema_version: string; summary?: string; operations: CanvasOperation[]; notes?: string[] };
}): { plan: { schema_version: string; summary?: string; operations: CanvasOperation[]; notes?: string[] }; dropped: CanvasOperation[] } {
  const contentOps = input.plan.operations.filter((op) => isContentMutationOp(op));
  const geomOps = input.plan.operations.filter((op) => isAiGeometryOp(op));
  const otherOps = input.plan.operations.filter(
    (op) => !isContentMutationOp(op) && !isAiGeometryOp(op),
  );
  if (geomOps.length === 0) {
    return { plan: input.plan, dropped: [] };
  }
  const contentExec = executeCanvasOperations({
    canvas: input.canvas,
    operations: contentOps,
  });
  let current = contentExec.ok
    ? applyPostContentReflow({ canvas: contentExec.canvas }).canvas
    : input.canvas;
  const kept: CanvasOperation[] = [];
  const dropped: CanvasOperation[] = [];
  for (const op of geomOps) {
    const trial = executeCanvasOperations({
      canvas: current,
      operations: [op],
    });
    const trialOverlaps = trial.ok
      ? findTextOverlapFindings(trial.canvas).length
      : 99;
    const trialOob = trial.ok ? countPageOob(trial.canvas) : 99;
    if (trial.ok && trialOverlaps === 0 && trialOob === 0) {
      kept.push(op);
      current = trial.canvas;
    } else {
      dropped.push(op);
    }
  }
  if (dropped.length === 0) {
    return { plan: input.plan, dropped: [] };
  }
  return {
    plan: {
      ...input.plan,
      operations: [...contentOps, ...kept, ...otherOps],
      notes: [
        ...(input.plan.notes ?? []),
        `dropped_unsafe_geometry_ops=${dropped.length}`,
      ],
    },
    dropped,
  };
}

export function pairGap(
  canvas: FabricCanvasDoc,
  upperId: string,
  lowerId: string,
): number | null {
  const objs = (canvas.objects ?? []) as Array<Record<string, unknown>>;
  const upper = objs.find((o, i) => objectId(o, i) === upperId);
  const lower = objs.find((o, i) => objectId(o, i) === lowerId);
  if (!upper || !lower) return null;
  const bottom = isFabricTextObject(upper)
    ? effectiveObjectBBox(upper).bottom
    : Number(upper.top ?? 0) + effectiveTextHeightScaled(upper);
  return Number(lower.top ?? 0) - bottom;
}
