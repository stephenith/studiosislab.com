/**
 * Pure first-page thumbnail preparation.
 * Does not touch a live editor canvas, Firestore, or Resume Template files.
 */

export type ThumbnailPageSize = "A4" | "Letter" | "Custom";

export const THUMBNAIL_PAGE_SIZES: Record<ThumbnailPageSize, { w: number; h: number }> = {
  A4: { w: 794, h: 1123 },
  Letter: { w: 816, h: 1056 },
  Custom: { w: 794, h: 1123 },
};

/** Compact card image. Stays well under the Firestore 1MB document limit. */
export const THUMBNAIL_TARGET_WIDTH = 280;
export const THUMBNAIL_MAX_DATA_URL_CHARS = 900_000;

/** Invisible stand-in so an unloadable local image does not blank the rest of the page. */
export const THUMBNAIL_OMITTED_IMAGE_SRC =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=";

export function selectFirstPageSnapshot(input: {
  pagesData?: unknown;
  canvasJson?: unknown;
}): any | null {
  if (Array.isArray(input.pagesData) && input.pagesData.length > 0) {
    const first = input.pagesData[0];
    return first && typeof first === "object" ? first : null;
  }
  if (typeof input.canvasJson === "string") {
    try {
      const parsed = JSON.parse(input.canvasJson);
      return parsed && typeof parsed === "object" ? parsed : null;
    } catch {
      return null;
    }
  }
  if (input.canvasJson && typeof input.canvasJson === "object") return input.canvasJson;
  return null;
}

export function isGridJsonObject(obj: any): boolean {
  if (!obj || typeof obj !== "object") return false;
  return obj.role === "grid" || obj.data?.role === "grid";
}

export function isPageBackgroundJson(obj: any, pageW?: number, pageH?: number): boolean {
  if (!obj || typeof obj !== "object") return false;
  if (obj?.data?.role === "pageBackground") return true;
  if (obj?.role === "pageBackground" || obj?.role === "page-bg" || obj?.role === "page") return true;
  if (obj?.data?.kind === "page-bg" || obj?.isPageBg === true) return true;
  const name = typeof obj?.name === "string" ? obj.name.toLowerCase().trim() : "";
  if (name === "page background" || name === "page-bg") return true;
  const id = obj?.id || obj?.data?.id;
  if (id === "page_bg") return true;
  if (String(obj?.type || "").toLowerCase() === "rect" && pageW && pageH) {
    const left = Number(obj.left ?? 0);
    const top = Number(obj.top ?? 0);
    const w = Math.abs(Number(obj.width) || 0) * Math.abs(Number(obj.scaleX) || 1);
    const h = Math.abs(Number(obj.height) || 0) * Math.abs(Number(obj.scaleY) || 1);
    if (Math.abs(left) <= 2 && Math.abs(top) <= 2 && Math.abs(w - pageW) < 2 && Math.abs(h - pageH) < 2) {
      return true;
    }
  }
  return false;
}

export function isPortableThumbnailImageSrc(src: string): boolean {
  const normalized = String(src || "").trim().toLowerCase();
  if (!normalized) return false;
  if (normalized.startsWith("data:")) return true;
  if (normalized.startsWith("http://") || normalized.startsWith("https://")) return true;
  if (normalized.startsWith("/") && !normalized.startsWith("//")) return true;
  return false;
}

/** Same fields the editor reads when it reloads a local upload. */
export function localAssetIdFromJson(node: any): string {
  const candidates = [
    node?.slbAssetId,
    node?.data?.slbAssetId,
    node?.customData?.slbAssetId,
    node?.metadata?.slbAssetId,
  ];
  return String(candidates.find((value) => String(value || "").trim().length > 0) || "").trim();
}

function scaledBox(obj: any): { w: number; h: number } {
  return {
    w: Math.abs(Number(obj?.width) || 0) * Math.abs(Number(obj?.scaleX) || 1),
    h: Math.abs(Number(obj?.height) || 0) * Math.abs(Number(obj?.scaleY) || 1),
  };
}

function omitUnavailableImages(node: any): void {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) {
    for (const item of node) omitUnavailableImages(item);
    return;
  }
  const type = String(node.type || "").toLowerCase();
  if (type === "image") {
    const src = String(node.src || "").trim();
    const assetId = localAssetIdFromJson(node);
    if (assetId && !isPortableThumbnailImageSrc(src)) {
      // The saved src is often a dead blob URL. Keep the asset id so the
      // current browser can load the IndexedDB blob before rendering.
    } else if (!isPortableThumbnailImageSrc(src)) {
      node.src = THUMBNAIL_OMITTED_IMAGE_SRC;
      node.opacity = 0;
    } else if (src.toLowerCase().startsWith("http://") || src.toLowerCase().startsWith("https://")) {
      node.crossOrigin = "anonymous";
    }
  }
  if (Array.isArray(node.objects)) omitUnavailableImages(node.objects);
}

export type PreparedThumbnail = {
  objects: any[];
  width: number;
  height: number;
  /** True when the page has no content besides the page background. */
  empty: boolean;
};

export function prepareFirstPageThumbnailJson(
  snapshot: any,
  pageSize: ThumbnailPageSize = "A4"
): PreparedThumbnail {
  const target = THUMBNAIL_PAGE_SIZES[pageSize] ?? THUMBNAIL_PAGE_SIZES.A4;
  const cloned = snapshot ? JSON.parse(JSON.stringify(snapshot)) : { objects: [] };
  const rawObjects = Array.isArray(cloned.objects) ? cloned.objects : [];
  const objects = rawObjects.filter((obj: any) => {
    if (!obj || typeof obj !== "object") return false;
    if (isGridJsonObject(obj)) return false;
    const role = String(obj?.role || obj?.data?.role || "").toLowerCase();
    if (role === "image-crop-rect" || role === "image-crop-dim") return false;
    if (obj.excludeFromExport === true && !isPageBackgroundJson(obj, target.w, target.h)) return false;
    return true;
  });
  omitUnavailableImages(objects);

  const bounds = savedDocumentPageBounds(cloned, objects, target);
  const empty = !objects.some(
    (obj: any) => !isPageBackgroundJson(obj, bounds.w, bounds.h) && !isGridJsonObject(obj)
  );
  return {
    objects,
    width: bounds.w,
    height: bounds.h,
    empty,
  };
}

/**
 * Page box for a saved document. Object coordinates are not rewritten.
 * Template-load scaling stays in the editor and is not applied here.
 */
function savedDocumentPageBounds(
  snapshot: any,
  objects: any[],
  nominal: { w: number; h: number }
): { w: number; h: number } {
  const background =
    objects.find((obj: any) => isPageBackgroundJson(obj)) ||
    objects.find((obj: any) => isPageBackgroundJson(obj, nominal.w, nominal.h));
  if (background) {
    const box = scaledBox(background);
    if (box.w > 2 && box.h > 2) return { w: box.w, h: box.h };
  }

  const originPaper = objects.filter((obj: any) => {
    if (String(obj?.type || "").toLowerCase() !== "rect") return false;
    const left = Number(obj.left ?? 0);
    const top = Number(obj.top ?? 0);
    const box = scaledBox(obj);
    return Math.abs(left) <= 2 && Math.abs(top) <= 2 && box.w > nominal.w * 1.5 && box.h > nominal.h * 1.5;
  });
  if (originPaper.length === 1) return scaledBox(originPaper[0]);

  const snapW = Number(snapshot?.width);
  const snapH = Number(snapshot?.height);
  if (snapW > 2 && snapH > 2) return { w: snapW, h: snapH };
  return { w: nominal.w, h: nominal.h };
}

/** A slower thumbnail for an older revision must not replace a newer one. */
export function incomingThumbnailMayReplace(storedRevision: unknown, incomingRevision: number): boolean {
  if (!Number.isFinite(incomingRevision)) return false;
  if (typeof storedRevision !== "number" || !Number.isFinite(storedRevision)) return true;
  return incomingRevision >= storedRevision;
}

/** The stored preview has to be the current saved content revision. */
export function thumbnailMatchesSavedRevision(storedContentRevision: unknown, incomingRevision: number): boolean {
  if (!Number.isFinite(incomingRevision)) return false;
  if (typeof storedContentRevision !== "number" || !Number.isFinite(storedContentRevision)) return true;
  return incomingRevision === storedContentRevision;
}
