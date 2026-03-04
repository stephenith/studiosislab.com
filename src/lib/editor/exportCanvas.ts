/**
 * Export canvas to PNG/PDF with white background and correct dimensions.
 * Do not change export appearance.
 */

import type { Canvas } from "fabric";
import { jsPDF } from "jspdf";

export interface PageBounds {
  left: number;
  top: number;
  width: number;
  height: number;
  fabricObj?: any;
}

export interface ExportToDataURLOptions {
  multiplier?: number;
  getPageBounds: (canvas: Canvas) => PageBounds | null;
}

/**
 * Export canvas region (page bounds) to PNG data URL.
 * Temporarily resets viewport and page shadow for a clean export, then restores.
 */
export function exportToDataURL(
  canvas: Canvas,
  options: ExportToDataURLOptions
): { dataUrl: string; width: number; height: number } | null {
  const { multiplier = 2, getPageBounds } = options;
  const pageBounds = getPageBounds(canvas);
  if (!pageBounds) return null;
  const { left, top, width, height, fabricObj: pageFabricObj } = pageBounds;
  const prevVt = canvas.viewportTransform ? [...canvas.viewportTransform] : null;
  const prevZoom = (canvas as any).getZoom?.() ?? 1;
  const prevShadow = pageFabricObj?.shadow;

  canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
  (canvas as any).setZoom?.(1);
  if (pageFabricObj) pageFabricObj.set?.({ shadow: null });
  canvas.requestRenderAll();

  const dataUrl = canvas.toDataURL({
    format: "png",
    left,
    top,
    width,
    height,
    multiplier,
  });

  if (prevVt) canvas.setViewportTransform(prevVt as any);
  (canvas as any).setZoom?.(prevZoom);
  if (pageFabricObj) pageFabricObj.set?.({ shadow: prevShadow });
  canvas.requestRenderAll();

  return { dataUrl, width, height };
}

export interface PageExportResult {
  dataUrl: string;
  width: number;
  height: number;
}

/**
 * Build a PDF Blob from multiple page export results.
 */
export function buildPDFFromPages(pages: PageExportResult[]): Blob {
  if (!pages.length) throw new Error("No pages to export");
  const first = pages[0];
  let pdf = new jsPDF({
    orientation: "portrait",
    unit: "px",
    format: [first.width, first.height],
  });
  pdf.addImage(first.dataUrl, "PNG", 0, 0, first.width, first.height);
  for (let i = 1; i < pages.length; i++) {
    const p = pages[i];
    pdf.addPage([p.width, p.height], "portrait");
    pdf.addImage(p.dataUrl, "PNG", 0, 0, p.width, p.height);
  }
  return pdf.output("blob");
}
