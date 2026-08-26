/**
 * Tracks catalog ID history across releases, packages, and manifest.
 */
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import type { CatalogHistoryEntry } from "./types.js";

const REPO_ROOT = resolve(import.meta.dirname, "../../../..");
const SOS_ROOT = join(REPO_ROOT, "SOS");
const LOGS_ROOT = join(SOS_ROOT, "07_LOGS/saios");

export function buildCatalogHistory(): CatalogHistoryEntry[] {
  const manifest = JSON.parse(
    readFileSync(join(REPO_ROOT, "templates.manifest.json"), "utf8"),
  ) as {
    templates?: Array<{ id: string; status?: string }>;
  };
  const published = new Set(
    (manifest.templates ?? []).filter((t) => t.status === "published").map((t) => t.id),
  );

  const catalog = JSON.parse(
    readFileSync(join(LOGS_ROOT, "publication/catalog.json"), "utf8"),
  ) as {
    templates?: Array<{
      catalog_id: string;
      prototype_id: string;
      publication_state?: string;
      created_at?: string;
    }>;
  };

  const releases = JSON.parse(
    readFileSync(join(LOGS_ROOT, "publication/release-manager/release-history.json"), "utf8"),
  ) as Array<{
    release_id: string;
    catalog_id: string;
    release_date: string;
    status: string;
  }>;

  const byCatalog = new Map<string, CatalogHistoryEntry>();

  for (const t of catalog.templates ?? []) {
    byCatalog.set(t.catalog_id, {
      catalog_id: t.catalog_id,
      prototype_id: t.prototype_id,
      first_seen: t.created_at ?? null,
      publication_state: t.publication_state ?? "unknown",
      live: published.has(t.catalog_id),
      release_ids: [],
      rollback_count: 0,
      sources: ["publication/catalog.json"],
    });
  }

  for (const r of releases) {
    const entry = byCatalog.get(r.catalog_id) ?? {
      catalog_id: r.catalog_id,
      prototype_id: null,
      first_seen: r.release_date,
      publication_state: r.status,
      live: r.status === "released",
      release_ids: [],
      rollback_count: 0,
      sources: ["release-history.json"],
    };
    entry.release_ids.push(r.release_id);
    if (r.status === "rolled_back") entry.rollback_count += 1;
    if (r.status === "released") entry.live = true;
    if (!entry.sources.includes("release-history.json")) {
      entry.sources.push("release-history.json");
    }
    byCatalog.set(r.catalog_id, entry);
  }

  for (const t of manifest.templates ?? []) {
    if (!byCatalog.has(t.id) && t.status === "published") {
      byCatalog.set(t.id, {
        catalog_id: t.id,
        prototype_id: null,
        first_seen: null,
        publication_state: "published",
        live: true,
        release_ids: [],
        rollback_count: 0,
        sources: ["templates.manifest.json"],
      });
    }
  }

  const packagesDir = join(LOGS_ROOT, "publication/packages");
  if (existsSync(packagesDir)) {
    for (const id of byCatalog.keys()) {
      const entry = byCatalog.get(id)!;
      if (existsSync(join(packagesDir, id))) {
        if (!entry.sources.includes("publication/packages")) {
          entry.sources.push("publication/packages");
        }
      }
    }
  }

  return [...byCatalog.values()].sort((a, b) => a.catalog_id.localeCompare(b.catalog_id));
}
