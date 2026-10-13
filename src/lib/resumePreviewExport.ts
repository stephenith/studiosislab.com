/**
 * Offscreen Fabric export for resume list thumbnails (first page only).
 * Does not use the editor hook or live canvases.
 */

import { Canvas } from "fabric";
import { ensureFontLoaded } from "@/lib/fonts/fontLoader";
import { getAsset } from "@/lib/localAssets";
import {
  isPortableThumbnailImageSrc,
  localAssetIdFromJson,
  prepareFirstPageThumbnailJson,
  selectFirstPageSnapshot,
  THUMBNAIL_OMITTED_IMAGE_SRC,
  THUMBNAIL_PAGE_SIZES,
  THUMBNAIL_TARGET_WIDTH,
  type ThumbnailPageSize,
} from "@/lib/resumePreviewScene";

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

function collectFontFamilies(nodes: any[], into: Set<string>): void {
  for (const node of nodes || []) {
    if (!node || typeof node !== "object") continue;
    const family = typeof node.fontFamily === "string" ? node.fontFamily.trim() : "";
    if (family) into.add(family);
    if (Array.isArray(node.objects)) collectFontFamilies(node.objects, into);
  }
}

async function loadThumbnailFonts(objects: any[]): Promise<void> {
  const families = new Set<string>();
  collectFontFamilies(objects, families);
  if (!families.size || typeof document === "undefined") return;
  try {
    const catalogMod = await import("@/data/fonts/catalog.json");
    const catalog = (catalogMod.default || catalogMod) as Array<{
      family: string;
      variants: Array<{ weight: number; style: "normal" | "italic"; fileUrl?: string }>;
    }>;
    await Promise.all(
      [...families].map(async (family) => {
        const font = catalog.find((item) => item.family === family);
        const variant =
          font?.variants?.find((item) => item.weight === 400 && item.style === "normal") ||
          font?.variants?.[0];
        if (!variant) return;
        await ensureFontLoaded(family, variant);
      })
    );
  } catch {
    // The preview still draws with the browser's fallback font.
  }
}

function pageExportBounds(canvas: Canvas, pageW: number, pageH: number): {
  left: number;
  top: number;
  width: number;
  height: number;
} {
  const objects = canvas.getObjects?.() || [];
  const page = objects.find((obj: any) => {
    const role = obj?.role || obj?.data?.role;
    return role === "pageBackground" || role === "page-bg" || role === "page" || obj?.isPageBg === true;
  }) as any;
  if (page?.getBoundingRect) {
    const rect = page.getBoundingRect(true, true);
    if (rect?.width > 1 && rect?.height > 1) {
      return {
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height,
      };
    }
  }
  return { left: 0, top: 0, width: pageW, height: pageH };
}

async function hydrateLocalThumbnailImages(nodes: any[]): Promise<string[]> {
  const created: string[] = [];
  const walk = async (node: any): Promise<void> => {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) {
      for (const item of node) await walk(item);
      return;
    }
    if (String(node.type || "").toLowerCase() === "image") {
      const assetId = localAssetIdFromJson(node);
      const src = String(node.src || "").trim();
      if (assetId && !isPortableThumbnailImageSrc(src)) {
        let blob: Blob | null = null;
        try {
          blob = await getAsset(assetId);
        } catch {
          blob = null;
        }
        if (blob && typeof URL !== "undefined" && typeof URL.createObjectURL === "function") {
          const url = URL.createObjectURL(blob);
          node.src = url;
          created.push(url);
        } else {
          node.src = THUMBNAIL_OMITTED_IMAGE_SRC;
          node.opacity = 0;
        }
      }
    }
    if (Array.isArray(node.objects)) await walk(node.objects);
  };
  await walk(nodes);
  return created;
}

function exportPrepared(canvas: Canvas, pageW: number, pageH: number): string {
  canvas.discardActiveObject?.();
  canvas.setViewportTransform?.([1, 0, 0, 1, 0, 0]);
  (canvas as any).setZoom?.(1);
  canvas.renderAll();
  const bounds = pageExportBounds(canvas, pageW, pageH);
  const multiplier = Math.max(0.12, Math.min(0.5, THUMBNAIL_TARGET_WIDTH / Math.max(1, bounds.width)));
  const dataUrl = canvas.toDataURL({
    format: "png",
    left: bounds.left,
    top: bounds.top,
    width: bounds.width,
    height: bounds.height,
    multiplier,
  } as any);
  return typeof dataUrl === "string" ? dataUrl : "";
}

export async function generateResumeThumbnail(params: {
  pagesData?: any[] | null;
  canvasJson?: any;
  pageSize?: ThumbnailPageSize;
}): Promise<string> {
  const pageSize = params.pageSize && THUMBNAIL_PAGE_SIZES[params.pageSize] ? params.pageSize : "A4";
  const snapshot = selectFirstPageSnapshot({
    pagesData: params.pagesData,
    canvasJson: params.canvasJson,
  });
  if (!snapshot || typeof document === "undefined") return "";

  const prepared = prepareFirstPageThumbnailJson(snapshot, pageSize);
  const localUrls = await hydrateLocalThumbnailImages(prepared.objects);
  const el = document.createElement("canvas");
  const canvas = new Canvas(el, {
    width: prepared.width,
    height: prepared.height,
    backgroundColor: "#ffffff",
    selection: false,
    preserveObjectStacking: true,
  } as any);

  try {
    await loadThumbnailFonts(prepared.objects);
    await loadFromJsonPromise(canvas, { objects: prepared.objects });
    try {
      return exportPrepared(canvas, prepared.width, prepared.height);
    } catch {
      const images = (canvas.getObjects?.() || []).filter(
        (obj: any) => String(obj?.type || "").toLowerCase() === "image"
      );
      if (!images.length) return "";
      images.forEach((obj: any) => canvas.remove(obj));
      return exportPrepared(canvas, prepared.width, prepared.height);
    }
  } catch (e) {
    console.warn("[generateResumeThumbnail]", e);
    return "";
  } finally {
    for (const url of localUrls) {
      try {
        URL.revokeObjectURL(url);
      } catch {
        /* ignore */
      }
    }
    try {
      canvas.dispose();
    } catch {
      /* ignore */
    }
  }
}
