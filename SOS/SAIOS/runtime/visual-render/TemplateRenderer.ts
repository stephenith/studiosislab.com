/**
 * Template renderer — Fabric offscreen render (pixel-accurate, same as editor canvas).
 */
import { StaticCanvas, type FabricObject } from "fabric/node";
import type { RenderMetrics } from "./types.js";

export type RenderSnapshot = {
  png: Buffer;
  width: number;
  height: number;
  multiplier: number;
  metrics: RenderMetrics;
};

const ANALYSIS_MULTIPLIER = 0.5;

export async function renderTemplateForEvaluation(json: {
  version?: string;
  width?: number;
  height?: number;
  objects: unknown[];
}): Promise<RenderSnapshot> {
  const w = json.width ?? 794;
  const h = json.height ?? 1123;

  const canvas = new StaticCanvas(undefined, {
    width: w,
    height: h,
    backgroundColor: "#ffffff",
  });

  await canvas.loadFromJSON(json);
  canvas.renderAll();

  const metrics = extractRenderMetrics(canvas, w, h);

  const dataUrl = canvas.toDataURL({
    format: "png",
    multiplier: ANALYSIS_MULTIPLIER,
    left: 0,
    top: 0,
    width: w,
    height: h,
  });
  canvas.dispose();

  const base64 = dataUrl.replace(/^data:image\/png;base64,/, "");
  const png = Buffer.from(base64, "base64");

  const non_white = estimateNonWhiteRatio(png);
  metrics.non_white_ratio = non_white;

  return {
    png,
    width: Math.round(w * ANALYSIS_MULTIPLIER),
    height: Math.round(h * ANALYSIS_MULTIPLIER),
    multiplier: ANALYSIS_MULTIPLIER,
    metrics,
  };
}

function extractRenderMetrics(canvas: StaticCanvas, w: number, h: number): RenderMetrics {
  const objects = canvas.getObjects() as FabricObject[];
  const contentObjects = objects.filter((o) => !isPageBackground(o));
  const textboxes = contentObjects.filter((o) => o.type === "textbox" || o.type === "Textbox");

  const lefts: number[] = [];
  const tops: number[] = [];
  const bottoms: number[] = [];
  const fontSizes: number[] = [];
  let accentCount = 0;

  for (const obj of contentObjects) {
    const left = obj.left ?? 0;
    const top = obj.top ?? 0;
    const height = (obj.height ?? 0) * (obj.scaleY ?? 1);
    lefts.push(left);
    tops.push(top);
    bottoms.push(top + height);

    const fill = String(obj.fill ?? "");
    if (fill.startsWith("#") && fill !== "#ffffff" && fill !== "#111827" && fill !== "#4b5563") {
      accentCount += 1;
    }

    const fs = (obj as { fontSize?: number }).fontSize;
    if (typeof fs === "number") fontSizes.push(fs);
  }

  const contentLeft = lefts.length ? Math.min(...lefts) : 56;
  const contentRight = lefts.length ? Math.max(...lefts) : w - 56;
  const contentTop = tops.length ? Math.min(...tops) : 0;
  const contentBottom = bottoms.length ? Math.max(...bottoms) : 0;

  const bands = [0, 0, 0, 0, 0];
  for (const top of tops) {
    const band = Math.min(4, Math.floor((top / h) * 5));
    bands[band] = (bands[band] ?? 0) + 1;
  }

  const headerZone = tops.filter((t) => t < h * 0.22).length;
  const bodyZone = tops.filter((t) => t >= h * 0.22).length;

  const columnBuckets = new Set(lefts.map((l) => Math.round(l / 8) * 8));

  return {
    canvas_width: w,
    canvas_height: h,
    object_count: contentObjects.length,
    textbox_count: textboxes.length,
    left_margin_px: Math.round(contentLeft),
    right_margin_px: Math.round(w - contentRight),
    content_top_px: Math.round(contentTop),
    content_bottom_px: Math.round(contentBottom),
    vertical_bands: bands,
    non_white_ratio: 0,
    header_zone_density: contentObjects.length > 0 ? headerZone / contentObjects.length : 0,
    body_zone_density: contentObjects.length > 0 ? bodyZone / contentObjects.length : 0,
    alignment_columns: [...columnBuckets].sort((a, b) => a - b),
    font_sizes_pt: fontSizes.sort((a, b) => b - a),
    accent_count: accentCount,
  };
}

function isPageBackground(obj: FabricObject): boolean {
  const o = obj as {
    isPageBg?: boolean;
    role?: string;
    data?: { role?: string };
  };
  return Boolean(o.isPageBg || o.role === "pageBackground" || o.data?.role === "pageBackground");
}

function estimateNonWhiteRatio(buf: Buffer): number {
  if (buf.byteLength < 100) return 0;
  let nonWhite = 0;
  const sample = Math.min(buf.byteLength, 16000);
  for (let i = 0; i < sample; i += 4) {
    const b = buf[i] ?? 255;
    if (b < 250) nonWhite++;
  }
  return nonWhite / (sample / 4);
}
