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

    // 1) Get original image size (base, unscaled dimensions).
    const el = (image as any)._element ?? (image as any).getElement?.();
    const original =
      (image as any).getOriginalSize?.() || {
        width: el?.naturalWidth || (image as any).width,
        height: el?.naturalHeight || (image as any).height,
      };
    const baseW = Number(original?.width) || 0;
    const baseH = Number(original?.height) || 0;
    if (!baseW || !baseH) return;

    // 2) Compute visible frame size (including frame's own scaling).
    const frameType = getImageFrameFrameType(frameGroup);
    let frameW: number;
    let frameH: number;
    if (frameType === "circle") {
      const radius = Number((shape as any).radius) || IMAGE_FRAME_SIZE / 2;
      const scaleX = Number((shape as any).scaleX) || 1;
      const scaleY = Number((shape as any).scaleY) || 1;
      frameW = radius * 2 * scaleX;
      frameH = radius * 2 * scaleY;
    } else {
      const scaledW =
        typeof (shape as any).getScaledWidth === "function"
          ? (shape as any).getScaledWidth()
          : Number((shape as any).width) || IMAGE_FRAME_SIZE;
      const scaledH =
        typeof (shape as any).getScaledHeight === "function"
          ? (shape as any).getScaledHeight()
          : Number((shape as any).height) || IMAGE_FRAME_SIZE;
      frameW = scaledW;
      frameH = scaledH;
    }

    // 3) COVER scaling: ignore any existing image scale and compute fresh factor.
    const scale = Math.max(frameW / baseW, frameH / baseH);
    if (!Number.isFinite(scale) || scale <= 0) return;

    const existingImg = getImageForFrame(c, frameGroup);
    if (existingImg) {
      c.remove(existingImg);
    }

    // 4) Center the image on the frame's visible center.
    const center = (shape as any).getCenterPoint?.();
    if (!center) return;
    const cx = Number(center.x) || 0;
    const cy = Number(center.y) || 0;

    image.set({
      originX: "center",
      originY: "center",
      left: cx,
      top: cy,
      scaleX: scale,
      scaleY: scale,
      selectable: false,
      evented: true,
      lockScalingX: true,
      lockScalingY: true,
      angle: 0,
      skewX: 0,
      skewY: 0,
    });
    image.setCoords();

    let clipPath;
    if (frameType === "circle") {
      clipPath = new Circle({
        radius: frameW / 2,
        originX: "center",
        originY: "center",
        left: 0,
        top: 0,
        selectable: false,
        evented: false,
      });
    } else {
      const rx = (shape as any).rx ?? 0;
      const ry = (shape as any).ry ?? 0;
      clipPath = new Rect({
        width: frameW,
        height: frameH,
        rx,
        ry,
        originX: "center",
        originY: "center",
        left: 0,
        top: 0,
        selectable: false,
        evented: false,
      });
    }
    (clipPath as any).absolutePositioned = false;
    image.set({ clipPath });

    const frameId = (frameGroup as any).id || (frameGroup as any).uid;
    image.data = image.data || {};
    image.data.insideFrame = true;
    if (frameId) {
      (image.data as any).frameId = frameId;
    }

    frameGroup.data = frameGroup.data || {};
    frameGroup.data.hasImage = true;

    if (!image.canvas) {
      c.add(image);
    }
    image.set({ visible: true, opacity: 1 });
    (c as any).bringToFront?.(image);
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

