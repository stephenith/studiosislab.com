/**
 * Catalog manager — master catalog with categories and template entries.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import type { CatalogEntry, CategoryMetadata, MasterCatalog, TemplateMetadata } from "./types.js";

const SOS_ROOT = resolve(import.meta.dirname, "../../..");
export const PUBLICATION_ROOT = join(SOS_ROOT, "07_LOGS/saios/publication");
const CATALOG_PATH = join(PUBLICATION_ROOT, "catalog.json");

const DEFAULT_CATEGORIES: CategoryMetadata[] = [
  {
    category_id: "professional",
    label: "Professional",
    description: "Corporate and business resume templates",
    template_count: 0,
    industries: ["finance", "software", "operations"],
    ats_tiers: ["ats_safe", "hybrid"],
  },
  {
    category_id: "business",
    label: "Business",
    description: "Business and management templates",
    template_count: 0,
    industries: ["executive", "management"],
    ats_tiers: ["ats_safe", "visual"],
  },
  {
    category_id: "creative",
    label: "Creative",
    description: "Visual and creative resume templates",
    template_count: 0,
    industries: ["creative", "marketing"],
    ats_tiers: ["visual", "hybrid"],
  },
];

export function loadCatalog(): MasterCatalog {
  if (!existsSync(CATALOG_PATH)) return createDefaultCatalog();
  try {
    return JSON.parse(readFileSync(CATALOG_PATH, "utf8")) as MasterCatalog;
  } catch {
    return createDefaultCatalog();
  }
}

function createDefaultCatalog(): MasterCatalog {
  return {
    version: "1.0.0",
    updated_at: new Date().toISOString(),
    categories: [...DEFAULT_CATEGORIES],
    templates: [],
  };
}

export function upsertCatalogEntry(
  metadata: TemplateMetadata & { slug: string; thumbnail_path: string },
  persist = true,
): MasterCatalog {
  const catalog = loadCatalog();
  const entry: CatalogEntry = {
    ...metadata,
    slug: metadata.slug,
    thumbnail_path: metadata.thumbnail_path,
    added_at: new Date().toISOString(),
  };

  const idx = catalog.templates.findIndex((t) => t.catalog_id === metadata.catalog_id);
  if (idx >= 0) catalog.templates[idx] = entry;
  else catalog.templates.push(entry);

  for (const cat of catalog.categories) {
    cat.template_count = catalog.templates.filter((t) => t.category_id === cat.category_id).length;
  }

  catalog.updated_at = new Date().toISOString();

  if (persist) {
    mkdirSync(PUBLICATION_ROOT, { recursive: true });
    writeFileSync(CATALOG_PATH, JSON.stringify(catalog, null, 2));
  }

  return catalog;
}
