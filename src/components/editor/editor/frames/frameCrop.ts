import type { Canvas } from "fabric";
import { getFrameShape } from "./frameDetection";

export function createFrameCrop(deps: {
  getCanvas: () => Canvas | null;
  isImageFrame: (obj: any) => boolean;
  getImageForFrame: (canvas: Canvas, frame: any) => any;
  imageFrameCropModeRef: {
    current:
      | {
          frame: any;
          image: any;
          canvas: Canvas;
        }
      | null;
  };
  exitCropModeRef: { current: (() => void) | null };
  setCropModeStateRef: { current: (v: boolean) => void };
}) {
  const {
    getCanvas,
    isImageFrame,
    getImageForFrame,
    imageFrameCropModeRef,
    exitCropModeRef,
    setCropModeStateRef,
  } = deps;

  const enterImageFrameCropMode = () => {
    const c = getCanvas();
    if (!c) return false;
    // Prevent entering crop mode if already active
    if (imageFrameCropModeRef.current) return false;

    const target = c.getActiveObject() as any;
    // #region agent log
    fetch("http://127.0.0.1:7497/ingest/56601a8a-ebed-4e8a-847f-61b683cab256", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Debug-Session-Id": "b60eca",
      },
      body: JSON.stringify({
        sessionId: "b60eca",
        runId: "frame-crop",
        hypothesisId: "H-crop-target",
        location: "frameCrop.ts:enterImageFrameCropMode",
        message: "enterImageFrameCropMode called",
        data: {
          hasCanvas: !!c,
          hasTarget: !!target,
          targetType: target?.type ?? null,
          isImageFrame: target ? isImageFrame(target) : null,
        },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion

    if (!target || !isImageFrame(target)) return false;
    const image = getImageForFrame(c, target);
    // #region agent log
    fetch("http://127.0.0.1:7497/ingest/56601a8a-ebed-4e8a-847f-61b683cab256", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Debug-Session-Id": "b60eca",
      },
      body: JSON.stringify({
        sessionId: "b60eca",
        runId: "frame-crop",
        hypothesisId: "H-crop-image",
        location: "frameCrop.ts:enterImageFrameCropMode",
        message: "getImageForFrame result",
        data: {
          hasImage: !!image,
          imageFrameId: image?.data?.frameId ?? null,
        },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion
    if (!image) return false;

    exitCropModeRef.current?.();

    // Frame remains selectable but is locked in place while cropping
    target.set({
      selectable: true,
      evented: true,
    });
    // Enable fine-grained hit testing only while cropping
    (target as any).subTargetCheck = true;
    (target as any).lockMovementX = true;
    (target as any).lockMovementY = true;

    // Highlight the frame shape while in crop mode for clearer UX.
    const shape = getFrameShape(target);
    if (shape) {
      shape.set({
        stroke: "#3b82f6",
        strokeWidth: 2,
      });
    }

    // Allow the image to move and scale freely while cropping.
    image.set({
      selectable: true,
      evented: true,
      lockMovementX: false,
      lockMovementY: false,
      lockScalingX: false,
      lockScalingY: false,
      hasBorders: true,
      hasControls: true,
    });
    // Make the image itself the active object so the user can drag/scale it
    // inside the stationary frame.
    c.setActiveObject(image);
    imageFrameCropModeRef.current = { frame: target, image, canvas: c };
    setCropModeStateRef.current(true);
    c.requestRenderAll();
    return true;
  };

  const exitImageFrameCropMode = () => {
    exitCropModeRef.current?.();
  };

  return { enterImageFrameCropMode, exitImageFrameCropMode };
}

