/**
 * Phone-only crop overlay math. Scene units match computeAxisAlignedImageCrop.
 * Fabric viewport zoom is applied here, then stripped before the desktop crop helper.
 */
import { isImageFrame, isImageNestedInImageFrame } from "@/components/editor/editor/frames/frameDetection";
import { isTextObject } from "@/lib/editor/mobileEditorUtils";
import { isMobilePageSurface } from "@/lib/editor/mobilePageStack";
import { isSkillBar } from "@/lib/editor/skillBar/skillBarDetection";
import { isStarRating } from "@/lib/editor/starRating/starRatingDetection";

export const MOBILE_CROP_MIN_WRAP_PX = 24;

export type MobileRect = {
  left: number;
  top: number;
  width: number;
  height: number;
};

export type MobileCropView = {
  canvasOffsetX: number;
  canvasOffsetY: number;
  scaleX: number;
  scaleY: number;
  panX: number;
  panY: number;
  zoom: number;
};

export function isStandaloneMobileImage(obj: any): boolean {
  if (!obj || obj.group) return false;
  if (isMobilePageSurface(obj) || isImageFrame(obj) || isImageNestedInImageFrame(obj)) return false;
  if (isTextObject(obj) || isSkillBar(obj) || isStarRating(obj)) return false;
  return String(obj.type || "").toLowerCase() === "image";
}

export function canvasRectToSceneRect(rect: MobileRect, view: MobileCropView): MobileRect {
  const zoom = view.zoom || 1;
  const sx = view.scaleX || 1;
  const sy = view.scaleY || 1;
  const logicalLeft = (rect.left - view.canvasOffsetX) / sx;
  const logicalTop = (rect.top - view.canvasOffsetY) / sy;
  return {
    left: (logicalLeft - view.panX) / zoom,
    top: (logicalTop - view.panY) / zoom,
    width: rect.width / (sx * zoom),
    height: rect.height / (sy * zoom),
  };
}

export function sceneRectToWrapRect(rect: MobileRect, view: MobileCropView): MobileRect {
  const zoom = view.zoom || 1;
  const sx = view.scaleX || 1;
  const sy = view.scaleY || 1;
  return {
    left: view.canvasOffsetX + (rect.left * zoom + view.panX) * sx,
    top: view.canvasOffsetY + (rect.top * zoom + view.panY) * sy,
    width: rect.width * zoom * sx,
    height: rect.height * zoom * sy,
  };
}

/** Wrap-space box for one stacked A4 page. Same origin as selection and crop chrome. */
export function pageFrameInWrap(
  index: number,
  pageTop: number,
  size: { w: number; h: number },
  view: MobileCropView
): { index: number; left: number; top: number; width: number; height: number } {
  const rect = sceneRectToWrapRect(
    { left: 0, top: pageTop, width: Math.max(0, size.w), height: Math.max(0, size.h) },
    view
  );
  return { index, ...rect };
}

export const MOBILE_PAGE_ACTION_GAP_PX = 8;
export const MOBILE_PAGE_ACTION_BUTTON_PX = 44;

export function pageActionWrapTop(pageFrame: { top: number; height: number }, gapPx = MOBILE_PAGE_ACTION_GAP_PX): number {
  return pageFrame.top + pageFrame.height + gapPx;
}

/** Screen-space row under a page. Width is content, not the page frame. */
export function pageActionRowStyle(pageFrame: { left: number; top: number; width: number; height: number }): {
  left: number;
  top: number;
  width: "max-content";
  transform: "translateX(-50%)";
} {
  return {
    left: pageFrame.left + pageFrame.width / 2,
    top: pageActionWrapTop(pageFrame),
    width: "max-content",
    transform: "translateX(-50%)",
  };
}

export function clampMobileCropRect(
  crop: MobileRect,
  bounds: MobileRect,
  minSize: number
): MobileRect {
  const min = Math.max(1, Math.min(minSize, bounds.width, bounds.height));
  let width = Math.max(min, Math.min(crop.width, bounds.width));
  let height = Math.max(min, Math.min(crop.height, bounds.height));
  let left = crop.left;
  let top = crop.top;
  if (left < bounds.left) left = bounds.left;
  if (top < bounds.top) top = bounds.top;
  if (left + width > bounds.left + bounds.width) left = bounds.left + bounds.width - width;
  if (top + height > bounds.top + bounds.height) top = bounds.top + bounds.height - height;
  if (left < bounds.left) {
    left = bounds.left;
    width = Math.min(width, bounds.width);
  }
  if (top < bounds.top) {
    top = bounds.top;
    height = Math.min(height, bounds.height);
  }
  return { left, top, width, height };
}

export function moveMobileCropRect(
  start: MobileRect,
  dx: number,
  dy: number,
  bounds: MobileRect
): MobileRect {
  return clampMobileCropRect(
    { ...start, left: start.left + dx, top: start.top + dy },
    bounds,
    Math.min(start.width, start.height)
  );
}

export function resizeMobileCropRect(
  start: MobileRect,
  edge: "n" | "s" | "e" | "w" | "tl" | "tr" | "bl" | "br",
  dx: number,
  dy: number,
  bounds: MobileRect,
  minSize: number
): MobileRect {
  let left = start.left;
  let top = start.top;
  let right = start.left + start.width;
  let bottom = start.top + start.height;
  const growWest = edge === "w" || edge === "tl" || edge === "bl";
  const growEast = edge === "e" || edge === "tr" || edge === "br";
  const growNorth = edge === "n" || edge === "tl" || edge === "tr";
  const growSouth = edge === "s" || edge === "bl" || edge === "br";
  if (growWest) left += dx;
  if (growEast) right += dx;
  if (growNorth) top += dy;
  if (growSouth) bottom += dy;
  return clampMobileCropRect(
    { left, top, width: right - left, height: bottom - top },
    bounds,
    minSize
  );
}
