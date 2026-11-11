/**
 * Pure save/load decisions for the phone resume editor.
 * Desktop serialization stays in resumeDocs.ts and useFabricEditor.ts.
 */

const TEMPLATE_IMAGE_FALLBACK = "/templates/t004.png";

export type MobileCommitDecision = "write" | "stale";

export function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

export function updatedAtToken(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "object") {
    const millis = (value as { toMillis?: () => number }).toMillis;
    if (typeof millis === "function") {
      const parsed = millis.call(value);
      if (Number.isFinite(parsed)) return String(parsed);
    }
    const seconds = (value as { seconds?: number }).seconds;
    const nanoseconds = (value as { nanoseconds?: number }).nanoseconds;
    if (typeof seconds === "number" && Number.isFinite(seconds)) {
      return `${seconds}:${typeof nanoseconds === "number" ? nanoseconds : 0}`;
    }
  }
  return null;
}

/**
 * A phone write is stale when the cloud revision moved, including backwards.
 * Desktop increments a counter and an already-open laptop can save a smaller
 * number with a new timestamp. A different timestamp at the same revision is
 * also stale. The cloud document is left untouched.
 */
export function mobileCommitDecision(
  storedRevision: unknown,
  baseRevision: number | null,
  storedUpdatedAt?: unknown,
  baseUpdatedAt?: string | null
): MobileCommitDecision {
  if (baseRevision == null) return "write";
  if (typeof storedRevision === "number" && Number.isFinite(storedRevision)) {
    if (storedRevision !== baseRevision) return "stale";
  }
  const storedToken = updatedAtToken(storedUpdatedAt);
  if (baseUpdatedAt && storedToken && storedToken !== baseUpdatedAt) return "stale";
  return "write";
}

export function nextMobileRevision(storedRevision: unknown): number {
  const previous =
    typeof storedRevision === "number" && Number.isFinite(storedRevision) ? storedRevision : 0;
  return previous + 1;
}

function asObjects(snapshot: any): any[] {
  if (!snapshot || typeof snapshot !== "object") return [];
  return Array.isArray(snapshot.objects) ? snapshot.objects : [];
}

function imageNodes(snapshot: any): any[] {
  return asObjects(snapshot).filter(
    (obj) => obj && String(obj.type || "").toLowerCase() === "image"
  );
}

function assetIdOf(node: any): string {
  return String(
    node?.slbAssetId || node?.data?.slbAssetId || node?.customData?.slbAssetId || ""
  ).trim();
}

function imageKey(node: any, index: number): string {
  const id = String(node?.slbId || node?.data?.id || "").trim();
  if (id) return `id:${id}`;
  const assetId = assetIdOf(node);
  if (assetId) return `asset:${assetId}:${index}`;
  return `index:${index}`;
}

function restoreImageFields(target: any, source: any): void {
  if (typeof source.src === "string") target.src = source.src;
  if (source.slbAssetId != null) target.slbAssetId = source.slbAssetId;
  if (source.slbSource != null) target.slbSource = source.slbSource;
  if (source.data && typeof source.data === "object") {
    target.data = { ...(target.data || {}), ...source.data };
  }
}

/**
 * Keep saved image identity. A display blob URL must not replace the stored
 * source, and a missing photo must not be swapped for a template image.
 */
export function mergePreservedImages(serialized: any, serverPage: any): any {
  const next = cloneJson(serialized || { objects: [] });
  if (!serverPage || typeof serverPage !== "object") return next;
  if (!Array.isArray(next.objects)) next.objects = [];

  const serverImages = imageNodes(serverPage);
  const serverByKey = new Map<string, any>();
  serverImages.forEach((image, index) => {
    serverByKey.set(imageKey(image, index), image);
  });

  const seen = new Set<string>();
  let imageIndex = 0;
  next.objects = next.objects.map((obj: any) => {
    if (!obj || String(obj.type || "").toLowerCase() !== "image") return obj;
    const key = imageKey(obj, imageIndex);
    imageIndex += 1;
    const source = serverByKey.get(key) || serverImages[imageIndex - 1];
    if (!source) {
      if (String(obj.src || "") === TEMPLATE_IMAGE_FALLBACK && assetIdOf(obj)) {
        return obj;
      }
      return obj;
    }
    seen.add(imageKey(source, serverImages.indexOf(source)));
    const src = String(obj.src || "").trim().toLowerCase();
    const unsafe =
      !src ||
      src.startsWith("blob:") ||
      src.startsWith("data:") ||
      src === TEMPLATE_IMAGE_FALLBACK;
    if (unsafe || assetIdOf(source)) restoreImageFields(obj, source);
    return obj;
  });

  serverImages.forEach((image, index) => {
    const key = imageKey(image, index);
    if (seen.has(key)) return;
    next.objects.push(cloneJson(image));
  });

  return next;
}

export function savedPagePixelSize(snapshot: any): { w: number; h: number } {
  const objects = asObjects(snapshot);
  const sized = objects
    .map((obj) => {
      const width = Math.abs(Number(obj?.width) || 0) * Math.abs(Number(obj?.scaleX) || 1);
      const height = Math.abs(Number(obj?.height) || 0) * Math.abs(Number(obj?.scaleY) || 1);
      return { obj, width, height };
    })
    .filter((item) => item.width > 100 && item.height > 100);
  const background = sized.find((item) => {
    const role = String(item.obj?.role || item.obj?.data?.role || item.obj?.data?.kind || "");
    return (
      role === "pageBackground" ||
      role === "page-bg" ||
      role === "page" ||
      item.obj?.isPageBg === true ||
      item.obj?.name === "Page Background"
    );
  });
  const chosen =
    background ||
    sized.find(
      (item) =>
        String(item.obj?.type || "").toLowerCase() === "rect" &&
        Math.abs(Number(item.obj?.left) || 0) <= 2 &&
        Math.abs(Number(item.obj?.top) || 0) <= 2
    );
  if (!chosen) return { w: 794, h: 1123 };
  return { w: Math.round(chosen.width), h: Math.round(chosen.height) };
}

export function pagesFromResumeRecord(record: {
  pagesData?: any[] | null;
  canvasJson?: any;
}): { shape: "pages" | "canvas"; pages: any[] } {
  if (Array.isArray(record.pagesData) && record.pagesData.length > 0) {
    return { shape: "pages", pages: record.pagesData.map((page) => cloneJson(page)) };
  }
  let canvas = record.canvasJson;
  if (typeof canvas === "string") {
    try {
      canvas = JSON.parse(canvas);
    } catch {
      canvas = { objects: [] };
    }
  }
  if (!canvas || typeof canvas !== "object") canvas = { objects: [] };
  return { shape: "canvas", pages: [cloneJson(canvas)] };
}

export function mobileSavePayload(input: {
  shape: "pages" | "canvas";
  serverPages: any[];
  activeIndex: number;
  activeJson: any;
}): { canvasJson?: any; pagesData?: any[] } {
  const pages = input.serverPages.map((page, index) => {
    if (index !== input.activeIndex) return cloneJson(page);
    return mergePreservedImages(input.activeJson, page);
  });
  if (input.shape === "pages") {
    const payload: { canvasJson?: any; pagesData: any[] } = { pagesData: pages };
    if (pages.length === 1) payload.canvasJson = cloneJson(pages[0]);
    return payload;
  }
  return { canvasJson: pages[0] || { objects: [] } };
}

export function resumeHasLocalOnlyImage(snapshot: any): boolean {
  return imageNodes(snapshot).some((image) => {
    const src = String(image?.src || "").trim().toLowerCase();
    const assetId = assetIdOf(image);
    if (!assetId && !src.startsWith("blob:")) return false;
    if (src.startsWith("http://") || src.startsWith("https://") || src.startsWith("/")) return false;
    return true;
  });
}
