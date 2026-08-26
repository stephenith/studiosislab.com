/**
 * Thumbnail preparer — copy thumbnail and catalog preview.
 */
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

export function prepareThumbnails(input: {
  prototype_dir: string;
  package_dir: string;
  catalog_id: string;
}): { thumbnail: string; catalog_preview: string } {
  const src = join(input.prototype_dir, "thumbnail.png");
  if (!existsSync(src)) {
    throw new Error("thumbnail.png required for publication package");
  }
  const thumbnail = join(input.package_dir, "thumbnail.png");
  const catalog_preview = join(input.package_dir, "catalog-preview.png");
  mkdirSync(input.package_dir, { recursive: true });
  copyFileSync(src, thumbnail);
  copyFileSync(src, catalog_preview);
  return { thumbnail, catalog_preview };
}

export function copyTemplateJson(input: {
  prototype_dir: string;
  package_dir: string;
}): string {
  const src = join(input.prototype_dir, "template-preview.json");
  const dest = join(input.package_dir, "template.json");
  mkdirSync(input.package_dir, { recursive: true });
  copyFileSync(src, dest);
  return dest;
}
