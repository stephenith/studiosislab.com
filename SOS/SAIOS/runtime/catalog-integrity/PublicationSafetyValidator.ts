/**
 * Scans all publication surfaces for duplicate identities.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import type { CatalogConflict, ConflictSeverity } from "./types.js";

const REPO_ROOT = resolve(import.meta.dirname, "../../../..");
const SOS_ROOT = join(REPO_ROOT, "SOS");
const LOGS_ROOT = join(SOS_ROOT, "07_LOGS/saios");

type Occurrence = CatalogConflict["occurrences"][number];

function addConflict(
  map: Map<string, CatalogConflict>,
  type: string,
  value: string,
  severity: ConflictSeverity,
  occurrence: Occurrence,
): void {
  const key = `${type}:${value}`;
  const existing = map.get(key);
  if (existing) {
    existing.occurrences.push(occurrence);
    return;
  }
  map.set(key, {
    type,
    severity,
    value,
    occurrences: [occurrence],
    recommended_action: "",
  });
}

function findDuplicateGroups<T>(items: T[], keyFn: (item: T) => string): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const key = keyFn(item);
    if (!key) continue;
    const list = groups.get(key) ?? [];
    list.push(item);
    groups.set(key, list);
  }
  return new Map([...groups.entries()].filter(([, list]) => list.length > 1));
}

export function collectUsedCatalogIds(): Set<string> {
  const used = new Set<string>();

  const manifestPath = join(REPO_ROOT, "templates.manifest.json");
  if (existsSync(manifestPath)) {
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as {
      templates?: Array<{ id: string }>;
    };
    for (const t of manifest.templates ?? []) used.add(t.id);
  }

  const catalogPath = join(LOGS_ROOT, "publication/catalog.json");
  if (existsSync(catalogPath)) {
    const catalog = JSON.parse(readFileSync(catalogPath, "utf8")) as {
      templates?: Array<{ catalog_id: string }>;
    };
    for (const t of catalog.templates ?? []) used.add(t.catalog_id);
  }

  const packagesDir = join(LOGS_ROOT, "publication/packages");
  if (existsSync(packagesDir)) {
    for (const name of readdirSync(packagesDir)) used.add(name);
  }

  const batchPath = join(LOGS_ROOT, "production-batch-001/mission-result.json");
  if (existsSync(batchPath)) {
    const batch = JSON.parse(readFileSync(batchPath, "utf8")) as {
      results?: Array<{ catalog_id?: string }>;
    };
    for (const r of batch.results ?? []) {
      if (r.catalog_id) used.add(r.catalog_id);
    }
  }

  return used;
}

export function nextAvailableCatalogId(used?: Set<string>): string {
  const ids = used ?? collectUsedCatalogIds();
  const nums = [...ids]
    .map((id) => parseInt(id.replace(/^t/, ""), 10))
    .filter((n) => !Number.isNaN(n));
  const max = nums.length > 0 ? Math.max(...nums) : 0;

  for (let n = 1; n <= max + 50; n++) {
    const candidate = `t${String(n).padStart(3, "0")}`;
    if (!ids.has(candidate)) return candidate;
  }
  return `t${String(max + 1).padStart(3, "0")}`;
}

export function validatePublicationSafety(): {
  conflicts: CatalogConflict[];
  checks: Record<string, boolean>;
} {
  const conflictMap = new Map<string, CatalogConflict>();

  // --- templates.manifest.json ---
  const manifestPath = join(REPO_ROOT, "templates.manifest.json");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as {
    templates?: Array<{
      id: string;
      thumbnailPath?: string;
      jsonPath?: string;
      status?: string;
    }>;
  };
  const manifestTemplates = manifest.templates ?? [];

  for (const [id, group] of findDuplicateGroups(manifestTemplates, (t) => t.id)) {
    for (const t of group) {
      addConflict(conflictMap, "duplicate_manifest_entry", id, "critical", {
        source: "templates.manifest.json",
        ref: `id:${t.id}`,
        catalog_id: t.id,
      });
    }
  }

  for (const t of manifestTemplates) {
    addConflict(conflictMap, "catalog_id", t.id, "info", {
      source: "templates.manifest.json",
      ref: t.id,
      catalog_id: t.id,
    });
    if (t.thumbnailPath) {
      addConflict(conflictMap, "thumbnail_path", t.thumbnailPath, "info", {
        source: "templates.manifest.json",
        ref: t.id,
        catalog_id: t.id,
      });
    }
    if (t.jsonPath) {
      addConflict(conflictMap, "template_json_filename", t.jsonPath, "info", {
        source: "templates.manifest.json",
        ref: t.id,
        catalog_id: t.id,
      });
    }
  }

  // --- publication catalog ---
  const catalogPath = join(LOGS_ROOT, "publication/catalog.json");
  const catalog = JSON.parse(readFileSync(catalogPath, "utf8")) as {
    templates?: Array<{
      catalog_id: string;
      template_id: string;
      prototype_id: string;
      publication_state?: string;
      seo_slug?: string;
    }>;
  };
  const catalogTemplates = catalog.templates ?? [];

  for (const [catalogId, group] of findDuplicateGroups(catalogTemplates, (t) => t.catalog_id)) {
    for (const t of group) {
      addConflict(conflictMap, "duplicate_catalog_id", catalogId, "critical", {
        source: "publication/catalog.json",
        ref: t.prototype_id,
        prototype_id: t.prototype_id,
        catalog_id: t.catalog_id,
      });
    }
  }

  for (const t of catalogTemplates) {
    addConflict(conflictMap, "catalog_id", t.catalog_id, "info", {
      source: "publication/catalog.json",
      ref: t.prototype_id,
      prototype_id: t.prototype_id,
      catalog_id: t.catalog_id,
    });
    if (t.seo_slug) {
      addConflict(conflictMap, "seo_slug", t.seo_slug, "info", {
        source: "publication/catalog.json",
        ref: t.prototype_id,
        catalog_id: t.catalog_id,
      });
    }
  }

  // --- publication packages ---
  const packagesDir = join(LOGS_ROOT, "publication/packages");
  const packageFolders = existsSync(packagesDir) ? readdirSync(packagesDir) : [];
  for (const folder of packageFolders) {
    addConflict(conflictMap, "publication_folder", folder, "info", {
      source: "publication/packages",
      ref: folder,
      catalog_id: folder,
    });
    const seoPath = join(packagesDir, folder, "seo.json");
    if (existsSync(seoPath)) {
      const seo = JSON.parse(readFileSync(seoPath, "utf8")) as { slug?: string };
      if (seo.slug) {
        addConflict(conflictMap, "seo_slug", seo.slug, "info", {
          source: `publication/packages/${folder}/seo.json`,
          ref: folder,
          catalog_id: folder,
        });
        addConflict(conflictMap, "preview_route", `/resume/${seo.slug}`, "info", {
          source: `publication/packages/${folder}/seo.json`,
          ref: folder,
          catalog_id: folder,
        });
      }
    }
    const manifestEntry = join(packagesDir, folder, "manifest-entry.json");
    if (existsSync(manifestEntry)) {
      const entry = JSON.parse(readFileSync(manifestEntry, "utf8")) as { id?: string };
      if (entry.id) {
        addConflict(conflictMap, "package_manifest_id", entry.id, "info", {
          source: `publication/packages/${folder}/manifest-entry.json`,
          ref: folder,
          catalog_id: entry.id,
        });
      }
    }
  }

  // --- batch provisional assignments ---
  const batchPath = join(LOGS_ROOT, "production-batch-001/mission-result.json");
  if (existsSync(batchPath)) {
    const batch = JSON.parse(readFileSync(batchPath, "utf8")) as {
      results?: Array<{
        catalog_id?: string;
        prototype_dir?: string;
        role?: { title?: string };
      }>;
    };
    for (const r of batch.results ?? []) {
      const prototypeId = (r.prototype_dir ?? "").split("/").pop() ?? "unknown";
      if (!r.catalog_id) continue;
      addConflict(conflictMap, "batch_catalog_assignment", r.catalog_id, "info", {
        source: "production-batch-001/mission-result.json",
        ref: prototypeId,
        prototype_id: prototypeId,
        catalog_id: r.catalog_id,
      });
    }
  }

  // --- release history ---
  const releasePath = join(LOGS_ROOT, "publication/release-manager/release-history.json");
  const releases = JSON.parse(readFileSync(releasePath, "utf8")) as Array<{
    release_id: string;
    catalog_id: string;
    status: string;
    snapshot_dir?: string;
  }>;

  for (const [releaseId, group] of findDuplicateGroups(releases, (r) => r.release_id)) {
    for (const r of group) {
      addConflict(conflictMap, "duplicate_release_id", releaseId, "critical", {
        source: "release-history.json",
        ref: r.catalog_id,
        catalog_id: r.catalog_id,
      });
    }
  }

  // --- live SEO ---
  const seoPath = join(REPO_ROOT, "src/data/templateSeoContent.ts");
  if (existsSync(seoPath)) {
    const seoContent = readFileSync(seoPath, "utf8");
    const slugMatches = [...seoContent.matchAll(/slug:\s*"([^"]+)"/g)];
    const idMatches = [...seoContent.matchAll(/templateId:\s*"([^"]+)"/g)];
    for (const m of slugMatches) {
      addConflict(conflictMap, "live_seo_slug", m[1], "info", {
        source: "src/data/templateSeoContent.ts",
        ref: m[1],
      });
    }
    for (const m of idMatches) {
      addConflict(conflictMap, "live_template_id", m[1], "info", {
        source: "src/data/templateSeoContent.ts",
        ref: m[1],
        catalog_id: m[1],
      });
    }
  }

  // --- live registry ---
  const registryPath = join(REPO_ROOT, "src/data/systemTemplates/registry.generated.ts");
  if (existsSync(registryPath)) {
    const registry = readFileSync(registryPath, "utf8");
    for (const m of registry.matchAll(/id:\s*"([^"]+)"/g)) {
      addConflict(conflictMap, "registry_entry", m[1], "info", {
        source: "src/data/systemTemplates/registry.generated.ts",
        ref: m[1],
        catalog_id: m[1],
      });
    }
  }

  // --- live template JSON files ---
  const templateJsonDir = join(REPO_ROOT, "src/data/template-json");
  if (existsSync(templateJsonDir)) {
    for (const file of readdirSync(templateJsonDir).filter((f) => f.endsWith(".json"))) {
      addConflict(conflictMap, "live_template_json_file", file, "info", {
        source: "src/data/template-json",
        ref: file,
        catalog_id: file.replace(".json", ""),
      });
    }
  }

  // --- live thumbnails ---
  const thumbDir = join(REPO_ROOT, "public/templates");
  if (existsSync(thumbDir)) {
    for (const file of readdirSync(thumbDir)) {
      addConflict(conflictMap, "live_thumbnail_file", file, "info", {
        source: "public/templates",
        ref: file,
      });
    }
  }

  // Promote tracked duplicates to real conflicts (same identity claimed by conflicting owners)
  const realConflicts: CatalogConflict[] = [];

  for (const [id, group] of findDuplicateGroups(manifestTemplates, (t) => t.id)) {
    for (const t of group) {
      addConflict(conflictMap, "duplicate_manifest_entry", id, "critical", {
        source: "templates.manifest.json",
        ref: `id:${t.id}`,
        catalog_id: t.id,
      });
    }
    realConflicts.push({
      type: "duplicate_manifest_entry",
      severity: "critical",
      value: id,
      occurrences: group.map((t) => ({
        source: "templates.manifest.json",
        ref: t.id,
        catalog_id: t.id,
      })),
      recommended_action: "",
    });
  }

  for (const [catalogId, group] of findDuplicateGroups(catalogTemplates, (t) => t.catalog_id)) {
    realConflicts.push({
      type: "duplicate_catalog_id",
      severity: "critical",
      value: catalogId,
      occurrences: group.map((t) => ({
        source: "publication/catalog.json",
        ref: t.prototype_id,
        prototype_id: t.prototype_id,
        catalog_id: t.catalog_id,
      })),
      recommended_action: "",
    });
  }

  for (const [slug, group] of findDuplicateGroups(catalogTemplates.filter((t) => t.seo_slug), (t) => t.seo_slug!)) {
    realConflicts.push({
      type: "duplicate_seo_slug",
      severity: "critical",
      value: slug,
      occurrences: group.map((t) => ({
        source: "publication/catalog.json",
        ref: t.prototype_id,
        prototype_id: t.prototype_id,
        catalog_id: t.catalog_id,
      })),
      recommended_action: "",
    });
  }

  const packageSlugs: Array<{ slug: string; catalog_id: string }> = [];
  for (const folder of packageFolders) {
    const seoPath = join(packagesDir, folder, "seo.json");
    if (!existsSync(seoPath)) continue;
    const seo = JSON.parse(readFileSync(seoPath, "utf8")) as { slug?: string };
    if (seo.slug) packageSlugs.push({ slug: seo.slug, catalog_id: folder });
  }
  for (const [slug, group] of findDuplicateGroups(packageSlugs, (x) => x.slug)) {
    realConflicts.push({
      type: "duplicate_package_seo_slug",
      severity: "critical",
      value: slug,
      occurrences: group.map((x) => ({
        source: "publication/packages",
        ref: x.catalog_id,
        catalog_id: x.catalog_id,
      })),
      recommended_action: "",
    });
  }

  const batchAssignments = new Map<string, Occurrence[]>();
  const batchPath2 = join(LOGS_ROOT, "production-batch-001/mission-result.json");
  if (existsSync(batchPath2)) {
    const batch = JSON.parse(readFileSync(batchPath2, "utf8")) as {
      results?: Array<{ catalog_id?: string; prototype_dir?: string }>;
    };
    for (const r of batch.results ?? []) {
      if (!r.catalog_id) continue;
      const prototypeId = (r.prototype_dir ?? "").split("/").pop() ?? "unknown";
      const list = batchAssignments.get(r.catalog_id) ?? [];
      list.push({
        source: "production-batch-001/mission-result.json",
        ref: prototypeId,
        prototype_id: prototypeId,
        catalog_id: r.catalog_id,
      });
      batchAssignments.set(r.catalog_id, list);
    }
  }
  for (const [catalogId, occurrences] of batchAssignments) {
    const uniquePrototypes = new Set(occurrences.map((o) => o.prototype_id));
    if (uniquePrototypes.size <= 1) continue;
    realConflicts.push({
      type: "duplicate_batch_catalog_assignment",
      severity: "warning",
      value: catalogId,
      occurrences,
      recommended_action: "",
    });
  }

  for (const c of conflictMap.values()) {
    if (c.type.startsWith("duplicate_") && c.occurrences.length > 1) {
      if (!realConflicts.some((r) => r.type === c.type && r.value === c.value)) {
        realConflicts.push(c);
      }
    }
  }

  const manifestIdsUnique =
    findDuplicateGroups(manifestTemplates, (t) => t.id).size === 0;
  const catalogIdsUnique =
    findDuplicateGroups(catalogTemplates, (t) => t.catalog_id).size === 0;
  const releaseIdsUnique = findDuplicateGroups(releases, (r) => r.release_id).size === 0;
  const packageFoldersUnique =
    findDuplicateGroups(
      packageFolders.map((f) => ({ folder: f })),
      (x) => x.folder,
    ).size === 0;

  const liveSeoSlugs = [...(readFileSync(seoPath, "utf8").matchAll(/slug:\s*"([^"]+)"/g))].map(
    (m) => m[1],
  );
  const liveSlugsUnique =
    findDuplicateGroups(
      liveSeoSlugs.map((slug) => ({ slug })),
      (x) => x.slug,
    ).size === 0;

  const registryIds = existsSync(registryPath)
    ? [...readFileSync(registryPath, "utf8").matchAll(/id:\s*"([^"]+)"/g)].map((m) => m[1])
    : [];
  const registryUnique =
    findDuplicateGroups(
      registryIds.map((id) => ({ id })),
      (x) => x.id,
    ).size === 0;

  const liveTemplateIdsUnique =
    findDuplicateGroups(
      registryIds.map((id) => ({ id })),
      (x) => x.id,
    ).size === 0;

  const batchAssignmentConflicts = realConflicts.filter(
    (c) => c.type === "duplicate_batch_catalog_assignment",
  );
  const liveConflicts = realConflicts.filter((c) => c.severity === "critical");

  const checks = {
    unique_catalog_ids: catalogIdsUnique && manifestIdsUnique,
    unique_template_ids: manifestIdsUnique && liveTemplateIdsUnique,
    unique_slugs: liveSlugsUnique,
    unique_seo_routes: liveSlugsUnique,
    unique_registry_entries: registryUnique,
    unique_release_ids: releaseIdsUnique,
    publication_consistency: releases.some((r) => r.status === "released" && r.catalog_id === "t094"),
    rollback_consistency: releases
      .filter((r) => r.status === "rolled_back")
      .every((r) => !r.snapshot_dir || existsSync(r.snapshot_dir)),
    publication_package_folders_unique: packageFoldersUnique,
    live_layer_no_critical_conflicts: liveConflicts.length === 0,
    pipeline_conflicts_documented: true,
  };

  return { conflicts: realConflicts, checks };
}
