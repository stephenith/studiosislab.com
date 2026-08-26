/**
 * Discovers and classifies publication packages.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { verifyRelease } from "../publication/ReleaseManager.js";
import type { PackageClassification, PackageRecord } from "./types.js";

const REPO_ROOT = resolve(import.meta.dirname, "../../../..");
const SOS_ROOT = join(REPO_ROOT, "SOS");
const LOGS_ROOT = join(SOS_ROOT, "07_LOGS/saios");
const PACKAGES_ROOT = join(LOGS_ROOT, "publication/packages");

const REQUIRED_PACKAGE_FILES = [
  "template.json",
  "thumbnail.png",
  "publication.json",
  "manifest-entry.json",
  "registry-entry.ts",
  "seo.json",
  "landing-page.md",
  "release-notes.md",
  "template-metadata.json",
  "category-metadata.json",
] as const;

function readJson<T>(path: string): T | null {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf8")) as T;
  } catch {
    return null;
  }
}

function inferBatchId(prototypeId: string): string | null {
  if (prototypeId.startsWith("production-batch-001-")) return "production-batch-001";
  if (prototypeId.startsWith("premium-collection-")) return "premium-collection";
  return null;
}

function loadCatalogIntegritySafe(): Set<string> {
  const auditPath = join(LOGS_ROOT, "catalog-integrity/publication-audit.md");
  const safe = new Set<string>();
  const catalog = readJson<{
    templates?: Array<{ catalog_id: string; prototype_id: string }>;
  }>(join(LOGS_ROOT, "publication/catalog.json"));
  for (const t of catalog?.templates ?? []) safe.add(t.catalog_id);

  const conflicts = readJson<{
    conflicts?: Array<{ value: string; type: string }>;
  }>(join(LOGS_ROOT, "catalog-integrity/catalog-conflicts.json"));
  const blocked = new Set(
    (conflicts?.conflicts ?? [])
      .filter((c) => c.type === "duplicate_batch_catalog_assignment")
      .map((c) => c.value),
  );

  if (existsSync(auditPath)) {
    const audit = readFileSync(auditPath, "utf8");
    for (const m of audit.matchAll(/`(t\d{3})` — ([^\s]+) — SAFE/g)) {
      if (!blocked.has(m[1])) safe.add(m[1]);
    }
  }
  return safe;
}

function validatePackage(packageDir: string, catalogId: string): PackageRecord["validation"] {
  const checks: Record<string, boolean> = {
    package_completeness: REQUIRED_PACKAGE_FILES.every((f) => existsSync(join(packageDir, f))),
    template_json: false,
    thumbnail: false,
    seo: false,
    manifest: false,
    registry: false,
    publication_json: false,
  };
  const errors: string[] = [];

  try {
    const template = readJson<{ objects?: unknown[]; version?: string }>(
      join(packageDir, "template.json"),
    );
    checks.template_json =
      Array.isArray(template?.objects) &&
      (template?.objects?.length ?? 0) > 0 &&
      template?.version === "6.9.1";
  } catch {
    checks.template_json = false;
  }

  try {
    const thumb = readFileSync(join(packageDir, "thumbnail.png"));
    checks.thumbnail = thumb.byteLength > 1000;
  } catch {
    checks.thumbnail = false;
  }

  const seo = readJson<{
    meta_title?: string;
    meta_description?: string;
    slug?: string;
    keywords?: string[];
  }>(join(packageDir, "seo.json"));
  checks.seo = Boolean(
    seo?.meta_title &&
      seo.meta_description &&
      seo.slug &&
      (seo.keywords?.length ?? 0) >= 4,
  );

  const manifest = readJson<{
    id?: string;
    status?: string;
    jsonPath?: string;
  }>(join(packageDir, "manifest-entry.json"));
  checks.manifest =
    manifest?.id === catalogId &&
    manifest?.status === "draft" &&
    Boolean(manifest?.jsonPath?.endsWith(`${catalogId}.json`));

  const registry = existsSync(join(packageDir, "registry-entry.ts"))
    ? readFileSync(join(packageDir, "registry-entry.ts"), "utf8")
    : "";
  checks.registry = registry.includes("DRAFT") && registry.includes(catalogId);

  const publication = readJson<{ validation_pass?: boolean }>(join(packageDir, "publication.json"));
  checks.publication_json = publication?.validation_pass === true;

  for (const [key, ok] of Object.entries(checks)) {
    if (!ok) errors.push(`package validation failed: ${key}`);
  }

  return { pass: errors.length === 0, checks, errors };
}

function qaStatus(prototypeId: string): string {
  const qa = readJson<{ pass?: boolean }>(join(LOGS_ROOT, "qa", prototypeId, "validation.json"));
  if (qa?.pass === true) return "PASS";
  if (qa?.pass === false) return "FAIL";
  return "unknown";
}

export function discoverPublicationPackages(): PackageRecord[] {
  const catalog = readJson<{
    templates?: Array<{
      catalog_id: string;
      prototype_id: string;
      publication_state?: string;
      category_id?: string;
      industry?: string;
    }>;
  }>(join(LOGS_ROOT, "publication/catalog.json"));

  const catalogById = new Map((catalog?.templates ?? []).map((t) => [t.catalog_id, t]));
  const integritySafe = loadCatalogIntegritySafe();

  const releaseHistory =
    readJson<Array<{ catalog_id: string; status: string; release_id: string }>>(
      join(LOGS_ROOT, "publication/release-manager/release-history.json"),
    ) ?? [];

  const latestReleaseByCatalog = new Map<string, string>();
  for (const r of releaseHistory) {
    latestReleaseByCatalog.set(r.catalog_id, r.status);
  }

  const folders = existsSync(PACKAGES_ROOT)
    ? readdirSync(PACKAGES_ROOT, { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .map((d) => d.name)
        .sort()
    : [];

  const records: PackageRecord[] = [];

  for (const catalogId of folders) {
    const packageDir = join(PACKAGES_ROOT, catalogId);
    const catalogEntry = catalogById.get(catalogId);
    const prototypeId = catalogEntry?.prototype_id ?? "unknown";
    const publication = readJson<{
      state?: string;
      founder_approved?: boolean;
      founder_final_publish_approval?: boolean;
    }>(join(packageDir, "publication.json"));

    const validation = validatePackage(packageDir, catalogId);
    const liveVerify = verifyRelease({ catalog_id: catalogId, target_root: REPO_ROOT });
    const blockers: string[] = [];

    if (!validation.pass) blockers.push(...validation.errors);
    if (publication?.founder_approved !== true) blockers.push("founder_not_approved");
    if (qaStatus(prototypeId) === "FAIL") blockers.push("qa_failed");
    if (!integritySafe.has(catalogId)) blockers.push("catalog_integrity_unsafe");

    let classification: PackageClassification = "incomplete";
    if (liveVerify.pass) {
      classification = "published";
    } else if (latestReleaseByCatalog.get(catalogId) === "rolled_back") {
      classification = "rolled_back";
    } else if (!validation.checks.package_completeness) {
      classification = "incomplete";
    } else if (blockers.length > 0) {
      classification = "blocked";
    } else if (
      publication?.state === "ready_to_publish" &&
      publication.founder_approved === true &&
      validation.pass
    ) {
      classification = "ready";
    } else {
      classification = "blocked";
    }

    records.push({
      catalog_id: catalogId,
      prototype_id: prototypeId,
      package_dir: packageDir,
      classification,
      publication_state: publication?.state ?? catalogEntry?.publication_state ?? "unknown",
      founder_approved: publication?.founder_approved === true,
      founder_final_publish_approval: publication?.founder_final_publish_approval === true,
      qa_status: qaStatus(prototypeId),
      category_id: catalogEntry?.category_id ?? null,
      industry: catalogEntry?.industry ?? null,
      batch_id: inferBatchId(prototypeId),
      validation,
      catalog_integrity_safe: integritySafe.has(catalogId),
      blockers,
    });
  }

  return records;
}

export { REQUIRED_PACKAGE_FILES, PACKAGES_ROOT };
