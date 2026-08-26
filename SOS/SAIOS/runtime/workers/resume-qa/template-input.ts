/**
 * Load generated resume templates from Resume Production Worker output.
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import type { FabricCanvasJson, QATemplateContext } from "./types.js";

const SOS_ROOT = resolve(import.meta.dirname, "../../../..");
export const GENERATED_ROOT = join(SOS_ROOT, "07_LOGS/saios/generated-resumes");
export const QA_OUTPUT_ROOT = join(SOS_ROOT, "07_LOGS/saios/qa");

const PREVIEW_FILE = "template-preview.json";

function slugToTitle(slug: string): string {
  return slug
    .replace(/-v\d+$/, "")
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function proposeCatalogId(prototypeId: string): string {
  const hash = [...prototypeId].reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  const num = 80 + (hash % 20);
  return `t${String(num).padStart(3, "0")}`;
}

export function findLatestGeneratedDir(root = GENERATED_ROOT): string {
  if (!existsSync(root)) {
    throw new Error(`Generated resumes root not found: ${root}`);
  }
  const dirs = readdirSync(root)
    .map((name) => join(root, name))
    .filter((p) => statSync(p).isDirectory())
    .filter((p) => existsSync(join(p, PREVIEW_FILE)));

  if (dirs.length === 0) {
    throw new Error(`No ${PREVIEW_FILE} found under ${root}`);
  }

  dirs.sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs);
  return dirs[0]!;
}

export function loadTemplateContext(sourceDir?: string): QATemplateContext {
  const dir = sourceDir ?? findLatestGeneratedDir();
  const previewPath = join(dir, PREVIEW_FILE);
  const raw = JSON.parse(readFileSync(previewPath, "utf8")) as FabricCanvasJson;
  const prototype_id = dir.split("/").pop() ?? "unknown";
  const thumbnail_path = existsSync(join(dir, "thumbnail.png"))
    ? join(dir, "thumbnail.png")
    : null;

  let family_id = "corporate-modern";
  let tier: "ats_safe" | "visual" = "ats_safe";
  const validationPath = join(dir, "validation.json");
  if (existsSync(validationPath)) {
    const prior = JSON.parse(readFileSync(validationPath, "utf8")) as {
      tier?: string;
    };
    if (prior.tier === "visual") tier = "visual";
  }

  const designReport = join(dir, "design-report.md");
  if (existsSync(designReport)) {
    const md = readFileSync(designReport, "utf8");
    const familyMatch = md.match(/family[:\s]+`?([a-z-]+)`?/i);
    if (familyMatch?.[1]) family_id = familyMatch[1];
  }

  const title = slugToTitle(prototype_id);
  const proposed_catalog_id = proposeCatalogId(prototype_id);

  return {
    template_id: prototype_id,
    prototype_id,
    tier,
    title,
    family_id,
    category_id: "professional",
    source_dir: dir,
    json: normalizeCanvasJson(raw),
    thumbnail_path,
    proposed_catalog_id,
  };
}

export function normalizeCanvasJson(input: unknown): FabricCanvasJson {
  if (Array.isArray(input)) {
    const page = input[0] as FabricCanvasJson;
    return {
      version: page.version ?? "6.9.1",
      width: 794,
      height: 1123,
      objects: page.objects ?? [],
      background: page.background,
    };
  }
  const flat = input as FabricCanvasJson;
  return {
    version: flat.version ?? "6.9.1",
    width: flat.width ?? 794,
    height: flat.height ?? 1123,
    objects: flat.objects ?? [],
    background: flat.background,
  };
}
