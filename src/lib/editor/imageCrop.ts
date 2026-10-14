/**
 * Desktop image-inspector crop.
 * Coordinates are page/scene units. Fabric viewport zoom is not part of this math.
 */

import { Point, util } from "fabric";

export const IMAGE_CROP_RECT_ROLE = "image-crop-rect";
export const IMAGE_CROP_DIM_ROLE = "image-crop-dim";

export const IMAGE_CROP_ROTATION_MESSAGE =
  "Crop works on upright images. Set rotation to 0°, then crop.";
export const IMAGE_CROP_SKEW_MESSAGE =
  "Crop works on images without skew. Remove skew, then crop.";
export const IMAGE_CROP_CALC_MESSAGE =
  "Crop could not be calculated. Move the box onto the picture and try again.";

export type ImageCropPatch = {
  cropX: number;
  cropY: number;
  width: number;
  height: number;
  scaleX: number;
  scaleY: number;
  left: number;
  top: number;
  originX: string;
  originY: string;
};

export type ImageCropResult =
  | { ok: true; patch: ImageCropPatch }
  | { ok: false; error: string };

export function imageCropRole(obj: any): string {
  return String(obj?.role || obj?.data?.role || "").toLowerCase();
}

export function isImageCropChrome(obj: any): boolean {
  const role = imageCropRole(obj);
  return role === IMAGE_CROP_RECT_ROLE || role === IMAGE_CROP_DIM_ROLE;
}

export function omitImageCropChromeFromSnapshot<T>(snapshot: T): T {
  if (!snapshot || typeof snapshot !== "object") return snapshot;
  const record = snapshot as any;
  if (!Array.isArray(record.objects)) return snapshot;
  return {
    ...record,
    objects: record.objects
      .filter((obj: any) => !isImageCropChrome(obj))
      .map((obj: any) => omitImageCropChromeFromSnapshot(obj)),
  };
}

function uprightAngle(angle: number): boolean {
  if (!Number.isFinite(angle)) return false;
  const wrapped = ((angle % 360) + 360) % 360;
  return wrapped < 0.5 || wrapped > 359.5;
}

/** Rotation and skew are refused. Flip and a non-default origin stay supported. */
export function imageCropBlockedReason(image: any): string | null {
  if (!image) return IMAGE_CROP_CALC_MESSAGE;
  if (!uprightAngle(Number(image.angle || 0))) return IMAGE_CROP_ROTATION_MESSAGE;
  const skewX = Number(image.skewX || 0);
  const skewY = Number(image.skewY || 0);
  if (Math.abs(skewX) > 0.01 || Math.abs(skewY) > 0.01) return IMAGE_CROP_SKEW_MESSAGE;
  return null;
}

function originShift(origin: string, size: number): number {
  if (origin === "center") return size / 2;
  if (origin === "right" || origin === "bottom") return size;
  return 0;
}

/**
 * Map the axis-aligned selector onto source pixels of an upright image.
 * The selector's left/top/width/height are scene coordinates (not zoomed pixels).
 * An existing cropX/cropY is the offset of the current visible source window.
 */
export function computeAxisAlignedImageCrop(image: any, cropRect: any): ImageCropResult {
  const blocked = imageCropBlockedReason(image);
  if (blocked) return { ok: false, error: blocked };
  const matrix = image?.calcTransformMatrix?.();
  if (!matrix || !cropRect) return { ok: false, error: IMAGE_CROP_CALC_MESSAGE };

  const left = Number(cropRect.left);
  const top = Number(cropRect.top);
  const boxW = Number(cropRect.width);
  const boxH = Number(cropRect.height);
  if (![left, top, boxW, boxH].every((value) => Number.isFinite(value)) || boxW < 1 || boxH < 1) {
    return { ok: false, error: IMAGE_CROP_CALC_MESSAGE };
  }

  const corners = [
    new Point(left, top),
    new Point(left + boxW, top),
    new Point(left + boxW, top + boxH),
    new Point(left, top + boxH),
  ];
  let locals: { x: number; y: number }[];
  try {
    locals = corners.map((point) => util.sendPointToPlane(point, undefined, matrix));
  } catch {
    return { ok: false, error: IMAGE_CROP_CALC_MESSAGE };
  }
  if (locals.some((point) => !Number.isFinite(point?.x) || !Number.isFinite(point?.y))) {
    return { ok: false, error: IMAGE_CROP_CALC_MESSAGE };
  }

  const sourceW = Number(image.width);
  const sourceH = Number(image.height);
  if (!(sourceW > 0) || !(sourceH > 0)) return { ok: false, error: IMAGE_CROP_CALC_MESSAGE };

  const xs = locals.map((point) => point.x + sourceW / 2);
  const ys = locals.map((point) => point.y + sourceH / 2);
  const localLeft = Math.max(0, Math.min(sourceW, Math.min(...xs)));
  const localRight = Math.max(0, Math.min(sourceW, Math.max(...xs)));
  const localTop = Math.max(0, Math.min(sourceH, Math.min(...ys)));
  const localBottom = Math.max(0, Math.min(sourceH, Math.max(...ys)));
  let nextWidth = localRight - localLeft;
  let nextHeight = localBottom - localTop;
  if (nextWidth < 1 || nextHeight < 1) return { ok: false, error: IMAGE_CROP_CALC_MESSAGE };

  const baseCropX = Math.max(0, Number(image.cropX) || 0);
  const baseCropY = Math.max(0, Number(image.cropY) || 0);
  const original = image.getOriginalSize?.() || { width: 0, height: 0 };
  const maxRight = Number(original.width) > 1 ? Number(original.width) : baseCropX + sourceW;
  const maxBottom = Number(original.height) > 1 ? Number(original.height) : baseCropY + sourceH;
  let cropX = baseCropX + localLeft;
  let cropY = baseCropY + localTop;
  if (cropX + nextWidth > maxRight + 0.01) nextWidth = maxRight - cropX;
  if (cropY + nextHeight > maxBottom + 0.01) nextHeight = maxBottom - cropY;
  if (nextWidth < 1 || nextHeight < 1) return { ok: false, error: IMAGE_CROP_CALC_MESSAGE };

  const originX = String(image.originX || "left");
  const originY = String(image.originY || "top");
  const scaleX = Number(image.scaleX);
  const scaleY = Number(image.scaleY);
  if (!Number.isFinite(scaleX) || !Number.isFinite(scaleY) || scaleX === 0 || scaleY === 0) {
    return { ok: false, error: IMAGE_CROP_CALC_MESSAGE };
  }

  return {
    ok: true,
    patch: {
      cropX,
      cropY,
      width: nextWidth,
      height: nextHeight,
      scaleX,
      scaleY,
      left: left + originShift(originX, boxW),
      top: top + originShift(originY, boxH),
      originX,
      originY,
    },
  };
}
