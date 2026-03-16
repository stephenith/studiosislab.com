/**
 * Create and initialize Fabric canvas, background, and basic setup.
 */

import { Canvas } from "fabric";
import { CANVAS_BG } from "@/types/editor";

export interface InitFabricCanvasOptions {
  width: number;
  height: number;
  backgroundColor?: string;
  selection?: boolean;
  preserveObjectStacking?: boolean;
}

/**
 * Create Fabric canvas on the given element with the same defaults as the hook.
 */
export function initFabricCanvas(
  canvasEl: HTMLCanvasElement,
  options: InitFabricCanvasOptions
): Canvas {
  const {
    width,
    height,
    backgroundColor = CANVAS_BG,
    selection = true,
    preserveObjectStacking = true,
  } = options;
  const c = new Canvas(canvasEl, {
    width,
    height,
    backgroundColor,
    selection,
    preserveObjectStacking,
    selectionColor: "rgba(59, 130, 246, 0.2)",
    selectionBorderColor: "rgba(59, 130, 246, 0.8)",
    selectionLineWidth: 2,
  } as any);
  return c;
}

/**
 * Set canvas background color. Uses set({ backgroundColor }) + requestRenderAll.
 * Do NOT use setBackgroundColor (may not exist in Fabric v6).
 */
export function applyCanvasBackground(
  canvas: Canvas,
  color: string
): void {
  canvas.set({ backgroundColor: color });
  canvas.requestRenderAll();
}
