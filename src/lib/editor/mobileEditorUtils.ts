/**
 * Pure helpers for the mobile resume editor.
 * Kept separate from useFabricEditor to avoid touching the desktop editor.
 */

import type { Canvas } from "fabric";
import { Rect, Shadow } from "fabric";
import { normalizeToFabricJson } from "@/lib/editor/fabricJson";
import { applyTextBoxNoStretch } from "@/lib/editor/textTools";
import { ensureObjectId } from "@/components/editor/editor/utils/fabricHelpers";
import { CANVAS_BG, PAGE_SIZES, type PageSize } from "@/types/editor";

export const FABRIC_JSON_PROPS = [
  "excludeFromExport",
  "selectable",
  "evented",
  "role",
  "data",
  "name",
  "slbId",
  "slbAssetId",
  "slbSource",
  "isPageBg",
  "locked",
  "hidden",
] as const;

const TEMPLATE_IMAGE_FALLBACK_SRC = "/templates/t004.png";

export function isTextObject(obj: any): boolean {
  const type = String(obj?.type || "").toLowerCase();
  return type === "textbox" || type === "i-text" || type === "text";
}

export function isPageBackgroundObject(obj: any, pageW?: number, pageH?: number): boolean {
  if (!obj) return false;
  if (obj?.data?.role === "pageBackground") return true;
  if (obj?.role === "pageBackground") return true;
  if (obj?.role === "page-bg") return true;
  if (obj?.role === "page") return true;
  if (obj?.data?.kind === "page-bg") return true;
  if (obj?.isPageBg === true) return true;
  const name = typeof obj?.name === "string" ? obj.name.toLowerCase().trim() : "";
  if (name === "page background") return true;
  if (name === "page-bg") return true;
  const id = obj?.id || obj?.data?.id;
  if (id === "page_bg") return true;
  if (obj?.type === "rect" && obj.left === 0 && obj.top === 0 && pageW && pageH) {
    const w = obj.getScaledWidth?.() ?? obj.width ?? 0;
    const h = obj.getScaledHeight?.() ?? obj.height ?? 0;
    return Math.abs(w - pageW) < 2 && Math.abs(h - pageH) < 2;
  }
  return false;
}

export function findPageObject(c: Canvas, pageW?: number, pageH?: number): any | null {
  const objs = c.getObjects?.() || [];
  const direct = objs.find((o: any) => isPageBackgroundObject(o, pageW, pageH));
  if (direct) return direct;
  if (!pageW || !pageH) return null;
  const tol = 5;
  let best: any = null;
  let bestScore = -Infinity;
  for (const o of objs) {
    if (!o) continue;
    if ((o as any)?.role === "grid") continue;
    const w = o.getScaledWidth?.() ?? o.width ?? 0;
    const h = o.getScaledHeight?.() ?? o.height ?? 0;
    if (!w || !h) continue;
    if (Math.abs(w - pageW) > tol || Math.abs(h - pageH) > tol) continue;
    let score = 0;
    if (o.type === "rect") score += 2;
    if (o.fill) score += 1;
    const left = Number(o.left ?? 0);
    const top = Number(o.top ?? 0);
    if (Math.abs(left) <= tol) score += 1;
    if (Math.abs(top) <= tol) score += 1;
    score += (w * h) / (pageW * pageH);
    if (score > bestScore) {
      bestScore = score;
      best = o;
    }
  }
  return best;
}

function walkFabricLikeTree(root: any, onNode: (node: any) => void): void {
  const seen = new WeakSet<object>();
  const visit = (value: any) => {
    if (!value || typeof value !== "object") return;
    if (Array.isArray(value)) {
      for (const item of value) visit(item);
      return;
    }
    if (seen.has(value)) return;
    seen.add(value);
    onNode(value);
    for (const nested of Object.values(value)) {
      if (nested && typeof nested === "object") visit(nested);
    }
  };
  visit(root);
}

function isPortableImageSrc(src: string): boolean {
  const normalized = String(src || "").trim().toLowerCase();
  if (!normalized) return false;
  if (normalized.startsWith("data:")) return true;
  if (normalized.startsWith("http://")) return true;
  if (normalized.startsWith("https://")) return true;
  if (normalized.startsWith("/")) return true;
  return false;
}

export function sanitizeImageSourcesForLoad(payload: any): void {
  walkFabricLikeTree(payload, (node) => {
    if (!node || typeof node !== "object") return;
    const type = String((node as any).type || "").toLowerCase();
    if (type !== "image") return;
    const src = String((node as any).src || "").trim();
    if (!src || src.toLowerCase().startsWith("blob:") || !isPortableImageSrc(src)) {
      (node as any).src = TEMPLATE_IMAGE_FALLBACK_SRC;
    }
    delete (node as any).slbSource;
    delete (node as any).slbAssetId;
  });
}

export function fabricSavePayloadHasDataImageSrc(payload: unknown): boolean {
  try {
    return /"src"\s*:\s*"data:/.test(JSON.stringify(payload));
  } catch {
    return true;
  }
}

export function applyPageBackgroundProps(pageObj: any, pageW: number, pageH: number, fill: string): void {
  pageObj.set?.({
    width: pageW,
    height: pageH,
    left: 0,
    top: 0,
    originX: "left",
    originY: "top",
    scaleX: 1,
    scaleY: 1,
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
    excludeFromExport: false,
  });
  pageObj.role = "pageBackground";
  pageObj.name = "Page Background";
  pageObj.set?.("isPageBg", true);
  if (!pageObj.data) pageObj.data = {};
  pageObj.data.role = "pageBackground";
  pageObj.data.kind = "page-bg";
  pageObj.data.system = true;
  pageObj.setCoords?.();
}

export function ensurePageBackground(c: Canvas, pageW: number, pageH: number, fill: string): any {
  c.set({ backgroundColor: CANVAS_BG });
  let pageObj = findPageObject(c, pageW, pageH);
  const shouldReplace = !pageObj || !(pageObj instanceof Rect) || typeof pageObj?.set !== "function";
  if (pageObj && shouldReplace) {
    try {
      c.remove(pageObj);
    } catch {
      /* ignore */
    }
    pageObj = null;
  }
  if (!pageObj) {
    pageObj = new Rect({
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
      excludeFromExport: false,
    });
    c.add(pageObj);
  } else {
    applyPageBackgroundProps(pageObj, pageW, pageH, fill);
    if (!c.getObjects().includes(pageObj)) {
      c.add(pageObj);
    }
  }
  if ((c as any).sendToBack) {
    (c as any).sendToBack(pageObj);
  } else if (pageObj.moveTo) {
    pageObj.moveTo(0);
  }
  return pageObj;
}

export function normalizeTemplateScale(c: Canvas, targetW: number, targetH: number): void {
  const allObjs = c.getObjects?.() || [];
  const biggest = allObjs
    .map((o: any) => {
      const w = o?.getScaledWidth?.() ?? o?.width ?? 0;
      const h = o?.getScaledHeight?.() ?? o?.height ?? 0;
      return { o, w: Number(w) || 0, h: Number(h) || 0, a: (Number(w) || 0) * (Number(h) || 0) };
    })
    .filter((x) => x.o && x.w > 0 && x.h > 0)
    .sort((a, b) => b.a - a.a)[0];

  if (!biggest || biggest.w <= targetW * 1.5 || biggest.h <= targetH * 1.5) return;

  const s = Math.min(targetW / biggest.w, targetH / biggest.h);
  for (const o of allObjs) {
    if (!o) continue;
    o.set?.({
      left: Number(o.left ?? 0) * s,
      top: Number(o.top ?? 0) * s,
      scaleX: Number(o.scaleX ?? 1) * s,
      scaleY: Number(o.scaleY ?? 1) * s,
    });
    o.setCoords?.();
  }

  const bgLeft = Number(biggest.o.left ?? 0);
  const bgTop = Number(biggest.o.top ?? 0);
  if (bgLeft || bgTop) {
    for (const o of allObjs) {
      if (!o) continue;
      o.set?.({
        left: Number(o.left ?? 0) - bgLeft,
        top: Number(o.top ?? 0) - bgTop,
      });
      o.setCoords?.();
    }
  }
}

function walkCanvasObjects(objects: any[], visitor: (obj: any) => void): void {
  for (const obj of objects) {
    visitor(obj);
    const nested = (obj as any)?._objects ?? obj?.getObjects?.() ?? [];
    if (Array.isArray(nested) && nested.length > 0) {
      walkCanvasObjects(nested, visitor);
    }
  }
}

/** Phase 1: only text objects are tappable; everything else is locked. */
export function applyMobileInteractionLocks(c: Canvas, pageW: number, pageH: number): void {
  c.selection = false;
  c.skipTargetFind = false;
  (c as any).interactive = true;

  const visit = (obj: any) => {
    if (!obj) return;
    ensureObjectId(obj);
    applyTextBoxNoStretch(obj);

    if (isPageBackgroundObject(obj, pageW, pageH) || obj?.role === "grid") {
      obj.set?.({
        selectable: false,
        evented: false,
        hasControls: false,
        hasBorders: false,
      });
      return;
    }

    const type = String(obj.type || "").toLowerCase();
    if (type === "group") {
      obj.set?.({
        selectable: false,
        evented: false,
        hasControls: false,
        hasBorders: false,
        subTargetCheck: true,
        interactive: true,
      });
      return;
    }

    if (isTextObject(obj)) {
      obj.set?.({
        selectable: false,
        evented: true,
        hasControls: false,
        hasBorders: false,
        lockMovementX: true,
        lockMovementY: true,
        lockScalingX: true,
        lockScalingY: true,
        lockRotation: true,
        hoverCursor: "text",
      });
      return;
    }

    obj.set?.({
      selectable: false,
      evented: false,
      hasControls: false,
      hasBorders: false,
      lockMovementX: true,
      lockMovementY: true,
      lockScalingX: true,
      lockScalingY: true,
      lockRotation: true,
    });
  };

  walkCanvasObjects(c.getObjects(), visit);
  c.discardActiveObject();
}

export type FitCanvasResult = {
  scaledW: number;
  scaledH: number;
};

/**
 * Fit the resume page to the mobile viewport width (with padding).
 * Uses CSS-only canvas scaling so the DOM element matches the visible page size
 * and stays horizontally centered without horizontal scroll.
 */
export function fitCanvasToViewport(
  c: Canvas,
  containerWidth: number,
  pageBounds: { left: number; top: number; width: number; height: number }
): FitCanvasResult {
  const padding = 16;
  const availW = Math.max(1, containerWidth - padding * 2);
  const pageW = Math.max(1, pageBounds.width);
  const pageH = Math.max(1, pageBounds.height);
  const z = availW / pageW;
  const scaledW = Math.round(availW);
  const scaledH = Math.round(pageH * z);

  c.setViewportTransform([1, 0, 0, 1, 0, 0]);
  c.setDimensions({ width: scaledW, height: scaledH }, { cssOnly: true });
  c.calcOffset?.();
  c.requestRenderAll();

  return { scaledW, scaledH };
}

export function getPageBounds(c: Canvas, pageSize: PageSize = "A4") {
  const fallback = PAGE_SIZES[pageSize];
  const pageObj = findPageObject(c, fallback.w, fallback.h);
  if (pageObj) {
    const left = pageObj.left ?? 0;
    const top = pageObj.top ?? 0;
    const width = pageObj.getScaledWidth?.() ?? pageObj.width ?? fallback.w;
    const height = pageObj.getScaledHeight?.() ?? pageObj.height ?? fallback.h;
    return { left, top, width, height, fabricObj: pageObj };
  }
  return { left: 0, top: 0, width: fallback.w, height: fallback.h, fabricObj: null };
}

export async function loadSnapshotOntoCanvas(
  c: Canvas,
  snap: any,
  pageW: number,
  pageH: number,
  opts?: { isTemplateLoad?: boolean }
): Promise<void> {
  const json = normalizeToFabricJson(snap);
  if (!json || !Array.isArray(json.objects)) {
    throw new Error("Invalid template JSON: expected { objects: [] }");
  }
  sanitizeImageSourcesForLoad(json);

  await new Promise<void>((resolve, reject) => {
    try {
      const result = (c as any).loadFromJSON(json, undefined, () => resolve());
      if (result && typeof result.then === "function") {
        result.then(() => resolve()).catch(reject);
      }
    } catch (err) {
      reject(err);
    }
  });

  const allBefore = c.getObjects();
  allBefore.forEach((o: any) => {
    ensureObjectId(o);
    applyTextBoxNoStretch(o);
  });

  if (opts?.isTemplateLoad !== false) {
    normalizeTemplateScale(c, pageW, pageH);
  }

  const pageObj = findPageObject(c, pageW, pageH);
  const jsonAny = json as { objects: any[]; background?: string };
  const fill =
    (pageObj?.fill as string) ||
    (typeof jsonAny.background === "string" ? jsonAny.background : "#ffffff");
  ensurePageBackground(c, pageW, pageH, fill || "#ffffff");
  applyMobileInteractionLocks(c, pageW, pageH);
  c.requestRenderAll();
}

export function serializeCanvasForSave(c: Canvas): any {
  return (c as any).toJSON([...FABRIC_JSON_PROPS]);
}
