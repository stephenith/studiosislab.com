/**
 * Template JSON loading and applying onto canvas.
 * Ensures first object can be a locked white background rect when templates require it.
 */

import { Canvas, Rect, Shadow } from "fabric";
import { TEMPLATE_SNAPSHOTS } from "@/data/templates";
import { CANVAS_BG } from "@/types/editor";

export type TemplateSnapshot = { objects: any[] };

/**
 * Load template JSON by id from TEMPLATE_SNAPSHOTS.
 */
export function loadTemplateJson(templateId: string): TemplateSnapshot | null {
  const id = (templateId || "").toLowerCase().trim();
  const snap = TEMPLATE_SNAPSHOTS[id];
  if (snap && Array.isArray((snap as TemplateSnapshot).objects)) {
    return snap as TemplateSnapshot;
  }
  return TEMPLATE_SNAPSHOTS.blank
    ? (TEMPLATE_SNAPSHOTS.blank as TemplateSnapshot)
    : { objects: [] };
}

/**
 * Normalize various snapshot shapes to { objects: any[] }.
 */
export function normalizeToFabricJson(snap: any): { objects: any[] } {
  if (!snap) return { objects: [] };
  if (typeof snap === "string") {
    try {
      return normalizeToFabricJson(JSON.parse(snap));
    } catch {
      return { objects: [] };
    }
  }
  if (snap?.canvas) return normalizeToFabricJson(snap.canvas);
  if (Array.isArray(snap?.objects)) return snap;
  return { objects: [] };
}

export interface ApplyTemplateToCanvasOptions {
  reviver?: (key: string, value: any) => any;
  finalize?: () => void;
}

/**
 * Clear canvas and load JSON. Caller provides reviver and finalize (e.g. ensureObjectId, normalize).
 * Handles Fabric v6 loadFromJSON returning a Promise.
 */
export async function applyTemplateToCanvas(
  canvas: Canvas,
  json: { objects?: any[] },
  options: ApplyTemplateToCanvasOptions = {}
): Promise<void> {
  const { reviver, finalize } = options;
  const obj = Array.isArray(json?.objects) ? { objects: json.objects } : { objects: [] };
  let finalized = false;
  const done = () => {
    if (finalized) return;
    finalized = true;
    finalize?.();
  };
  try {
    const result = (canvas as any).loadFromJSON(obj, reviver, done);
    if (result && typeof result.then === "function") {
      await result;
      done();
    }
  } catch (e) {
    done();
    throw e;
  }
}

function isPageBackgroundLike(obj: any, pageW: number, pageH: number): boolean {
  if (!obj) return false;
  if (obj?.data?.role === "pageBackground" || obj?.role === "pageBackground") return true;
  if (obj?.type === "rect" && obj.left === 0 && obj.top === 0 && pageW && pageH) {
    const w = obj.getScaledWidth?.() ?? obj.width ?? 0;
    const h = obj.getScaledHeight?.() ?? obj.height ?? 0;
    return Math.abs(w - pageW) < 2 && Math.abs(h - pageH) < 2;
  }
  return false;
}

/**
 * Ensure a locked, non-selectable full-page background rect is at index 0.
 * Creates one if missing; otherwise moves existing to back (index 0).
 */
export function ensureBackgroundRectFirst(
  canvas: Canvas,
  pageW: number,
  pageH: number,
  fill: string = "#ffffff"
): void {
  canvas.set({ backgroundColor: CANVAS_BG });
  const objs = canvas.getObjects?.() ?? [];
  let pageObj = objs.find((o: any) => isPageBackgroundLike(o, pageW, pageH));
  if (!pageObj) {
    const rect = new Rect({
      width: pageW,
      height: pageH,
      left: 0,
      top: 0,
      fill,
      stroke: "#e5e7eb",
      shadow: new Shadow({
        color: "rgba(0,0,0,0.10)",
        blur: 18,
        offsetX: 0,
        offsetY: 8,
      }),
      selectable: false,
      evented: false,
      hasControls: false,
      hasBorders: false,
      lockMovementX: true,
      lockMovementY: true,
      lockScalingX: true,
      lockScalingY: true,
      lockRotation: true,
      hoverCursor: "default",
      borderColor: "transparent",
      cornerColor: "transparent",
      transparentCorners: true,
      excludeFromExport: false,
    }) as any;
    (rect as any).role = "pageBackground";
    (rect as any).name = "Page Background";
    (rect as any).set?.("isPageBg", true);
    if (!rect.data) rect.data = {};
    rect.data.role = "pageBackground";
    rect.data.kind = "page-bg";
    rect.data.system = true;
    rect.setCoords?.();
    canvas.add(rect);
    pageObj = rect;
  }
  if (pageObj) {
    if ((canvas as any).sendToBack) {
      (canvas as any).sendToBack(pageObj);
    } else if ((pageObj as any).moveTo) {
      (pageObj as any).moveTo(0);
    }
  }
  canvas.requestRenderAll();
}
