/**
 * Template ID assigner — permanent catalog ID with manifest uniqueness check.
 */
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { loadCatalog } from "./CatalogManager.js";

const REPO_ROOT = resolve(import.meta.dirname, "../../../../..");
const MANIFEST_PATH = join(REPO_ROOT, "templates.manifest.json");

export function loadExistingManifestIds(): Set<string> {
  const ids = new Set<string>();
  if (!existsSync(MANIFEST_PATH)) return ids;
  try {
    const manifest = JSON.parse(readFileSync(MANIFEST_PATH, "utf8")) as {
      templates?: Array<{ id: string }>;
    };
    for (const t of manifest.templates ?? []) {
      ids.add(t.id);
    }
  } catch {
    /* read-only best effort */
  }
  const catalog = loadCatalog();
  for (const t of catalog.templates) {
    ids.add(t.catalog_id);
  }
  return ids;
}

export function assignPermanentTemplateId(prototype_id: string): string {
  const existing = loadExistingManifestIds();
  const hash = [...prototype_id].reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  let candidate = 80 + (hash % 20);

  for (let i = 0; i < 100; i++) {
    const id = `t${String(candidate).padStart(3, "0")}`;
    if (!existing.has(id)) return id;
    candidate = (candidate % 99) + 1;
  }

  const maxNum = Math.max(
    0,
    ...[...existing]
      .map((id) => parseInt(id.replace("t", ""), 10))
      .filter((n) => !Number.isNaN(n)),
  );
  return `t${String(maxNum + 1).padStart(3, "0")}`;
}
