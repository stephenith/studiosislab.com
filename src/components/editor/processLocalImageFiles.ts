"use client";

import { saveAsset } from "@/lib/localAssets";

export const LOCAL_ASSETS_CHANGED_EVENT = "slb:local-assets-changed";

export type EditorImageInsertFn = (
  url: string,
  meta?: { slbAssetId?: string; slbSource?: "local" | "cloud" | "template" }
) => void | Promise<void>;

export function isSupportedImageFile(file: File): boolean {
  const mime = String(file?.type || "").toLowerCase();
  if (mime.startsWith("image/")) return true;
  return /\.(png|jpe?g|webp|gif|bmp|svg|heic|heif)$/i.test(String(file?.name || ""));
}

export function extractImageFiles(filesLike: FileList | File[]): File[] {
  return Array.from(filesLike || []).filter(isSupportedImageFile);
}

export function dataTransferHasImageFiles(dataTransfer: DataTransfer | null | undefined): boolean {
  if (!dataTransfer) return false;
  const items = Array.from(dataTransfer.items || []);
  if (items.length > 0) {
    return items.some((item) => {
      if (item.kind !== "file") return false;
      const itemType = String(item.type || "").toLowerCase();
      if (itemType.startsWith("image/")) return true;
      const file = item.getAsFile();
      return !!file && isSupportedImageFile(file);
    });
  }
  return extractImageFiles(dataTransfer.files || []).length > 0;
}

export async function processLocalImageFiles(params: {
  files: File[];
  uid: string;
  docId: string;
  addImageFromUrl?: EditorImageInsertFn;
}): Promise<{ uploadedCount: number; failedCount: number }> {
  const { files, uid, docId, addImageFromUrl } = params;
  const imageFiles = extractImageFiles(files);
  if (!imageFiles.length) return { uploadedCount: 0, failedCount: 0 };

  let uploadedCount = 0;
  let failedCount = 0;

  const tasks = imageFiles.map(async (file) => {
    const localUrl = URL.createObjectURL(file);
    try {
      const assetId = await saveAsset({
        uid,
        docId,
        file,
      });
      if (addImageFromUrl) {
        await addImageFromUrl(localUrl, {
          slbAssetId: assetId,
          slbSource: "local",
        });
      }
      uploadedCount += 1;
    } catch (err) {
      console.error("[local-image-upload] failed", err);
      failedCount += 1;
    } finally {
      URL.revokeObjectURL(localUrl);
    }
  });

  await Promise.allSettled(tasks);

  if (uploadedCount > 0 && typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(LOCAL_ASSETS_CHANGED_EVENT));
  }

  return { uploadedCount, failedCount };
}
