/**
 * Offscreen Fabric export for resume list thumbnails (first page only).
 * Does not use the editor hook or live canvases.
 */

import { Canvas } from "fabric";
import { initFabricCanvas } from "@/lib/editor/canvasInitializer";
import type { PageSize } from "@/types/editor";
import { PAGE_SIZES } from "@/types/editor";

const THUMBNAIL_FALLBACK_IMAGE_SRC = "/templates/avatar-placeholder.png";

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

function walkFabricTree(root: any, onNode: (node: any) => void): void {
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

function sanitizeThumbnailJson(json: any): void {
  walkFabricTree(json, (node) => {
    const type = String((node as any)?.type || "").toLowerCase();
    if (type !== "image") return;
    const src = String((node as any)?.src || "").trim();
    if (!src || src.toLowerCase().startsWith("blob:") || !isPortableImageSrc(src)) {
      (node as any).src = THUMBNAIL_FALLBACK_IMAGE_SRC;
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

  sanitizeThumbnailJson(json);

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
    try {
      c.renderAll();
      const fallbackDataUrl = c.toDataURL({
        format: "png",
        multiplier: 0.25,
      } as any);
      return typeof fallbackDataUrl === "string" ? fallbackDataUrl : "";
    } catch {
      return "";
    }
  } finally {
    try {
      c.dispose();
    } catch {
      /* ignore */
    }
  }
}
