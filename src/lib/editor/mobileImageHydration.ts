/**
 * Phone-only local image rehydrate and export pixel bind.
 * IndexedDB assets stay on this browser. Dead blob: URLs must not reach Fabric loadFromJSON.
 * Offscreen export clones may lose decoded pixels after blob: revoke; bind live elements instead.
 */

export const PHONE_MISSING_IMAGE_ROLE = "slb-missing-local-image";

const TRANSPARENT_PNG = Uint8Array.from(
  atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="),
  (char) => char.charCodeAt(0)
);

export function assetIdOfImage(node: any): string {
  return String(node?.slbAssetId || node?.data?.slbAssetId || "").trim();
}

export function isUnsafeFabricImageSrc(src: unknown): boolean {
  const value = String(src || "").trim().toLowerCase();
  if (!value) return true;
  return value.startsWith("blob:");
}

function walk(node: any, visit: (image: any) => void): void {
  if (!node) return;
  if (Array.isArray(node)) {
    node.forEach((item) => walk(item, visit));
    return;
  }
  if (typeof node !== "object") return;
  if (String(node.type || "").toLowerCase() === "image") visit(node);
  if (Array.isArray(node.objects)) walk(node.objects, visit);
  const nested = typeof node.getObjects === "function" ? node.getObjects() : node._objects;
  if (Array.isArray(nested) && nested !== node.objects) walk(nested, visit);
}

function markMissing(node: any, assetId: string, placeholderSrc: string): void {
  node.src = placeholderSrc;
  node.cropX = 0;
  node.cropY = 0;
  if (assetId) {
    node.slbAssetId = assetId;
    const data = node.data && typeof node.data === "object" ? node.data : {};
    node.data = { ...data, slbAssetId: assetId, slbAssetMissing: true };
  } else {
    const data = node.data && typeof node.data === "object" ? node.data : {};
    node.data = { ...data, slbAssetMissing: true };
  }
}

function stripCorsForNonNetworkSrc(image: any): void {
  const src = String(image?.src || "").trim();
  if (!src.startsWith("blob:") && !src.startsWith("data:")) return;
  image.crossOrigin = null;
  delete image.crossOrigin;
}

export const PHONE_EXPORT_IMAGE_WAIT_MS = 4000;
export const PHONE_EXPORT_MISSING_PHOTO_NOTICE =
  "A photo isn't available on this phone, so it was left out of the download. The rest of the resume was saved.";
export const PHONE_EXPORT_LOCAL_IMAGE_FAILED =
  "That photo couldn't be added to the download. The resume wasn't changed. Try Download again.";

export function fabricImageHasDecodedPixels(image: any): boolean {
  const el = image?._element || image?._originalElement;
  const width = Number(el?.naturalWidth ?? el?.width ?? 0);
  const height = Number(el?.naturalHeight ?? el?.height ?? 0);
  return width > 1 && height > 1;
}

export function isMissingPhoneExportImage(image: any): boolean {
  return image?.data?.slbAssetMissing === true;
}

export function phoneExportIdentityKeys(image: any): string[] {
  const keys: string[] = [];
  const objectId = String(image?.id || image?.data?.id || image?.slbId || "").trim();
  if (objectId) keys.push(`id:${objectId}`);
  const assetId = assetIdOfImage(image);
  if (assetId) keys.push(`asset:${assetId}`);
  return keys;
}

function imageSrc(image: any): string {
  if (typeof image?.getSrc === "function") {
    try {
      return String(image.getSrc() || "");
    } catch {
      /* ignore */
    }
  }
  return String(image?.src || "");
}

export function isLocalPhoneExportImage(image: any): boolean {
  if (isMissingPhoneExportImage(image)) return false;
  if (assetIdOfImage(image)) return true;
  const src = imageSrc(image);
  return src.startsWith("blob:") || src.startsWith("data:");
}

export function collectPhoneExportImages(source: any): any[] {
  const images: any[] = [];
  if (!source) return images;
  if (typeof source.getObjects === "function") {
    walk(source.getObjects() || [], (image) => images.push(image));
    return images;
  }
  walk(source, (image) => images.push(image));
  return images;
}

export function indexUniqueDecodedLiveImages(liveImages: any[]): {
  unique: Map<string, any>;
  ambiguous: Set<string>;
} {
  const unique = new Map<string, any>();
  const ambiguous = new Set<string>();
  for (const image of liveImages || []) {
    if (!fabricImageHasDecodedPixels(image)) continue;
    for (const key of phoneExportIdentityKeys(image)) {
      if (ambiguous.has(key)) continue;
      const existing = unique.get(key);
      if (existing && existing !== image) {
        unique.delete(key);
        ambiguous.add(key);
        continue;
      }
      unique.set(key, image);
    }
  }
  return { unique, ambiguous };
}

export function matchUniqueLiveImage(
  exportImage: any,
  index: { unique: Map<string, any>; ambiguous: Set<string> }
): any | null {
  for (const key of phoneExportIdentityKeys(exportImage)) {
    if (index.ambiguous.has(key)) continue;
    const live = index.unique.get(key);
    if (live) return live;
  }
  return null;
}

export function cloneDecodedElementForExport(el: any): any | null {
  if (!fabricImageHasDecodedPixels({ _element: el })) return null;
  if (typeof document === "undefined" || typeof document.createElement !== "function") {
    return el;
  }
  const width = Number(el.naturalWidth ?? el.width ?? 0);
  const height = Number(el.naturalHeight ?? el.height ?? 0);
  try {
    const copy = document.createElement("canvas");
    copy.width = width;
    copy.height = height;
    const ctx = copy.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(el, 0, 0, width, height);
    return copy;
  } catch {
    return null;
  }
}

function captureExportGeometry(image: any) {
  return {
    cropX: image.cropX,
    cropY: image.cropY,
    width: image.width,
    height: image.height,
    left: image.left,
    top: image.top,
    scaleX: image.scaleX,
    scaleY: image.scaleY,
    originX: image.originX,
    originY: image.originY,
    angle: image.angle,
    slbAssetId: image.slbAssetId,
    slbId: image.slbId,
    id: image.id,
    data: image.data,
  };
}

export function applyDecodedElementToExportImage(target: any, element: any): boolean {
  if (!target || !element) return false;
  const geometry = captureExportGeometry(target);
  if (typeof target.setElement === "function") {
    target.setElement(element, { width: geometry.width, height: geometry.height });
  } else {
    target._element = element;
    target._originalElement = element;
  }
  if (typeof target.set === "function") {
    target.set({
      cropX: geometry.cropX,
      cropY: geometry.cropY,
      width: geometry.width,
      height: geometry.height,
      left: geometry.left,
      top: geometry.top,
      scaleX: geometry.scaleX,
      scaleY: geometry.scaleY,
      originX: geometry.originX,
      originY: geometry.originY,
      angle: geometry.angle,
      dirty: true,
    });
  } else {
    target.cropX = geometry.cropX;
    target.cropY = geometry.cropY;
    target.width = geometry.width;
    target.height = geometry.height;
    target.left = geometry.left;
    target.top = geometry.top;
    target.scaleX = geometry.scaleX;
    target.scaleY = geometry.scaleY;
    target.originX = geometry.originX;
    target.originY = geometry.originY;
    target.angle = geometry.angle;
  }
  if (geometry.slbAssetId) target.slbAssetId = geometry.slbAssetId;
  if (geometry.slbId) target.slbId = geometry.slbId;
  if (geometry.id) target.id = geometry.id;
  if (geometry.data) target.data = geometry.data;
  target.setCoords?.();
  return fabricImageHasDecodedPixels(target);
}

export function bindDecodedPhoneExportImages(liveImages: any[], exportImages: any[]): { bound: number; skipped: number } {
  const index = indexUniqueDecodedLiveImages(liveImages);
  let bound = 0;
  let skipped = 0;
  for (const target of exportImages || []) {
    if (isMissingPhoneExportImage(target)) {
      skipped += 1;
      continue;
    }
    const live = matchUniqueLiveImage(target, index);
    if (!live) {
      skipped += 1;
      continue;
    }
    const clone = cloneDecodedElementForExport(live._element || live._originalElement);
    if (!clone) {
      skipped += 1;
      continue;
    }
    if (applyDecodedElementToExportImage(target, clone)) bound += 1;
    else skipped += 1;
  }
  return { bound, skipped };
}

export function phoneExportLocalImagesWithoutPixels(images: any[]): any[] {
  return (images || []).filter((image) => isLocalPhoneExportImage(image) && !fabricImageHasDecodedPixels(image));
}

function waitForOneExportImage(image: any, deadline: number): Promise<void> {
  if (isMissingPhoneExportImage(image) || fabricImageHasDecodedPixels(image)) return Promise.resolve();
  const el = image?._element || image?._originalElement;
  if (!el) return Promise.resolve();
  if (el.complete) return Promise.resolve();
  return new Promise((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      el.removeEventListener?.("load", finish);
      el.removeEventListener?.("error", finish);
      resolve();
    };
    const timer = setTimeout(finish, Math.max(0, deadline - Date.now()));
    el.addEventListener?.("load", finish);
    el.addEventListener?.("error", finish);
  });
}

export async function waitForPhoneExportImages(
  canvas: { getObjects?: () => any[] } | any,
  timeoutMs = PHONE_EXPORT_IMAGE_WAIT_MS
): Promise<void> {
  const deadline = Date.now() + Math.max(0, timeoutMs);
  const images = collectPhoneExportImages(canvas);
  await Promise.all(images.map((image) => waitForOneExportImage(image, deadline)));
}

export async function finalizePhoneExportImages(
  liveCanvas: { getObjects?: () => any[] } | any,
  exportCanvas: { getObjects?: () => any[]; requestRenderAll?: () => void } | any,
  timeoutMs = PHONE_EXPORT_IMAGE_WAIT_MS
): Promise<void> {
  const liveImages = collectPhoneExportImages(liveCanvas);
  bindDecodedPhoneExportImages(liveImages, collectPhoneExportImages(exportCanvas));
  await waitForPhoneExportImages(exportCanvas, timeoutMs);
  bindDecodedPhoneExportImages(liveImages, collectPhoneExportImages(exportCanvas));
  exportCanvas?.requestRenderAll?.();
  const pending = phoneExportLocalImagesWithoutPixels(collectPhoneExportImages(exportCanvas));
  if (pending.length) throw new Error(PHONE_EXPORT_LOCAL_IMAGE_FAILED);
}

export function shouldPaintPhoneExportImage(image: any): boolean {
  return !isMissingPhoneExportImage(image) && fabricImageHasDecodedPixels(image);
}

function elementRgba(el: any): { data: Uint8ClampedArray; width: number; height: number } | null {
  const width = Number(el?.naturalWidth ?? el?.width ?? 0);
  const height = Number(el?.naturalHeight ?? el?.height ?? 0);
  if (!(width > 0 && height > 0)) return null;
  if (el?.rgba && el.rgba.length >= width * height * 4) {
    return { data: el.rgba, width, height };
  }
  if (typeof el?.getContext === "function") {
    try {
      const ctx = el.getContext("2d");
      const pixels = ctx?.getImageData?.(0, 0, width, height);
      if (pixels?.data) return { data: pixels.data, width, height };
    } catch {
      return null;
    }
  }
  return null;
}

/** Source rectangle Fabric `_renderFill` samples from the decoded element. */
export function fabricImageSourceRect(
  image: any,
  elementWidth: number,
  elementHeight: number
): { sX: number; sY: number; sW: number; sH: number; destW: number; destH: number } {
  const destW = Number(image?.width) || 0;
  const destH = Number(image?.height) || 0;
  const sX = Number(image?.cropX) || 0;
  const sY = Number(image?.cropY) || 0;
  const sW = Math.min(destW, elementWidth, Math.max(0, elementWidth - sX));
  const sH = Math.min(destH, elementHeight, Math.max(0, elementHeight - sY));
  return { sX, sY, sW, sH, destW, destH };
}

export function rasterPhoneExportImageRgba(
  image: any
): { data: Uint8ClampedArray; width: number; height: number } | null {
  if (!shouldPaintPhoneExportImage(image)) return null;
  const src = elementRgba(image._element || image._originalElement);
  if (!src) return null;
  const { sX, sY, sW, sH, destW, destH } = fabricImageSourceRect(image, src.width, src.height);
  const dW = Math.max(0, Math.round(destW));
  const dH = Math.max(0, Math.round(destH));
  if (sW < 1 || sH < 1 || dW < 1 || dH < 1) return null;
  const out = new Uint8ClampedArray(dW * dH * 4);
  for (let y = 0; y < dH; y++) {
    for (let x = 0; x < dW; x++) {
      const sx = Math.min(src.width - 1, Math.max(0, Math.floor(sX + (x / dW) * sW)));
      const sy = Math.min(src.height - 1, Math.max(0, Math.floor(sY + (y / dH) * sH)));
      const si = (sy * src.width + sx) * 4;
      const di = (y * dW + x) * 4;
      out[di] = src.data[si];
      out[di + 1] = src.data[si + 1];
      out[di + 2] = src.data[si + 2];
      out[di + 3] = src.data[si + 3];
    }
  }
  return { data: out, width: dW, height: dH };
}

export function rasterPhoneExportPageRgba(images: any[], pageWidth: number, pageHeight: number): Uint8ClampedArray {
  const pageW = Math.max(1, Math.round(pageWidth));
  const pageH = Math.max(1, Math.round(pageHeight));
  const page = new Uint8ClampedArray(pageW * pageH * 4);
  for (let i = 0; i < page.length; i += 4) {
    page[i] = 255;
    page[i + 1] = 255;
    page[i + 2] = 255;
    page[i + 3] = 255;
  }
  for (const image of images || []) {
    const raster = rasterPhoneExportImageRgba(image);
    if (!raster) continue;
    const left = Math.round(Number(image.left) || 0);
    const top = Math.round(Number(image.top) || 0);
    const scaleX = Number(image.scaleX) || 1;
    const scaleY = Number(image.scaleY) || 1;
    const outW = Math.max(1, Math.round(raster.width * scaleX));
    const outH = Math.max(1, Math.round(raster.height * scaleY));
    for (let y = 0; y < outH; y++) {
      const py = top + y;
      if (py < 0 || py >= pageH) continue;
      for (let x = 0; x < outW; x++) {
        const px = left + x;
        if (px < 0 || px >= pageW) continue;
        const sx = Math.min(raster.width - 1, Math.floor((x / outW) * raster.width));
        const sy = Math.min(raster.height - 1, Math.floor((y / outH) * raster.height));
        const si = (sy * raster.width + sx) * 4;
        const di = (py * pageW + px) * 4;
        const alpha = raster.data[si + 3] / 255;
        if (alpha <= 0) continue;
        page[di] = Math.round(raster.data[si] * alpha + page[di] * (1 - alpha));
        page[di + 1] = Math.round(raster.data[si + 1] * alpha + page[di + 1] * (1 - alpha));
        page[di + 2] = Math.round(raster.data[si + 2] * alpha + page[di + 2] * (1 - alpha));
        page[di + 3] = 255;
      }
    }
  }
  return page;
}

export function missingLocalImagePlaceholderSrc(
  createUrl: (blob: Blob) => string = (blob) => URL.createObjectURL(blob)
): string {
  return createUrl(new Blob([TRANSPARENT_PNG], { type: "image/png" }));
}

export async function rehydratePhoneImageSources(
  payload: any,
  loadAsset: (assetId: string) => Promise<Blob | null>,
  createUrl: (blob: Blob) => string = (blob) => URL.createObjectURL(blob)
): Promise<{ urls: string[]; missingAssetIds: string[] }> {
  const urls: string[] = [];
  const missingAssetIds: string[] = [];
  const images: any[] = [];
  walk(payload, (image) => images.push(image));

  for (const image of images) {
    const assetId = assetIdOfImage(image);
    const cropX = image.cropX;
    const cropY = image.cropY;
    const width = image.width;
    const height = image.height;
    let restored = false;
    if (assetId) {
      const blob = await loadAsset(assetId).catch(() => null);
      if (blob) {
        const url = createUrl(blob);
        urls.push(url);
        image.src = url;
        image.slbAssetId = assetId;
        const data = image.data && typeof image.data === "object" ? image.data : {};
        image.data = { ...data, slbAssetId: assetId };
        delete image.data.slbAssetMissing;
        restored = true;
      } else {
        const placeholder = missingLocalImagePlaceholderSrc(createUrl);
        urls.push(placeholder);
        markMissing(image, assetId, placeholder);
        missingAssetIds.push(assetId);
      }
    } else if (isUnsafeFabricImageSrc(image.src)) {
      const placeholder = missingLocalImagePlaceholderSrc(createUrl);
      urls.push(placeholder);
      markMissing(image, "", placeholder);
    } else {
      restored = true;
    }
    if (restored) {
      if (cropX != null) image.cropX = cropX;
      if (cropY != null) image.cropY = cropY;
      if (width != null) image.width = width;
      if (height != null) image.height = height;
    }
    stripCorsForNonNetworkSrc(image);
  }

  return { urls, missingAssetIds };
}
