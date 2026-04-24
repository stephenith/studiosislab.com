import type { Canvas } from "fabric";
import { getFrameShape, getFrameImage } from "./frameDetection";

export function createFrameCrop(deps: {
  getCanvas: () => Canvas | null;
  isImageFrame: (obj: any) => boolean;
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
    imageFrameCropModeRef,
    exitCropModeRef,
    setCropModeStateRef,
  } = deps;

  const enterImageFrameCropMode = () => {
    const c = getCanvas();
    if (!c) return false;

    if (imageFrameCropModeRef.current) return false;

    const target = c.getActiveObject() as any;

    if (!target || !isImageFrame(target)) return false;

    const image = getFrameImage(target);
    if (!image) return false;

    exitCropModeRef.current?.();

    target.set({
      selectable: true,
      evented: true,
    });

    (target as any).subTargetCheck = true;
    (target as any).interactive = true;
    (target as any).lockMovementX = true;
    (target as any).lockMovementY = true;

    const shape = getFrameShape(target);
    if (shape) {
      shape.set({
        stroke: "#3b82f6",
        strokeWidth: 2,
      });
    }

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
