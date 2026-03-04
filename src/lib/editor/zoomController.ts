/**
 * Zoom calculations, fit-to-screen math, and viewport apply.
 * Preserves existing zoom defaults and behavior.
 */

import type { Canvas } from "fabric";
import {
  FIT_MARGIN_RATIO,
  FIT_MIN_ZOOM,
  FIT_MAX_ZOOM,
  FIT_PAD,
  FIT_RESERVED_BOTTOM,
} from "@/types/editor";

export interface FitZoomInput {
  viewportW: number;
  viewportH: number;
  pageW: number;
  pageH: number;
  zoomCap?: number | null;
}

/**
 * Compute fit zoom so page fits in viewport (same formula as hook).
 */
export function getFitZoom(input: FitZoomInput): number {
  const { viewportW, viewportH, pageW, pageH, zoomCap } = input;
  if (pageW <= 0 || pageH <= 0) return 1;
  const effectiveW = viewportW - FIT_PAD * 2;
  const effectiveH = viewportH - FIT_RESERVED_BOTTOM - FIT_PAD * 2;
  if (effectiveW <= 0 || effectiveH <= 0) return 1;
  const rawFit =
    Math.min(effectiveW / pageW, effectiveH / pageH) * FIT_MARGIN_RATIO;
  const cap = zoomCap ?? FIT_MAX_ZOOM;
  return Math.max(FIT_MIN_ZOOM, Math.min(rawFit, cap));
}

export function clampEffectiveZoom(z: number): number {
  if (!Number.isFinite(z)) return 1;
  return Math.max(0.05, Math.min(2, z));
}

/**
 * Apply zoom to canvas viewport (page fills canvas, no translation).
 * vpt = [z, 0, 0, z, 0, 0]
 */
export function setZoom(
  canvas: Canvas,
  zoom: number,
  _anchor?: { x: number; y: number }
): void {
  const z = clampEffectiveZoom(zoom);
  const vpt: [number, number, number, number, number, number] = [
    z,
    0,
    0,
    z,
    0,
    0,
  ];
  canvas.setViewportTransform(vpt);
  canvas.calcOffset?.();
  canvas.requestRenderAll();
}

/**
 * Zoom in: multiply by 1.1, clamp.
 */
export function zoomIn(currentZoom: number): number {
  return clampEffectiveZoom(currentZoom * 1.1);
}

/**
 * Zoom out: divide by 1.1, clamp.
 */
export function zoomOut(currentZoom: number): number {
  return clampEffectiveZoom(currentZoom / 1.1);
}
