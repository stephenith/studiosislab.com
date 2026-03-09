import type { Canvas } from "fabric";

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
    if (!target || !isImageFrame(target)) return false;
    const image = getImageForFrame(c, target);
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
    (target as any)._activeObjects = [image];
    (target as any)._set?.("dirty", true);
    c.setActiveObject(target);
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

