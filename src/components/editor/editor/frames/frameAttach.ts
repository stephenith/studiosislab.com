import { type Canvas } from "fabric";
import type { MutableRefObject } from "react";
import { ensureObjectId } from "../utils/fabricHelpers";
import { getFrameImage, getFrameShape, getImageFrameFrameType } from "./frameDetection";

export function createFrameAttach(deps: {
  getCanvas: () => Canvas | null;
  pushHistory: (reason: string) => void;
  updateLayers: () => void;
  isInternalMutationRef: MutableRefObject<boolean>;
}) {
  const { getCanvas, pushHistory, updateLayers, isInternalMutationRef } = deps;

  const attachImageToFrame = (frameGroup: any, image: any) => {
    const c = getCanvas();
    if (!c || !frameGroup || !image) return;

    const shape = getFrameShape(frameGroup);
    if (!shape) return;

    const frameType = getImageFrameFrameType(frameGroup);

    isInternalMutationRef.current = true;
    try {
      frameGroup.set({
        selectable: true,
        evented: true,
        hasControls: true,
        hasBorders: true,
        hoverCursor: "move",
      });

      const el = image.getElement?.();
      const baseW = el?.naturalWidth || image.width || 1;
      const baseH = el?.naturalHeight || image.height || 1;
      if (!baseW || !baseH) return;

      // Use intrinsic mask size (width×scale), not getScaledWidth(), so stroke does not
      // inflate cover scale vs. clipShape — avoids image looking shifted vs. clip.
      let frameW: number;
      let frameH: number;
      if (frameType === "circle") {
        frameW = (Number(shape.radius) || 0) * 2 * (Number(shape.scaleX) || 1);
        frameH = (Number(shape.radius) || 0) * 2 * (Number(shape.scaleY) || 1);
      } else {
        frameW = (Number(shape.width) || 0) * (Number(shape.scaleX) || 1);
        frameH = (Number(shape.height) || 0) * (Number(shape.scaleY) || 1);
      }

      const scale = Math.max(frameW / baseW, frameH / baseH);
      if (!Number.isFinite(scale) || scale <= 0) return;

      const ex = getFrameImage(frameGroup);
      if (ex && ex !== image) {
        frameGroup.remove(ex);
        if (ex.canvas && ex.canvas !== c) {
          try {
            ex.canvas.remove(ex);
          } catch {}
        }
      }

      if (image.canvas && image.canvas !== c) {
        try {
          image.canvas.remove(image);
        } catch {}
      } else if (image.canvas === c) {
        c.remove(image);
      }

      const center = frameGroup.getCenterPoint();

      image.set({
        cropX: 0,
        cropY: 0,
        originX: "center",
        originY: "center",
        left: center.x,
        top: center.y,
        width: baseW,
        height: baseH,
        scaleX: scale,
        scaleY: scale,
        angle: 0,
        selectable: false,
        evented: false,
        lockScalingX: true,
        lockScalingY: true,
        lockMovementX: true,
        lockMovementY: true,
        hasBorders: false,
        hasControls: false,
        clipPath: undefined,
      });
      image.setCoords();

      if (image.group === frameGroup) {
        frameGroup.remove(image);
      }
      frameGroup.add(image);

      console.log("A: AFTER ADD (_enterGroup ran)", {
        left: image.left,
        top: image.top,
        scaleX: image.scaleX,
        scaleY: image.scaleY,
        inObjects: frameGroup._objects?.includes(image),
        groupRef: image.group === frameGroup,
      });

      console.log("B: ELEMENT CHECK", {
        element: !!(image as any)._element,
        naturalWidth: (image as any)._element?.naturalWidth,
        naturalHeight: (image as any)._element?.naturalHeight,
        width: image.width,
        height: image.height,
        visible: image.visible,
        opacity: image.opacity,
      });

      console.log("C: SCALE CHECK", {
        scaleX: image.scaleX,
        scaleY: image.scaleY,
      });

      console.log("D: FINAL POSITION CHECK", {
        left: image.left,
        top: image.top,
        frameLeft: frameGroup.left,
        frameTop: frameGroup.top,
        clipLeft: (frameGroup.clipPath as any)?.left,
        clipTop: (frameGroup.clipPath as any)?.top,
      });

      // Re-derive cover scale from the shape's actual rendered size so the image
      // fills the clip region regardless of any group-level scale applied before attach.
      const shapeBounds = shape.getBoundingRect?.();
      if (shapeBounds && image.width && image.height) {
        const coverScale = Math.max(
          shapeBounds.width / image.width,
          shapeBounds.height / image.height
        );
        if (Number.isFinite(coverScale) && coverScale > 0) {
          image.scaleX = coverScale;
          image.scaleY = coverScale;
        }
      }

      image.setCoords();
      frameGroup.setCoords();

      ensureObjectId(frameGroup);

      frameGroup.data = { ...(frameGroup.data || {}), hasImage: true };

      frameGroup.triggerLayout?.();
      frameGroup.setCoords();
      image.setCoords();

      // Force cache reset so Fabric redraws the group and nested image from scratch.
      frameGroup.set({ dirty: true });
      image.set({ dirty: true });
      if (frameGroup.clipPath) {
        frameGroup.clipPath.set({ dirty: true });
      }

      frameGroup._calcBounds?.();
      frameGroup.setCoords();
      image.setCoords();
      (frameGroup.canvas ?? c).requestRenderAll();
    } finally {
      isInternalMutationRef.current = false;
    }

    pushHistory("object:update");
    updateLayers();
  };

  return { attachImageToFrame };
}
