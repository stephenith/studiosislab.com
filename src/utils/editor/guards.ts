/**
 * Tiny helpers for canvas and selection invariants.
 */

import type { Canvas } from "fabric";

export function assertCanvas(
  canvas: Canvas | null | undefined,
  message = "Canvas is required"
): asserts canvas is Canvas {
  if (!canvas) {
    throw new Error(message);
  }
}

export function safeGetActiveObject(canvas: Canvas | null | undefined): any {
  if (!canvas || typeof canvas.getActiveObject !== "function") return null;
  return canvas.getActiveObject() ?? null;
}
