export const IMAGE_FRAME_SIZE = 150;
export const IMAGE_FRAME_TYPE = "image-frame";

/** Marks the visible border/fill shape inside an image-frame group (not the clipPath object). */
export const FRAME_VISIBLE_MASK_ROLE = "slbFrameVisibleMask";

export function isImageFrame(obj: any): boolean {
  return !!(obj?.data?.type === IMAGE_FRAME_TYPE || obj?.role === "imageFrame");
}

export function getImageFrameFrameType(obj: any): "square" | "circle" {
  return (
    obj?.data?.frameType ||
    obj?.data?.imageFrameType ||
    obj?.frameType ||
    "square"
  ) as "square" | "circle";
}

/** First Fabric image nested inside the frame group (cover child). */
export function getFrameImage(frame: any): any | null {
  if (!frame) return null;
  const objs = (frame as any)._objects ?? (frame as any).getObjects?.() ?? [];
  for (const o of objs) {
    if (o?.type === "image" || o?.isType?.("image")) return o;
  }
  return null;
}

/** Visible mask shape inside the group (stroke/border). Never the clipPath-only object. */
export function getFrameShape(frame: any): any | null {
  if (!frame) return null;
  const objs = (frame as any)._objects ?? (frame as any).getObjects?.() ?? [];
  for (const o of objs) {
    if (o?.data?.slbFrameRole === FRAME_VISIBLE_MASK_ROLE) return o;
  }
  for (const o of objs) {
    const t = String(o?.type || "").toLowerCase();
    if (t === "rect" || t === "circle" || t === "ellipse") return o;
  }
  return null;
}

/** True if this image is nested inside an image-frame group. */
export function isImageNestedInImageFrame(img: any): boolean {
  if (!img || img.type !== "image") return false;
  const p = img.group ?? img.parent ?? (img as any)._parent;
  return !!(p && isImageFrame(p));
}

