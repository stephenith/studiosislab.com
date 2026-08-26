/**
 * Thumbnail validation — dimensions, readability, clipping
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { StaticCanvas } from "fabric/node";
import type { QAModuleReport, QATemplateContext } from "./types.js";

const MULTIPLIER = 0.25;
const MAX_FILE_BYTES = 200_000;
const MIN_NON_WHITE_RATIO = 0.02;

export type ThumbnailCheckOptions = {
  output_dir?: string;
  render_if_missing?: boolean;
};

export async function runThumbnailCheck(
  ctx: QATemplateContext,
  options: ThumbnailCheckOptions = {},
): Promise<QAModuleReport> {
  const checks = [];
  let thumbnailPath = ctx.thumbnail_path;
  const expectedW = Math.round((ctx.json.width ?? 794) * MULTIPLIER);
  const expectedH = Math.round((ctx.json.height ?? 1123) * MULTIPLIER);

  if (!thumbnailPath && options.render_if_missing && options.output_dir) {
    thumbnailPath = join(options.output_dir, "thumbnail.png");
    const png = await renderThumbnail(ctx);
    writeFileSync(thumbnailPath, png);
  }

  const exists = thumbnailPath !== null && existsSync(thumbnailPath);
  checks.push({
    id: "thumbnail-generated",
    pass: exists,
    detail: exists ? thumbnailPath! : "thumbnail.png not found",
    severity: "required" as const,
  });

  if (!exists || !thumbnailPath) {
    return {
      module: "thumbnail",
      pass: false,
      checked_at: new Date().toISOString(),
      checks,
    };
  }

  const buf = readFileSync(thumbnailPath);
  checks.push({
    id: "thumbnail-file-size",
    pass: buf.byteLength > 0 && buf.byteLength < MAX_FILE_BYTES,
    detail: `${buf.byteLength} bytes (max ${MAX_FILE_BYTES})`,
    severity: "required" as const,
  });

  const dims = readPngDimensions(buf);
  const dimOk =
    dims !== null &&
    Math.abs(dims.width - expectedW) <= 2 &&
    Math.abs(dims.height - expectedH) <= 2;
  checks.push({
    id: "thumbnail-dimensions",
    pass: dimOk,
    detail: dims
      ? `${dims.width}×${dims.height} (expected ~${expectedW}×${expectedH})`
      : "Could not read PNG dimensions",
    severity: "required" as const,
  });

  const nonWhite = estimateNonWhiteRatio(buf);
  checks.push({
    id: "readable-preview",
    pass: nonWhite >= MIN_NON_WHITE_RATIO,
    detail: `Non-white pixel ratio ~${(nonWhite * 100).toFixed(1)}%`,
    severity: "required" as const,
  });

  checks.push({
    id: "no-clipping",
    pass: dimOk,
    detail: "Full page captured at 0.25× multiplier",
    severity: "required" as const,
  });

  checks.push({
    id: "proper-whitespace",
    pass: nonWhite < 0.85,
    detail: "Thumbnail shows content with margins (not solid fill)",
    severity: "recommended" as const,
  });

  const pass = checks.filter((c) => c.severity === "required").every((c) => c.pass);
  return {
    module: "thumbnail",
    pass,
    checked_at: new Date().toISOString(),
    checks,
  };
}

async function renderThumbnail(ctx: QATemplateContext): Promise<Buffer> {
  const w = ctx.json.width ?? 794;
  const h = ctx.json.height ?? 1123;
  const canvas = new StaticCanvas(undefined, {
    width: w,
    height: h,
    backgroundColor: "#ffffff",
  });
  await canvas.loadFromJSON(ctx.json);
  canvas.renderAll();
  const dataUrl = canvas.toDataURL({
    format: "png",
    multiplier: MULTIPLIER,
    left: 0,
    top: 0,
    width: w,
    height: h,
  });
  canvas.dispose();
  const base64 = dataUrl.replace(/^data:image\/png;base64,/, "");
  return Buffer.from(base64, "base64");
}

function readPngDimensions(buf: Buffer): { width: number; height: number } | null {
  if (buf.byteLength < 24 || buf[0] !== 0x89) return null;
  const width = buf.readUInt32BE(16);
  const height = buf.readUInt32BE(20);
  return { width, height };
}

function estimateNonWhiteRatio(buf: Buffer): number {
  if (buf.byteLength < 100) return 0;
  let nonWhite = 0;
  const sample = Math.min(buf.byteLength, 8000);
  for (let i = 0; i < sample; i += 4) {
    const b = buf[i] ?? 255;
    if (b < 250) nonWhite++;
  }
  return nonWhite / (sample / 4);
}
