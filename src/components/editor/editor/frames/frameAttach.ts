import { Circle, Rect, type Canvas } from "fabric";
import { IMAGE_FRAME_SIZE } from "./frameDetection";

export function createFrameAttach(deps: {
  getCanvas: () => Canvas | null;
  getImageFrameFrameType: (obj: any) => "square" | "circle";
  getFrameShape: (frame: any) => any;
  getImageForFrame: (canvas: Canvas, frame: any) => any;
  pushHistory: (reason: string) => void;
  updateLayers: () => void;
  isImageFrame: (obj: any) => boolean;
  attachImageToFrameRef: { current: ((frameGroup: any, image: any) => void) | undefined };
}) {
  const {
    getCanvas,
    getImageFrameFrameType,
    getFrameShape,
    getImageForFrame,
    pushHistory,
    updateLayers,
    isImageFrame,
    attachImageToFrameRef,
  } = deps;

  const attachImageToFrame = (frameGroup: any, image: any) => {
    const c = getCanvas();
    if (!c || !frameGroup || !image) return;

    const shape = getFrameShape(frameGroup);
    if (!shape) return;

    const objs = frameGroup._objects ?? frameGroup.getObjects?.() ?? [];
    if (objs.includes(image)) return;

    const el = (image as any)._element ?? (image as any).getElement?.();
    if (!el?.naturalWidth) return;

    const size = (image as any).getOriginalSize?.() || {
      width: el.naturalWidth,
      height: el.naturalHeight,
    };
    const imgW = size?.width ?? el.naturalWidth ?? 1;
    const imgH = size?.height ?? el.naturalHeight ?? 1;
    if (!imgW || !imgH) return;

    const frameType = getImageFrameFrameType(frameGroup);
    const frameW =
      frameType === "circle"
        ? (Number((shape as any).radius) ?? IMAGE_FRAME_SIZE / 2) * 2
        : Number((shape as any).width) ?? IMAGE_FRAME_SIZE;
    const frameH =
      frameType === "circle"
        ? (Number((shape as any).radius) ?? IMAGE_FRAME_SIZE / 2) * 2
        : Number((shape as any).height) ?? IMAGE_FRAME_SIZE;

    const scale = Math.max(frameW / imgW, frameH / imgH);
    if (!Number.isFinite(scale) || scale <= 0) return;

    const cropW = frameW / scale;
    const cropH = frameH / scale;
    const cropX = Math.max(0, (imgW - cropW) / 2);
    const cropY = Math.max(0, (imgH - cropH) / 2);

    const existingImg = getImageForFrame(c, frameGroup);
    if (existingImg) frameGroup.remove(existingImg);

    // Apply cover-scale and crop in image space (no positioning yet)
    image.set({
      scaleX: scale,
      scaleY: scale,
      cropX,
      cropY,
      width: cropW,
      height: cropH,
      selectable: false,
      evented: true,
      lockScalingX: true,
      lockScalingY: true,
      angle: 0,
      skewX: 0,
      skewY: 0,
    });

    if (frameType === "circle") {
      const clipPath = new Circle({
        radius: frameW / 2,
        originX: "left",
        originY: "top",
        left: 0,
        top: 0,
        selectable: false,
        evented: false,
      });
      image.set({ clipPath });
      (clipPath as any).absolutePositioned = false;
    } else {
      const rx = (shape as any).rx ?? 0;
      const ry = (shape as any).ry ?? 0;
      const clipPath = new Rect({
        width: frameW,
        height: frameH,
        rx,
        ry,
        originX: "left",
        originY: "top",
        left: 0,
        top: 0,
        selectable: false,
        evented: false,
      });
      image.set({ clipPath });
      (clipPath as any).absolutePositioned = false;
    }

    image.data = image.data || {};
    image.data.insideFrame = true;

    c.remove(image);
    frameGroup.add(image);

    // Position the image in the frame's local space relative to the shape
    image.set({
      originX: "left",
      originY: "top",
      left: (shape as any).left ?? 0,
      top: (shape as any).top ?? 0,
    });

    frameGroup.data = frameGroup.data || {};
    frameGroup.data.hasImage = true;

    if (typeof frameGroup._calcBounds === "function") frameGroup._calcBounds();
    frameGroup.setCoords?.();
    c.requestRenderAll();
    c.setActiveObject(frameGroup);
    c.requestRenderAll();
    pushHistory("object:update");
    updateLayers();
  };

  const tryAttachImageToFrame = (image: any, frame: any): boolean => {
    if (!image || !frame || image.type !== "image" || !isImageFrame(frame)) return false;
    const frameObjs = frame._objects ?? frame.getObjects?.() ?? [];
    if (frameObjs.includes(image)) return false;

    const imgBounds = (image as any).getBoundingRect?.(true);
    const frameBounds = (frame as any).getBoundingRect?.(true);
    if (!imgBounds || !frameBounds) return false;

    const imgCenterX = imgBounds.left + imgBounds.width / 2;
    const imgCenterY = imgBounds.top + imgBounds.height / 2;
    const centerInside =
      imgCenterX >= frameBounds.left &&
      imgCenterX <= frameBounds.left + frameBounds.width &&
      imgCenterY >= frameBounds.top &&
      imgCenterY <= frameBounds.top + frameBounds.height;
    const overlapLeft = Math.max(imgBounds.left, frameBounds.left);
    const overlapTop = Math.max(imgBounds.top, frameBounds.top);
    const overlapRight = Math.min(
      imgBounds.left + imgBounds.width,
      frameBounds.left + frameBounds.width
    );
    const overlapBottom = Math.min(
      imgBounds.top + imgBounds.height,
      frameBounds.top + frameBounds.height
    );
    const overlapArea =
      overlapRight > overlapLeft && overlapBottom > overlapTop
        ? (overlapRight - overlapLeft) * (overlapBottom - overlapTop)
        : 0;
    const frameArea = frameBounds.width * frameBounds.height;
    const hasSignificantOverlap = frameArea > 0 && overlapArea > frameArea * 0.15;

    if (!centerInside && !hasSignificantOverlap) return false;

    try {
      const attach = attachImageToFrameRef.current;
      if (typeof attach === "function") {
        attach(frame, image);
        return true;
      }
    } catch (err) {
      if (process.env.NODE_ENV !== "production") console.error("[attachImageToFrame]", err);
    }
    return false;
  };

  return { attachImageToFrame, tryAttachImageToFrame };
}

