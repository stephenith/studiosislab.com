import { Circle, Rect, Group, type Canvas } from "fabric";
import { IMAGE_FRAME_SIZE, IMAGE_FRAME_TYPE } from "./frameDetection";

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

    const cx = size.w / 2 - IMAGE_FRAME_SIZE / 2;
    const cy = size.h / 2 - IMAGE_FRAME_SIZE / 2;

    let shape: any;

    if (type === "circle") {
      shape = new Circle({
        radius: IMAGE_FRAME_SIZE / 2,
        originX: "left",
        originY: "top",
        left: 0,
        top: 0,

        fill: "#e5e7eb",
        stroke: "#9ca3af",
        strokeWidth: 2,
        strokeUniform: true,

        selectable: false,
        evented: false
      });
    } else {
      shape = new Rect({
        width: IMAGE_FRAME_SIZE,
        height: IMAGE_FRAME_SIZE,
        rx: 8,
        ry: 8,

        originX: "left",
        originY: "top",
        left: 0,
        top: 0,

        fill: "#e5e7eb",
        stroke: "#9ca3af",
        strokeWidth: 2,
        strokeUniform: true,

        selectable: false,
        evented: false
      });
    }

    const frameGroup = new Group([shape], {
      left: cx,
      top: cy,
      originX: "left",
      originY: "top",

      selectable: true,
      evented: true,

      hasBorders: true,
      hasControls: true,

      perPixelTargetFind: true,
      objectCaching: false,

      subTargetCheck: false
    }) as any;

    shape.setCoords();

    frameGroup._calcBounds?.();
    frameGroup.setCoords();

    frameGroup.data = frameGroup.data || {};
    frameGroup.data.type = IMAGE_FRAME_TYPE;
    frameGroup.data.frameType = type;

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