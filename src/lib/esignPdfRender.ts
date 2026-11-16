/**
 * Phone PDF raster metrics for the e-sign viewer.
 * Layout CSS size stays at fit width so overlays and export norms do not move.
 * Extra pixels go only into the canvas backing store.
 */

import { clampPhonePinchScale } from "./esignPdfTouch";

export const ESIGN_PDF_MAX_CANVAS_EDGE = 4096;
export const ESIGN_PDF_MAX_CANVAS_AREA = 16_777_216;
export const ESIGN_PHONE_PREVIEW_DPR_CAP = 2;

export function clampPdfOutputScale(
  cssWidth: number,
  cssHeight: number,
  desiredScale: number
): number {
  const width = cssWidth > 0 ? cssWidth : 1;
  const height = cssHeight > 0 ? cssHeight : 1;
  let scale = Number.isFinite(desiredScale) && desiredScale > 0 ? desiredScale : 1;
  scale = Math.min(scale, ESIGN_PDF_MAX_CANVAS_EDGE / width, ESIGN_PDF_MAX_CANVAS_EDGE / height);
  const area = width * height * scale * scale;
  if (area > ESIGN_PDF_MAX_CANVAS_AREA) {
    scale = Math.sqrt(ESIGN_PDF_MAX_CANVAS_AREA / (width * height));
  }
  return Math.max(1, scale);
}

export function phonePdfPreviewOutputScale(devicePixelRatio: number): number {
  const dpr = Number.isFinite(devicePixelRatio) && devicePixelRatio > 0 ? devicePixelRatio : 1;
  return Math.min(ESIGN_PHONE_PREVIEW_DPR_CAP, Math.max(1, dpr));
}

export function phonePdfSharpOutputScale(
  devicePixelRatio: number,
  cssZoom: number
): number {
  const dpr = Number.isFinite(devicePixelRatio) && devicePixelRatio > 0 ? devicePixelRatio : 1;
  return Math.max(1, dpr * clampPhonePinchScale(cssZoom));
}

export function phonePdfCanvasMetrics(input: {
  cssWidth: number;
  cssHeight: number;
  outputScale: number;
}): {
  outputScale: number;
  canvasWidth: number;
  canvasHeight: number;
  cssWidth: number;
  cssHeight: number;
} {
  const cssWidth = Math.max(1, input.cssWidth);
  const cssHeight = Math.max(1, input.cssHeight);
  const outputScale = clampPdfOutputScale(cssWidth, cssHeight, input.outputScale);
  return {
    outputScale,
    canvasWidth: Math.max(1, Math.round(cssWidth * outputScale)),
    canvasHeight: Math.max(1, Math.round(cssHeight * outputScale)),
    cssWidth,
    cssHeight,
  };
}

export function nearbyEsignPdfPages(
  visiblePage: number,
  pageCount: number,
  radius = 1
): number[] {
  const count = Math.max(0, Math.floor(pageCount));
  if (count < 1) return [];
  const visible = Math.min(count, Math.max(1, Math.floor(visiblePage) || 1));
  const start = Math.max(1, visible - radius);
  const end = Math.min(count, visible + radius);
  const pages: number[] = [];
  for (let page = start; page <= end; page++) pages.push(page);
  return pages;
}

export function phonePdfPaintNeeded(
  currentScale: number,
  targetScale: number,
  epsilon = 0.08
): boolean {
  if (!(currentScale > 0)) return true;
  return Math.abs(currentScale - targetScale) > epsilon;
}
