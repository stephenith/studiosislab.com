/**
 * Phone-only local image rehydrate. IndexedDB assets stay on this browser.
 * Dead blob: URLs must not reach Fabric loadFromJSON.
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

export const PHONE_EXPORT_IMAGE_WAIT_MS = 4000;
export const PHONE_EXPORT_MISSING_PHOTO_NOTICE =
  "A photo isn't available on this phone, so it was left out of the download. The rest of the resume was saved.";

export function fabricImageHasDecodedPixels(image: any): boolean {
  const el = image?._element || image?._originalElement;
  const width = Number(el?.naturalWidth ?? el?.width ?? 0);
  const height = Number(el?.naturalHeight ?? el?.height ?? 0);
  return width > 1 && height > 1;
}

export function isMissingPhoneExportImage(image: any): boolean {
  return image?.data?.slbAssetMissing === true;
}

function waitForOneExportImage(image: any, deadline: number): Promise<void> {
  if (isMissingPhoneExportImage(image) || fabricImageHasDecodedPixels(image)) return Promise.resolve();
  const el = image?._element || image?._originalElement;
  if (!el) return Promise.resolve();
  if (el.complete && !fabricImageHasDecodedPixels(image)) return Promise.resolve();
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
  canvas: { getObjects?: () => any[] },
  timeoutMs = PHONE_EXPORT_IMAGE_WAIT_MS
): Promise<void> {
  const deadline = Date.now() + Math.max(0, timeoutMs);
  const images = (canvas.getObjects?.() || []).filter((obj) => String(obj?.type || "").toLowerCase() === "image");
  await Promise.all(images.map((image) => waitForOneExportImage(image, deadline)));
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
  }

  return { urls, missingAssetIds };
}
