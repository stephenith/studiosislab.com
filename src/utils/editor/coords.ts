/**
 * Screen <-> canvas coordinate helpers for placement/zoom.
 */

import type { Canvas } from "fabric";

export function screenToCanvas(
  canvas: Canvas,
  screenX: number,
  screenY: number
): { x: number; y: number } {
  const vpt = canvas.viewportTransform;
  if (!vpt || vpt.length < 6) {
    return { x: screenX, y: screenY };
  }
  const zoom = vpt[0];
  const tx = vpt[4];
  const ty = vpt[5];
  return {
    x: (screenX - tx) / zoom,
    y: (screenY - ty) / zoom,
  };
}

export function canvasToScreen(
  canvas: Canvas,
  canvasX: number,
  canvasY: number
): { x: number; y: number } {
  const vpt = canvas.viewportTransform;
  if (!vpt || vpt.length < 6) {
    return { x: canvasX, y: canvasY };
  }
  const zoom = vpt[0];
  const tx = vpt[4];
  const ty = vpt[5];
  return {
    x: canvasX * zoom + tx,
    y: canvasY * zoom + ty,
  };
}
