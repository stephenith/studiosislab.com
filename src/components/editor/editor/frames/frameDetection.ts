import type { Canvas } from "fabric";

export const IMAGE_FRAME_SIZE = 150;
export const IMAGE_FRAME_TYPE = "image-frame";

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

export function getImageForFrame(_canvas: Canvas, frame: any): any {
  if (!frame) return null;
  const objs = (frame as any)._objects ?? (frame as any).getObjects?.() ?? [];
  return objs.find((o: any) => o.type === "image") ?? null;
}

export function getFrameShape(frame: any): any {
  const objs = (frame as any)._objects ?? (frame as any).getObjects?.() ?? [];
  return objs[0] ?? null;
}

