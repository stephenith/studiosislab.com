import { Circle, Rect, Group, type Canvas } from "fabric";
import {
  IMAGE_FRAME_SIZE,
  IMAGE_FRAME_TYPE,
  FRAME_VISIBLE_MASK_ROLE,
} from "./frameDetection";

type GetPageSizePx = () => { w: number; h: number };

export function createFrameCreate(deps: {
  getCanvas: () => Canvas | null;
  getPageSizePx: GetPageSizePx;
  ensureObjectId: (obj: any) => string | null;
  pushHistory: (reason: string) => void;
  updateLayers: () => void;
}) {
  const { getCanvas, getPageSizePx, ensureObjectId, pushHistory, updateLayers } = deps;

  const addImageFrame = (type: "square" | "circle") => {
    const canvas = getCanvas();
    if (!canvas) return;

    canvas.isDrawingMode = false;
    canvas.selection = true;

    const size = getPageSizePx();

    const cx = size.w / 2;
    const cy = size.h / 2;

    let visibleShape: Rect | Circle;
    let clipShape: Rect | Circle;

    if (type === "circle") {
      const r = IMAGE_FRAME_SIZE / 2;
      const base = {
        radius: r,
        originX: "center" as const,
        originY: "center" as const,
        left: 0,
        top: 0,
        selectable: false,
        evented: false,
      };
      visibleShape = new Circle({
        ...base,
        fill: "#e5e7eb",
        stroke: "#9ca3af",
        strokeWidth: 2,
        strokeUniform: true,
      });
      clipShape = new Circle({
        radius: r,
        originX: "left",
        originY: "top",
        left: -r,
        top: -r,
        absolutePositioned: false,
        fill: "#ffffff",
        strokeWidth: 0,
        selectable: false,
        evented: false,
      });
    } else {
      const base = {
        width: IMAGE_FRAME_SIZE,
        height: IMAGE_FRAME_SIZE,
        rx: 8,
        ry: 8,
        originX: "center" as const,
        originY: "center" as const,
        left: 0,
        top: 0,
        selectable: false,
        evented: false,
      };
      visibleShape = new Rect({
        ...base,
        fill: "#e5e7eb",
        stroke: "#9ca3af",
        strokeWidth: 2,
        strokeUniform: true,
      });
      clipShape = new Rect({
        width: IMAGE_FRAME_SIZE,
        height: IMAGE_FRAME_SIZE,
        rx: 8,
        ry: 8,
        originX: "left",
        originY: "top",
        left: -IMAGE_FRAME_SIZE / 2,
        top: -IMAGE_FRAME_SIZE / 2,
        absolutePositioned: false,
        fill: "#ffffff",
        strokeWidth: 0,
        selectable: false,
        evented: false,
      });
    }

    (visibleShape as any).data = {
      ...((visibleShape as any).data || {}),
      slbFrameRole: FRAME_VISIBLE_MASK_ROLE,
    };

    visibleShape.setCoords();
    clipShape.setCoords();

    const frameGroup = new Group([visibleShape], {
      left: cx,
      top: cy,
      originX: "center",
      originY: "center",
      selectable: true,
      evented: true,
      hasBorders: true,
      hasControls: true,
      perPixelTargetFind: true,
      objectCaching: true,
      subTargetCheck: true,
      interactive: true,
      clipPath: clipShape,
    }) as any;

    frameGroup._calcBounds?.();
    frameGroup.setCoords();

    frameGroup.data = frameGroup.data || {};
    frameGroup.data.type = IMAGE_FRAME_TYPE;
    frameGroup.data.frameType = type;
    frameGroup.data.hasImage = false;

    const id = ensureObjectId(frameGroup);
    frameGroup.uid = id;

    canvas.add(frameGroup);
    canvas.setActiveObject(frameGroup);
    canvas.requestRenderAll();

    pushHistory("added");
    updateLayers();
  };

  return { addImageFrame };
}
