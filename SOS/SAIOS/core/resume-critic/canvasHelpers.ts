/**
 * Shared canvas helpers for critics.
 */
import type { CanvasDocument, CanvasObject } from "./types.js";

export function isPageBg(o: CanvasObject): boolean {
  const data = o.data;
  return (
    o.role === "pageBackground" ||
    o.isPageBg === true ||
    data?.role === "pageBackground" ||
    data?.kind === "page-bg"
  );
}

export function contentObjects(canvas: CanvasDocument): CanvasObject[] {
  return canvas.objects.filter((o) => !isPageBg(o));
}

export function textObjects(canvas: CanvasDocument): CanvasObject[] {
  return canvas.objects.filter((o) => o.type === "Textbox");
}

export function sectionIdsFromCanvas(canvas: CanvasDocument): string[] {
  const ids: string[] = [];
  const seen = new Set<string>();
  for (const o of canvas.objects) {
    const section = String(o.data?.section ?? "");
    if (!section || section === "page") continue;
    if (!seen.has(section)) {
      seen.add(section);
      ids.push(section);
    }
  }
  return ids;
}

export function hasMultiColumn(canvas: CanvasDocument): boolean {
  const texts = textObjects(canvas);
  if (texts.length < 4) return false;
  const lefts = texts.map((t) => Number(t.left ?? 0));
  const min = Math.min(...lefts);
  const max = Math.max(...lefts);
  // Distinct x clusters > 80px apart → multi-column suspicion
  return max - min > 180;
}

export function detectTables(canvas: CanvasDocument): boolean {
  return canvas.objects.some(
    (o) =>
      String(o.type).toLowerCase() === "table" ||
      o.data?.role === "table" ||
      o.data?.kind === "table",
  );
}

export function detectIcons(canvas: CanvasDocument): boolean {
  return canvas.objects.some(
    (o) =>
      o.data?.role === "icon" ||
      o.data?.kind === "icon" ||
      String(o.type) === "Path" && o.data?.icon === true,
  );
}

export function detectImages(canvas: CanvasDocument): boolean {
  return canvas.objects.some(
    (o) => o.type === "Image" || o.type === "FabricImage",
  );
}

export function keywordDensity(text: string, keywords: string[]): number {
  const lower = text.toLowerCase();
  if (!lower.trim()) return 0;
  const words = lower.split(/\s+/).filter(Boolean).length || 1;
  let hits = 0;
  for (const k of keywords) {
    const re = new RegExp(`\\b${k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "gi");
    hits += (lower.match(re) ?? []).length;
  }
  return hits / words;
}
