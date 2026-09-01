/**
 * Phase 5T — assert every catalogue ID referenced by pending website publication
 * state has required assets in the pending tracked Git tree (not merely on disk).
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

export const PREPUSH_BUILD_SOURCE = "TRACKED_PENDING_TREE" as const;

export type PendingTrackedTreeSource = {
  repoRoot: string;
  /** Relative paths that will be committed from the working tree. */
  pendingPaths: string[];
};

export type TrackedClosureMissing = {
  catalogue_id: string;
  missing_tracked_path: string;
  referenced_by: string;
};

export type TrackedClosureResult = {
  ok: boolean;
  catalogue_ids: string[];
  missing: TrackedClosureMissing[];
  error: string | null;
};

const SHARED_REF_FILES = [
  "templates.manifest.json",
  "src/data/templateSnapshots.generated.ts",
  "src/data/systemTemplates/registry.generated.ts",
  "src/data/templateCatalog.generated.ts",
] as const;

function normalizeRel(p: string): string {
  return p.replace(/\\/g, "/").replace(/^\.\//, "");
}

function gitOk(cwd: string, args: string[]): boolean {
  const r = spawnSync("git", args, { cwd, encoding: "utf8" });
  return r.status === 0;
}

function gitShow(cwd: string, revPath: string): string | null {
  const r = spawnSync("git", ["show", revPath], {
    cwd,
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
  });
  if (r.status !== 0) return null;
  return r.stdout ?? "";
}

/** True if path exists in HEAD+pending overlay (excludes unrelated untracked). */
export function pathInPendingTrackedTree(
  source: PendingTrackedTreeSource,
  relPath: string,
): boolean {
  const norm = normalizeRel(relPath);
  const pending = new Set(source.pendingPaths.map(normalizeRel));
  if (pending.has(norm)) {
    return existsSync(join(source.repoRoot, norm));
  }
  return gitOk(source.repoRoot, ["cat-file", "-e", `HEAD:${norm}`]);
}

/** Read file content from pending overlay, else HEAD. */
export function readPendingTrackedFile(
  source: PendingTrackedTreeSource,
  relPath: string,
): string | null {
  const norm = normalizeRel(relPath);
  const pending = new Set(source.pendingPaths.map(normalizeRel));
  if (pending.has(norm)) {
    const abs = join(source.repoRoot, norm);
    if (!existsSync(abs)) return null;
    return readFileSync(abs, "utf8");
  }
  return gitShow(source.repoRoot, `HEAD:${norm}`);
}

/** Map website URL/thumbnail paths onto repository-relative paths. */
export function resolveWebsiteAssetRepoPath(pathOrUrl: string): string {
  let p = pathOrUrl.replace(/\\/g, "/").trim();
  if (p.startsWith("/")) p = p.slice(1);
  if (p.startsWith("templates/")) p = `public/${p}`;
  return p;
}

export function requiredAssetPathsForCatalogue(
  catalogueId: string,
  opts?: { thumbnailPath?: string | null },
): string[] {
  const id = catalogueId.toLowerCase();
  const paths = new Set<string>([`src/data/template-json/${id}.json`]);
  const thumbRaw = opts?.thumbnailPath?.trim();
  if (thumbRaw) {
    const thumb = resolveWebsiteAssetRepoPath(thumbRaw);
    paths.add(thumb);
    // Modern dual-image publications use PNG thumbnails and also ship WebP.
    // Legacy entries may be WebP-only — do not invent a missing PNG requirement.
    if (thumb.endsWith(".png")) {
      paths.add(`public/templates/${id}.webp`);
    }
  } else {
    paths.add(`public/templates/${id}.png`);
    paths.add(`public/templates/${id}.webp`);
  }
  return [...paths];
}

/** Extract catalogue IDs referenced by shared generated publication files. */
export function extractReferencedCatalogueIds(files: {
  manifest?: string | null;
  snapshots?: string | null;
  registry?: string | null;
  catalog?: string | null;
}): string[] {
  const ids = new Set<string>();
  if (files.manifest) {
    try {
      const doc = JSON.parse(files.manifest) as {
        templates?: Array<{ id?: string }>;
      };
      for (const t of doc.templates ?? []) {
        if (t.id) ids.add(String(t.id).toLowerCase());
      }
    } catch {
      /* ignore parse — caller may still fail elsewhere */
    }
  }
  const blob = [files.snapshots, files.registry, files.catalog]
    .filter(Boolean)
    .join("\n");
  for (const m of blob.matchAll(/\bid:\s*"([tT]\d+)"/g)) {
    ids.add(m[1]!.toLowerCase());
  }
  for (const m of blob.matchAll(/template-json\/([tT]\d+)\.json/g)) {
    ids.add(m[1]!.toLowerCase());
  }
  for (const m of blob.matchAll(/"([tT]\d+)"\s*:/g)) {
    ids.add(m[1]!.toLowerCase());
  }
  return [...ids].sort();
}

type ManifestThumb = { id: string; thumbnailPath?: string; jsonPath?: string };

function parseManifestEntries(manifest: string | null): Map<string, ManifestThumb> {
  const map = new Map<string, ManifestThumb>();
  if (!manifest) return map;
  try {
    const doc = JSON.parse(manifest) as { templates?: ManifestThumb[] };
    for (const t of doc.templates ?? []) {
      if (t.id) map.set(String(t.id).toLowerCase(), t);
    }
  } catch {
    /* ignore */
  }
  return map;
}

/**
 * Fail closed if any referenced catalogue ID lacks required assets in the
 * pending tracked tree (HEAD + paths about to be committed).
 */
export function assertTrackedPublicationClosure(
  source: PendingTrackedTreeSource,
): TrackedClosureResult {
  const manifest = readPendingTrackedFile(source, SHARED_REF_FILES[0]);
  const snapshots = readPendingTrackedFile(source, SHARED_REF_FILES[1]);
  const registry = readPendingTrackedFile(source, SHARED_REF_FILES[2]);
  const catalog = readPendingTrackedFile(source, SHARED_REF_FILES[3]);

  const catalogue_ids = extractReferencedCatalogueIds({
    manifest,
    snapshots,
    registry,
    catalog,
  });
  const entries = parseManifestEntries(manifest);

  const missing: TrackedClosureMissing[] = [];
  for (const id of catalogue_ids) {
    const entry = entries.get(id);
    for (const asset of requiredAssetPathsForCatalogue(id, {
      thumbnailPath: entry?.thumbnailPath ?? null,
    })) {
      if (!pathInPendingTrackedTree(source, asset)) {
        const referenced_by =
          (manifest && manifest.includes(`"${id}"`)
            ? "templates.manifest.json"
            : null) ??
          (registry && registry.includes(`"${id}"`)
            ? "src/data/systemTemplates/registry.generated.ts"
            : null) ??
          (snapshots && snapshots.includes(id)
            ? "src/data/templateSnapshots.generated.ts"
            : null) ??
          (catalog && catalog.includes(`"${id}"`)
            ? "src/data/templateCatalog.generated.ts"
            : "generated publication state");
        missing.push({
          catalogue_id: id,
          missing_tracked_path: asset,
          referenced_by,
        });
      }
    }
  }

  if (missing.length) {
    const first = missing[0]!;
    return {
      ok: false,
      catalogue_ids,
      missing,
      error: `Tracked publication closure failed: catalogue ${first.catalogue_id} referenced by ${first.referenced_by} is missing tracked path ${first.missing_tracked_path} (untracked working-tree files do not satisfy deployment readiness)`,
    };
  }
  return { ok: true, catalogue_ids, missing: [], error: null };
}
