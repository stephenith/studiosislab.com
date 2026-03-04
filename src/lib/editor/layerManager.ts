/**
 * Layer operations: list layers, bring forward/send backward, delete.
 * Keeps background rect locked at bottom.
 */

import type { Canvas } from "fabric";
import type { LayerItem } from "@/types/editor";

export interface GetLayersOptions {
  isPageBackground?: (obj: any) => boolean;
  getDisplayName?: (obj: any) => string;
  ensureId?: (obj: any) => string | null;
}

/**
 * Build layer list from canvas objects (excluding grid and page background).
 */
export function getLayers(
  canvas: Canvas,
  options: GetLayersOptions = {}
): LayerItem[] {
  const {
    isPageBackground = () => false,
    getDisplayName = (o) => (o?.type || "Layer").toString(),
    ensureId = (o) => o?.id ?? o?.uid ?? null,
  } = options;
  const objs = canvas.getObjects?.() ?? [];
  const size = { w: 0, h: 0 };
  const normalObjs = objs.filter(
    (o: any) => o?.role !== "grid" && !isPageBackground(o)
  );
  const typeCounts: Record<string, number> = {};
  return normalObjs
    .map((o: any, idx: number) => {
      const base = getDisplayName(o);
      const typeKey = String(base).toLowerCase();
      typeCounts[typeKey] = (typeCounts[typeKey] || 0) + 1;
      const numbered = `${base} ${typeCounts[typeKey]}`;
      const displayName = (o as any).name || numbered;
      return {
        id: ensureId(o) || `__idx_${idx}`,
        type: o.type || "object",
        visible: o.visible !== false,
        locked: !!(o.lockMovementX || o.lockMovementY || o.selectable === false),
        displayName,
        index: idx,
        objectRef: o,
      };
    })
    .reverse();
}

/**
 * Move object one step forward in stack.
 */
export function bringForward(canvas: Canvas, object: any): void {
  if (!canvas || !object) return;
  const objs = canvas.getObjects?.() ?? [];
  const idx = objs.indexOf(object);
  if (idx < 0 || idx >= objs.length - 1) return;
  if (canvas.moveObjectTo) {
    canvas.moveObjectTo(object, idx + 1);
  } else {
    object.moveTo?.(idx + 1);
  }
  canvas.requestRenderAll();
}

/**
 * Move object one step backward in stack.
 */
export function sendBackward(canvas: Canvas, object: any): void {
  if (!canvas || !object) return;
  const objs = canvas.getObjects?.() ?? [];
  const idx = objs.indexOf(object);
  if (idx <= 0) return;
  if (canvas.moveObjectTo) {
    canvas.moveObjectTo(object, idx - 1);
  } else {
    object.moveTo?.(idx - 1);
  }
  canvas.requestRenderAll();
}

/**
 * Remove object from canvas.
 */
export function deleteObject(canvas: Canvas, object: any): void {
  if (!canvas || !object) return;
  canvas.remove(object);
  canvas.discardActiveObject?.();
  canvas.requestRenderAll();
}
