/**
 * Offscreen Fabric export for resume list thumbnails (first page only).
 * Does not use the editor hook or live canvases.
 */

import { Canvas } from "fabric";
import { initFabricCanvas } from "@/lib/editor/canvasInitializer";
import type { PageSize } from "@/types/editor";
import { PAGE_SIZES } from "@/types/editor";

function loadFromJsonPromise(canvas: Canvas, json: unknown): Promise<void> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      resolve();
    };
    try {
      const result = (canvas as any).loadFromJSON(json, undefined, done);
      if (result && typeof result.then === "function") {
        result
          .then(() => {
            if (!settled) done();
          })
          .catch(reject);
      }
    } catch (e) {
      reject(e);
    }
  });
}

export async function generateResumeThumbnail(params: {
  pagesData?: any[] | null;
  canvasJson?: any;
  pageSize?: PageSize;
}): Promise<string> {
  const { pagesData, canvasJson, pageSize = "A4" } = params;
  if (typeof document === "undefined") return "";

  const fallback = PAGE_SIZES[pageSize] ?? PAGE_SIZES.A4;

  let json: any = null;
  if (Array.isArray(pagesData) && pagesData.length > 0) {
    json = { ...pagesData[0] };
  } else if (canvasJson != null) {
    json =
      typeof canvasJson === "string"
        ? JSON.parse(canvasJson)
        : { ...canvasJson };
  }

  if (!json || !Array.isArray(json.objects)) {
    return "";
  }

  const w =
    typeof json.width === "number" && Number.isFinite(json.width) && json.width > 0
      ? json.width
      : fallback.w;
  const h =
    typeof json.height === "number" && Number.isFinite(json.height) && json.height > 0
      ? json.height
      : fallback.h;

  const el = document.createElement("canvas");
  const bg =
    typeof json.background === "string" && json.background.length > 0
      ? json.background
      : "#ffffff";

  const c = initFabricCanvas(el, {
    width: w,
    height: h,
    backgroundColor: bg,
    selection: false,
    preserveObjectStacking: true,
  });

  try {
    await loadFromJsonPromise(c, json);
    c.renderAll();
    const dataUrl = c.toDataURL({
      format: "png",
      multiplier: 0.25,
    } as any);
    return typeof dataUrl === "string" ? dataUrl : "";
  } catch (e) {
    console.warn("[generateResumeThumbnail]", e);
    return "";
  } finally {
    try {
      c.dispose();
    } catch {
      /* ignore */
    }
  }
}
