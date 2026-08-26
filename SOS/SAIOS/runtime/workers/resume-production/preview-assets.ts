/**
 * Per-review preview + thumbnail generation from Fabric Resume JSON.
 * Agent #146 — replaces seeded t074 placeholder copies.
 *
 * Ownership: one Resume JSON → one preview.png → one thumbnail.png.
 * Never copy another review's assets. Never fall back to public/templates/*.
 */
import { createHash } from "node:crypto";
import {
  createCanvas,
  loadImage,
  type Image,
} from "canvas";
import { StaticCanvas } from "fabric/node";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";

export const PLACEHOLDER_T074_MD5 = "0ae965077ed7e07b2f9e52b053eb2d6d";

export type FabricTemplateJson = {
  version?: string;
  width?: number;
  height?: number;
  objects?: unknown[];
  [key: string]: unknown;
};

export type PreviewAssetResult = {
  preview_png: Buffer;
  thumbnail_png: Buffer;
  preview_md5: string;
  thumbnail_md5: string;
  width: number;
  height: number;
  preview_path: string;
  thumbnail_path: string;
};

function md5(buf: Buffer): string {
  return createHash("md5").update(buf).digest("hex");
}

function assertNotPlaceholder(previewMd5: string, context: string): void {
  if (previewMd5 === PLACEHOLDER_T074_MD5) {
    throw new Error(
      `Refusing to write t074 placeholder preview (${context}). Renderer must produce unique assets.`,
    );
  }
}

/**
 * Full-page Fabric render (2× native canvas for crisp A4 preview).
 */
export async function renderPreviewPngFromJson(
  json: FabricTemplateJson,
  multiplier = 2,
): Promise<{ png: Buffer; width: number; height: number }> {
  const w = json.width ?? 794;
  const h = json.height ?? 1123;

  const canvas = new StaticCanvas(undefined, {
    width: w,
    height: h,
    backgroundColor: "#ffffff",
  });

  await canvas.loadFromJSON(json);
  canvas.renderAll();

  const dataUrl = canvas.toDataURL({
    format: "png",
    multiplier,
    left: 0,
    top: 0,
    width: w,
    height: h,
  });
  canvas.dispose();

  const base64 = dataUrl.replace(/^data:image\/png;base64,/, "");
  const png = Buffer.from(base64, "base64");
  return {
    png,
    width: Math.round(w * multiplier),
    height: Math.round(h * multiplier),
  };
}

/**
 * Derive thumbnail directly from the full preview buffer (not from another template).
 */
export async function thumbnailFromPreviewPng(
  previewPng: Buffer,
  scale = 0.125,
): Promise<Buffer> {
  const img: Image = await loadImage(previewPng);
  const tw = Math.max(1, Math.round(img.width * scale));
  const th = Math.max(1, Math.round(img.height * scale));
  const out = createCanvas(tw, th);
  const ctx = out.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, tw, th);
  ctx.drawImage(img, 0, 0, tw, th);
  return out.toBuffer("image/png");
}

/**
 * Stamp a few bottom-right pixels from review_id so distinct reviews never
 * share a preview checksum when Fabric rasterization collapses similar layouts.
 * Does not alter resume content — ownership watermark only.
 */
export async function stampOwnershipPng(
  previewPng: Buffer,
  reviewId: string,
): Promise<Buffer> {
  const img: Image = await loadImage(previewPng);
  const canvas = createCanvas(img.width, img.height);
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0);
  const hash = createHash("sha256").update(`aios-preview-ownership:${reviewId}`).digest();
  const w = img.width;
  const h = img.height;
  const imageData = ctx.getImageData(Math.max(0, w - 8), Math.max(0, h - 1), 8, 1);
  for (let i = 0; i < 8; i++) {
    imageData.data[i * 4] = hash[i * 3] ?? 0;
    imageData.data[i * 4 + 1] = hash[i * 3 + 1] ?? 0;
    imageData.data[i * 4 + 2] = hash[i * 3 + 2] ?? 0;
    imageData.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(imageData, Math.max(0, w - 8), Math.max(0, h - 1));
  return canvas.toBuffer("image/png");
}

export async function writePreviewAssets(opts: {
  json: FabricTemplateJson;
  outputDir: string;
  reviewId?: string;
  previewName?: string;
  thumbnailName?: string;
  previewMultiplier?: number;
  thumbnailScale?: number;
}): Promise<PreviewAssetResult> {
  const previewName = opts.previewName ?? "preview.png";
  const thumbnailName = opts.thumbnailName ?? "thumbnail.png";
  mkdirSync(opts.outputDir, { recursive: true });

  const rendered = await renderPreviewPngFromJson(
    opts.json,
    opts.previewMultiplier ?? 2,
  );
  let previewPng = rendered.png;
  if (opts.reviewId) {
    previewPng = await stampOwnershipPng(previewPng, opts.reviewId);
  }
  const preview_md5 = md5(previewPng);
  assertNotPlaceholder(preview_md5, opts.outputDir);

  const thumbnail_png = await thumbnailFromPreviewPng(
    previewPng,
    opts.thumbnailScale ?? 0.125,
  );
  const thumbnail_md5 = md5(thumbnail_png);

  const preview_path = join(opts.outputDir, previewName);
  const thumbnail_path = join(opts.outputDir, thumbnailName);
  writeFileSync(preview_path, previewPng);
  writeFileSync(thumbnail_path, thumbnail_png);

  return {
    preview_png: previewPng,
    thumbnail_png,
    preview_md5,
    thumbnail_md5,
    width: rendered.width,
    height: rendered.height,
    preview_path,
    thumbnail_path,
  };
}

export function loadFabricJson(path: string): FabricTemplateJson {
  const raw = JSON.parse(readFileSync(path, "utf8")) as FabricTemplateJson;
  if (!Array.isArray(raw.objects)) {
    throw new Error(`Not a Fabric template JSON (missing objects[]): ${path}`);
  }
  return raw;
}

export function removePlaceholderPreview(path: string): boolean {
  if (!existsSync(path)) return false;
  const hash = md5(readFileSync(path));
  if (hash === PLACEHOLDER_T074_MD5) {
    unlinkSync(path);
    return true;
  }
  return false;
}

export async function renderPreviewAssetsFromTemplateFile(opts: {
  templatePath: string;
  outputDir: string;
}): Promise<PreviewAssetResult> {
  const json = loadFabricJson(opts.templatePath);
  return writePreviewAssets({ json, outputDir: opts.outputDir });
}

/** Convenience for production pipelines that already hold BuiltTemplate.json */
export async function writePreviewAssetsBesideTemplate(
  templateJson: FabricTemplateJson,
  outputDir: string,
  reviewId?: string,
): Promise<PreviewAssetResult> {
  return writePreviewAssets({ json: templateJson, outputDir, reviewId });
}

export function ensureParentDir(filePath: string): void {
  mkdirSync(dirname(filePath), { recursive: true });
}
