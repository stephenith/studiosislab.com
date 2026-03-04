/**
 * Image tools: add image from file/url, set opacity.
 */

import type { Canvas } from "fabric";
import { Image as FabricImage } from "fabric";

export interface AddImageFromFileOptions {
  left?: number;
  top?: number;
  maxWidth?: number;
  maxHeight?: number;
}

/**
 * Create a Fabric.Image from a File and add to canvas. Returns the image object.
 */
export async function addImageFromFile(
  canvas: Canvas,
  file: File,
  opts: AddImageFromFileOptions = {}
): Promise<any> {
  const url = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
  const img = await FabricImage.fromURL(url);
  if (opts.left != null) img.set("left", opts.left);
  if (opts.top != null) img.set("top", opts.top);
  if (opts.maxWidth != null || opts.maxHeight != null) {
    const el = (img as any).getElement?.() ?? (img as any)._element;
    const w = el?.naturalWidth ?? img.width ?? 1;
    const h = el?.naturalHeight ?? img.height ?? 1;
    const maxW = opts.maxWidth ?? w;
    const maxH = opts.maxHeight ?? h;
    const scale = Math.min(maxW / w, maxH / h, 1);
    if (Number.isFinite(scale) && scale > 0) {
      img.set({ scaleX: scale, scaleY: scale });
    }
  }
  img.setCoords?.();
  return img;
}

/**
 * Set opacity on an image (or any Fabric object).
 */
export function setImageOpacity(activeObject: any, opacity: number): void {
  if (!activeObject) return;
  const o = Math.max(0, Math.min(1, Number(opacity)));
  activeObject.set?.("opacity", o);
  activeObject.setCoords?.();
}
