/**
 * Agent #246 — ReleaseManager execution engine for AIOS export packages.
 * Never runs without a verified FounderReleaseAuthorization.
 */
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { createHash, randomUUID } from "node:crypto";
import { dirname, join, relative, resolve } from "node:path";
import { verifyFounderReleaseAuthorization } from "../../core/founder-release/ReleaseAuthorization.js";
import type { FounderReleaseAuthorization } from "../../core/founder-release/types.js";
import { PUBLICATION_ROOT } from "./CatalogManager.js";

const REPO_ROOT = resolve(import.meta.dirname, "../../../..");
const RELEASE_ROOT = join(PUBLICATION_ROOT, "release-manager");
const RELEASE_HISTORY_PATH = join(RELEASE_ROOT, "release-history.json");
const CONSUMED_AUTH_PATH = join(RELEASE_ROOT, "consumed-authorizations.json");

export type ExportReleaseOptions = {
  authorization: FounderReleaseAuthorization;
  export_package_dir: string;
  target_root?: string;
  persist?: boolean;
  /** Test-only: fail after named step, before atomic commit completes. */
  force_fail_after?:
    | "verify_integrity"
    | "copy_template"
    | "update_manifest"
    | "regenerate_registries"
    | null;
};

export type ExportReleaseResult = {
  pass: boolean;
  release_id: string;
  catalog_id: string;
  package_dir: string;
  target_root: string;
  slug_used: string;
  reports_dir: string;
  snapshot_dir: string;
  rolled_back: boolean;
  errors: string[];
  steps_completed: string[];
};

type IntegrityDoc = {
  algorithm?: string;
  files?: Record<string, string>;
};

type ManifestEntry = {
  id: string;
  title: string;
  categoryId: string;
  thumbnailPath: string;
  jsonPath: string;
  status: string;
  tags?: string[];
};

type SeoDoc = {
  templateId: string;
  title: string;
  slug: string;
  description: string;
  keywords: string[];
  collision?: boolean;
  suggested_alternate_slug?: string | null;
  h1?: string;
  faq_suggestions?: Array<{ question: string; answer: string }>;
};

function sha256(buf: Buffer | string): string {
  return createHash("sha256").update(buf).digest("hex");
}

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

function loadConsumed(): string[] {
  if (!existsSync(CONSUMED_AUTH_PATH)) return [];
  try {
    const doc = readJson<{ authorization_ids?: string[] }>(CONSUMED_AUTH_PATH);
    return doc.authorization_ids ?? [];
  } catch {
    return [];
  }
}

function markConsumed(authorization_id: string, persist: boolean): void {
  if (!persist) return;
  const ids = new Set(loadConsumed());
  ids.add(authorization_id);
  mkdirSync(dirname(CONSUMED_AUTH_PATH), { recursive: true });
  writeFileSync(
    CONSUMED_AUTH_PATH,
    JSON.stringify({ authorization_ids: [...ids] }, null, 2),
  );
}

function resolveSlug(seo: SeoDoc): { slug: string; errors: string[] } {
  const errors: string[] = [];
  if (seo.collision) {
    const alt = seo.suggested_alternate_slug?.trim();
    if (!alt) {
      errors.push("SEO collision without suggested_alternate_slug");
      return { slug: "", errors };
    }
    return { slug: alt, errors };
  }
  if (!seo.slug?.trim()) {
    errors.push("SEO slug missing");
    return { slug: "", errors };
  }
  return { slug: seo.slug.trim(), errors };
}

function releaseTargets(target_root: string, catalog_id: string): string[] {
  return [
    join(target_root, "src/data/template-json", `${catalog_id}.json`),
    join(target_root, "public/templates", `${catalog_id}.png`),
    join(target_root, "public/templates", `${catalog_id}.webp`),
    join(target_root, "templates.manifest.json"),
    join(target_root, "src/data/systemTemplates/registry.generated.ts"),
    join(target_root, "src/data/templateCatalog.generated.ts"),
    join(target_root, "src/data/templateSnapshots.generated.ts"),
    join(target_root, "src/data/templateSeoContent.ts"),
  ];
}

function snapshotTargets(
  release_id: string,
  target_root: string,
  catalog_id: string,
  persist: boolean,
): { snapshot_dir: string; files: Array<{ path: string; existed: boolean; snapshot_path: string | null }> } {
  const snapshot_dir = join(RELEASE_ROOT, "snapshots", release_id);
  const files = releaseTargets(target_root, catalog_id).map((path, index) => {
    const existed = existsSync(path);
    const snapshot_path = existed ? join(snapshot_dir, `file-${index}`) : null;
    if (persist) {
      mkdirSync(snapshot_dir, { recursive: true });
      if (existed && snapshot_path) copyFileSync(path, snapshot_path);
    }
    return { path, existed, snapshot_path };
  });
  if (persist) {
    writeFileSync(
      join(snapshot_dir, "snapshot.json"),
      JSON.stringify({ release_id, snapshot_dir, files }, null, 2),
    );
  }
  return { snapshot_dir, files };
}

function restoreSnapshot(
  files: Array<{ path: string; existed: boolean; snapshot_path: string | null }>,
): void {
  for (const file of files) {
    if (file.snapshot_path && existsSync(file.snapshot_path)) {
      mkdirSync(dirname(file.path), { recursive: true });
      copyFileSync(file.snapshot_path, file.path);
    } else if (!file.existed && existsSync(file.path)) {
      rmSync(file.path, { force: true });
    }
  }
}

function verifyIntegrity(pkgDir: string): string[] {
  const errors: string[] = [];
  const integrityPath = join(pkgDir, "integrity.json");
  if (!existsSync(integrityPath)) {
    return ["integrity.json missing"];
  }
  const integrity = readJson<IntegrityDoc>(integrityPath);
  if (integrity.algorithm !== "sha256") {
    errors.push("integrity algorithm must be sha256");
  }
  const files = integrity.files ?? {};
  for (const [rel, expected] of Object.entries(files)) {
    const abs = join(pkgDir, rel);
    if (!existsSync(abs)) {
      errors.push(`integrity missing file: ${rel}`);
      continue;
    }
    const actual = sha256(readFileSync(abs));
    if (actual !== expected) {
      errors.push(`integrity mismatch: ${rel}`);
    }
  }
  return errors;
}

function verifyCompatibility(pkgDir: string): string[] {
  const path = join(pkgDir, "compatibility.json");
  if (!existsSync(path)) return ["compatibility.json missing"];
  const c = readJson<{
    fabric_version?: string;
    export_schema?: string;
    asset_pipeline_version?: string;
    compatible?: boolean;
  }>(path);
  const errors: string[] = [];
  if (c.compatible === false) errors.push("compatibility.compatible is false");
  if (!String(c.fabric_version ?? "").startsWith("6")) {
    errors.push("fabric_version incompatible");
  }
  if (!c.export_schema) errors.push("export_schema missing");
  if (!c.asset_pipeline_version) errors.push("asset_pipeline_version missing");
  return errors;
}

function regenerateRegistries(
  target_root: string,
  manifest: { templates: ManifestEntry[] },
  persist: boolean,
): void {
  const templates = manifest.templates;
  const registryRows = templates
    .map((template) => {
      const importPath = relative(
        join(target_root, "src/data/systemTemplates"),
        join(target_root, template.jsonPath),
      )
        .split("\\")
        .join("/");
      const resolvedImport = importPath.startsWith(".")
        ? importPath
        : `./${importPath}`;
      return `  {
    id: ${JSON.stringify(template.id)},
    name: ${JSON.stringify(template.title)},
    tags: ${JSON.stringify(template.tags ?? [])},
    thumbnail: ${JSON.stringify(template.thumbnailPath)},
    load: async () => (await import(${JSON.stringify(resolvedImport)})).default,
  },`;
    })
    .join("\n");

  const registryContent = `/* AUTO-GENERATED FILE. DO NOT EDIT MANUALLY. */
/* Generated from templates.manifest.json by release manager */

export type SystemTemplate = {
  id: string;
  name: string;
  tags: string[];
  thumbnail: string;
  load: () => Promise<unknown>;
};

export const SYSTEM_TEMPLATES: SystemTemplate[] = [
${registryRows}
];

export const SYSTEM_TEMPLATE_IDS = SYSTEM_TEMPLATES.map((template) => template.id);

export const getSystemTemplateById = (id: string) => {
  const normalized = (id || "").toLowerCase().trim();
  return SYSTEM_TEMPLATES.find((template) => template.id === normalized);
};
`;

  const catalogRows = templates
    .map(
      (template) => `  {
    id: ${JSON.stringify(template.id)},
    title: ${JSON.stringify(template.title)},
    categoryId: ${JSON.stringify(template.categoryId)},
    category: ${JSON.stringify(template.categoryId)},
    tags: ${JSON.stringify(template.tags ?? [])},
    thumb: ${JSON.stringify(template.thumbnailPath)},
    status: ${JSON.stringify(template.status)},
  },`,
    )
    .join("\n");

  const catalogContent = `/* AUTO-GENERATED FILE. DO NOT EDIT MANUALLY. */
/* Generated from templates.manifest.json by release manager */

export type Template = {
  id: string;
  title: string;
  categoryId: string;
  category: string;
  tags: string[];
  thumb: string;
  status: "draft" | "published";
};

export const TEMPLATES: Template[] = [
${catalogRows}
];
`;

  const snapshotImports = templates
    .map((template, i) => {
      const importPath = relative(
        join(target_root, "src/data"),
        join(target_root, template.jsonPath),
      )
        .split("\\")
        .join("/");
      const resolvedImport = importPath.startsWith(".")
        ? importPath
        : `./${importPath}`;
      return `import tpl${i} from ${JSON.stringify(resolvedImport)};`;
    })
    .join("\n");
  const snapshotRows = templates
    .map((template, i) => `  ${JSON.stringify(template.id)}: tpl${i},`)
    .join("\n");
  const snapshotsContent = `/* AUTO-GENERATED FILE. DO NOT EDIT MANUALLY. */
/* Generated from templates.manifest.json by release manager */
${snapshotImports}

export const TEMPLATE_SNAPSHOTS: Record<string, unknown> = {
${snapshotRows}
};
`;

  if (persist) {
    mkdirSync(join(target_root, "src/data/systemTemplates"), {
      recursive: true,
    });
    writeFileSync(
      join(target_root, "src/data/systemTemplates/registry.generated.ts"),
      registryContent,
    );
    writeFileSync(
      join(target_root, "src/data/templateCatalog.generated.ts"),
      catalogContent,
    );
    writeFileSync(
      join(target_root, "src/data/templateSnapshots.generated.ts"),
      snapshotsContent,
    );
  }
}

function writeSeoEntry(input: {
  target_root: string;
  catalog_id: string;
  manifest: ManifestEntry;
  seo: SeoDoc;
  slug: string;
  persist: boolean;
}): void {
  const seoPath = join(input.target_root, "src/data/templateSeoContent.ts");
  const raw = readFileSync(seoPath, "utf8");
  if (raw.includes(`templateId: "${input.catalog_id}"`)) return;
  if (raw.includes(`slug: ${JSON.stringify(input.slug)}`)) {
    throw new Error(`SEO slug already present in site: ${input.slug}`);
  }
  const faq = input.seo.faq_suggestions ?? [
    {
      question: `Is the ${input.manifest.title} ATS-friendly?`,
      answer:
        "Yes. This StudiosisLab template uses a clear single-page structure suited for ATS parsing.",
    },
  ];
  const entry = `  {
    templateId: ${JSON.stringify(input.catalog_id)},
    slug: ${JSON.stringify(input.slug)},
    seoTitle: ${JSON.stringify(input.seo.title)},
    seoDescription: ${JSON.stringify(input.seo.description)},
    h1: ${JSON.stringify(input.seo.h1 ?? input.manifest.title)},
    intro: ${JSON.stringify(input.seo.description)},
    bestFor: ["ATS job applications", "StudiosisLab editor workflows", "Professional one-page resumes"],
    whatToInclude: ["Professional summary", "Experience", "Skills", "Education"],
    atsTips: ["Use standard headings", "Keep text machine-readable", "Preserve ATS-safe single-column structure"],
    writingTips: ["Lead with outcomes", "Keep bullets concise", "Match the role with relevant terminology"],
    faq: ${JSON.stringify(faq, null, 2).replace(/\n/g, "\n    ")},
    relatedTemplateIds: [],
    isPublished: true,
  },`;
  const marker = "export const TEMPLATE_SEO_CONTENT: TemplateSeoEntry[] = [";
  const start = raw.indexOf(marker);
  const end = raw.lastIndexOf("];");
  if (start === -1 || end === -1) {
    throw new Error("Unable to update templateSeoContent.ts");
  }
  const next = `${raw.slice(0, end)}${entry}\n${raw.slice(end)}`;
  if (input.persist) writeFileSync(seoPath, next);
}

function verifyLiveOutput(
  target_root: string,
  catalog_id: string,
  slug: string,
): string[] {
  const errors: string[] = [];
  const checks: Array<[string, boolean]> = [
    [
      "template_json",
      existsSync(join(target_root, "src/data/template-json", `${catalog_id}.json`)),
    ],
    [
      "png",
      existsSync(join(target_root, "public/templates", `${catalog_id}.png`)),
    ],
    [
      "webp",
      existsSync(join(target_root, "public/templates", `${catalog_id}.webp`)),
    ],
  ];
  const manifest = readJson<{ templates?: ManifestEntry[] }>(
    join(target_root, "templates.manifest.json"),
  );
  const entry = manifest.templates?.find((t) => t.id === catalog_id);
  checks.push([
    "manifest_published",
    Boolean(entry && entry.status === "published"),
  ]);
  const registry = readFileSync(
    join(target_root, "src/data/systemTemplates/registry.generated.ts"),
    "utf8",
  );
  checks.push(["registry", registry.includes(`id: "${catalog_id}"`)]);
  const catalog = readFileSync(
    join(target_root, "src/data/templateCatalog.generated.ts"),
    "utf8",
  );
  checks.push(["catalog", catalog.includes(`id: "${catalog_id}"`)]);
  const seo = readFileSync(
    join(target_root, "src/data/templateSeoContent.ts"),
    "utf8",
  );
  checks.push([
    "seo",
    seo.includes(`templateId: "${catalog_id}"`) &&
      seo.includes(`slug: ${JSON.stringify(slug)}`),
  ]);
  for (const [name, ok] of checks) {
    if (!ok) errors.push(`post-commit verify failed: ${name}`);
  }
  return errors;
}

function appendHistory(entry: Record<string, unknown>, persist: boolean): void {
  if (!persist) return;
  let history: unknown[] = [];
  if (existsSync(RELEASE_HISTORY_PATH)) {
    try {
      history = JSON.parse(readFileSync(RELEASE_HISTORY_PATH, "utf8")) as unknown[];
    } catch {
      history = [];
    }
  }
  history.push(entry);
  mkdirSync(dirname(RELEASE_HISTORY_PATH), { recursive: true });
  writeFileSync(RELEASE_HISTORY_PATH, JSON.stringify(history, null, 2));
}

export type MaterializeExportWebsiteInput = {
  export_package_dir: string;
  catalogue_id: string;
  target_root?: string;
  persist?: boolean;
  /** When false, skip snapshot/rollback (caller manages batch rollback). */
  take_snapshot?: boolean;
  force_fail_after?: ExportReleaseOptions["force_fail_after"];
};

export type MaterializeExportWebsiteResult = {
  pass: boolean;
  catalog_id: string;
  slug_used: string;
  package_dir: string;
  target_root: string;
  release_id: string;
  snapshot_dir: string;
  rolled_back: boolean;
  errors: string[];
  steps_completed: string[];
  written_rel_paths: string[];
  /** Absolute paths snapshotted for caller batch restore. */
  snap_files: Array<{
    path: string;
    existed: boolean;
    snapshot_path: string | null;
  }>;
};

/** Relative website paths produced for one catalogue ID (same as ReleaseManager). */
export function exportReleaseWebsiteRelPaths(catalog_id: string): string[] {
  return [
    `src/data/template-json/${catalog_id}.json`,
    `public/templates/${catalog_id}.png`,
    `public/templates/${catalog_id}.webp`,
    "templates.manifest.json",
    "src/data/systemTemplates/registry.generated.ts",
    "src/data/templateCatalog.generated.ts",
    "src/data/templateSnapshots.generated.ts",
    "src/data/templateSeoContent.ts",
  ];
}

export function resolveExportPackageSeoSlug(pkgDir: string): {
  slug: string;
  errors: string[];
} {
  if (!existsSync(join(pkgDir, "seo.json"))) {
    return { slug: "", errors: ["seo.json missing"] };
  }
  const seo = readJson<SeoDoc>(join(pkgDir, "seo.json"));
  return resolveSlug(seo);
}

export function restoreExportWebsiteSnapshot(
  files: Array<{ path: string; existed: boolean; snapshot_path: string | null }>,
): void {
  restoreSnapshot(files);
}

/**
 * Materialize one export package onto the website using the same write path as
 * authorized release (manifest-entry, assets, SEO, registry regeneration).
 * Does not consume FounderReleaseAuthorization — caller must gate separately.
 */
export function materializeExportPackageWebsite(
  options: MaterializeExportWebsiteInput,
): MaterializeExportWebsiteResult {
  const persist = options.persist !== false;
  const take_snapshot = options.take_snapshot !== false;
  const target_root = options.target_root ?? REPO_ROOT;
  const pkgDir = options.export_package_dir;
  const catalog_id = options.catalogue_id;
  const release_id = `release-${catalog_id}-${randomUUID().slice(0, 8)}`;
  const steps_completed: string[] = [];
  const errors: string[] = [];
  let rolled_back = false;
  let snap_files: MaterializeExportWebsiteResult["snap_files"] = [];
  let snapshot_dir = "";

  const manifestEntry = readJson<ManifestEntry>(join(pkgDir, "manifest-entry.json"));
  const seo = readJson<SeoDoc>(join(pkgDir, "seo.json"));
  const { slug, errors: slugErrors } = resolveSlug(seo);
  errors.push(...slugErrors);

  if (manifestEntry.id !== catalog_id) {
    errors.push("manifest id does not match reservation catalogue_id");
  }
  if (manifestEntry.status !== "draft") {
    errors.push("manifest status must be draft before release");
  }

  const liveManifestPath = join(target_root, "templates.manifest.json");
  const liveManifest = readJson<{ templates: ManifestEntry[] }>(liveManifestPath);
  if (liveManifest.templates.some((t) => t.id === catalog_id && t.status === "published")) {
    errors.push(`manifest collision — ${catalog_id} already published`);
  }

  errors.push(...verifyIntegrity(pkgDir));
  steps_completed.push("verify_integrity");
  if (options.force_fail_after === "verify_integrity") {
    errors.push("forced failure after verify_integrity");
  }
  errors.push(...verifyCompatibility(pkgDir));
  steps_completed.push("verify_compatibility");

  if (!existsSync(join(pkgDir, "template.json"))) {
    errors.push("template.json missing");
  }
  for (const rel of [
    "assets/thumbnail.png",
    "assets/thumbnail.webp",
    "assets/preview.png",
    "assets/preview.webp",
  ]) {
    if (!existsSync(join(pkgDir, rel))) errors.push(`${rel} missing`);
  }

  if (errors.length > 0) {
    return {
      pass: false,
      catalog_id,
      slug_used: slug,
      package_dir: pkgDir,
      target_root,
      release_id,
      snapshot_dir: "",
      rolled_back: false,
      errors,
      steps_completed,
      written_rel_paths: [],
      snap_files: [],
    };
  }

  if (take_snapshot) {
    const snap = snapshotTargets(release_id, target_root, catalog_id, persist);
    snapshot_dir = snap.snapshot_dir;
    snap_files = snap.files;
  }

  try {
    const templateDest = join(
      target_root,
      "src/data/template-json",
      `${catalog_id}.json`,
    );
    const pngDest = join(target_root, "public/templates", `${catalog_id}.png`);
    const webpDest = join(target_root, "public/templates", `${catalog_id}.webp`);

    if (persist) {
      mkdirSync(dirname(templateDest), { recursive: true });
      mkdirSync(dirname(pngDest), { recursive: true });
      copyFileSync(join(pkgDir, "template.json"), templateDest);
    }
    steps_completed.push("copy_template");
    if (options.force_fail_after === "copy_template") {
      throw new Error("forced failure after copy_template");
    }

    if (persist) {
      copyFileSync(join(pkgDir, "assets/thumbnail.png"), pngDest);
      copyFileSync(join(pkgDir, "assets/thumbnail.webp"), webpDest);
    }
    steps_completed.push("copy_png");
    steps_completed.push("copy_webp");

    const publishedEntry: ManifestEntry = {
      ...manifestEntry,
      thumbnailPath: `/templates/${catalog_id}.png`,
      jsonPath: `src/data/template-json/${catalog_id}.json`,
      status: "published",
    };
    const nextManifest = {
      templates: [...liveManifest.templates],
    };
    const idx = nextManifest.templates.findIndex((t) => t.id === catalog_id);
    if (idx >= 0) nextManifest.templates[idx] = publishedEntry;
    else nextManifest.templates.push(publishedEntry);
    if (persist) {
      writeFileSync(liveManifestPath, `${JSON.stringify(nextManifest, null, 2)}\n`);
    }
    steps_completed.push("update_manifest");
    if (options.force_fail_after === "update_manifest") {
      throw new Error("forced failure after update_manifest");
    }

    writeSeoEntry({
      target_root,
      catalog_id,
      manifest: publishedEntry,
      seo,
      slug,
      persist,
    });
    steps_completed.push("update_seo");

    regenerateRegistries(target_root, nextManifest, persist);
    steps_completed.push("regenerate_registries");
    if (options.force_fail_after === "regenerate_registries") {
      throw new Error("forced failure after regenerate_registries");
    }

    const verifyErrors = persist
      ? verifyLiveOutput(target_root, catalog_id, slug)
      : [];
    if (verifyErrors.length > 0) {
      throw new Error(verifyErrors.join("; "));
    }
    steps_completed.push("verify_generated_output");

    return {
      pass: true,
      catalog_id,
      slug_used: slug,
      package_dir: pkgDir,
      target_root,
      release_id,
      snapshot_dir,
      rolled_back: false,
      errors: [],
      steps_completed,
      written_rel_paths: exportReleaseWebsiteRelPaths(catalog_id),
      snap_files,
    };
  } catch (e) {
    if (persist && take_snapshot) {
      restoreSnapshot(snap_files);
      rolled_back = true;
    }
    return {
      pass: false,
      catalog_id,
      slug_used: slug,
      package_dir: pkgDir,
      target_root,
      release_id,
      snapshot_dir,
      rolled_back,
      errors: [e instanceof Error ? e.message : String(e)],
      steps_completed,
      written_rel_paths: [],
      snap_files,
    };
  }
}

/**
 * Execute an authorized export-package release.
 * Authorization is mandatory — boolean flags alone are insufficient.
 */
export function runAuthorizedExportRelease(
  options: ExportReleaseOptions,
): ExportReleaseResult {
  const persist = options.persist !== false;
  const target_root = options.target_root ?? REPO_ROOT;
  const pkgDir = options.export_package_dir;
  const steps_completed: string[] = [];
  const errors: string[] = [];
  let rolled_back = false;

  const authCheck = verifyFounderReleaseAuthorization(options.authorization, {
    export_package_id: options.authorization.export_package_id,
    catalogue_id: options.authorization.catalogue_id,
    reservation_id: options.authorization.reservation_id,
  });
  if (!authCheck.ok) {
    throw new Error(
      `ReleaseManager refused execution — authorization invalid: ${authCheck.errors.join("; ")}`,
    );
  }
  if (loadConsumed().includes(options.authorization.authorization_id)) {
    throw new Error("Release authorization already consumed — duplicate release blocked");
  }

  const catalog_id = options.authorization.catalogue_id;
  const reports_dir = join(
    RELEASE_ROOT,
    "releases",
    `release-${catalog_id}-${randomUUID().slice(0, 8)}`,
  );
  const workspace = join(
    REPO_ROOT,
    "SOS/07_LOGS/saios/export/release-workspace",
    `auth-${catalog_id}-${randomUUID().slice(0, 8)}`,
  );

  if (persist) {
    mkdirSync(workspace, { recursive: true });
    mkdirSync(reports_dir, { recursive: true });
  }

  const materialized = materializeExportPackageWebsite({
    export_package_dir: pkgDir,
    catalogue_id: catalog_id,
    target_root,
    persist,
    take_snapshot: true,
    force_fail_after: options.force_fail_after ?? null,
  });
  steps_completed.push(...materialized.steps_completed);
  errors.push(...materialized.errors);
  rolled_back = materialized.rolled_back;

  if (!materialized.pass) {
    if (persist) {
      mkdirSync(reports_dir, { recursive: true });
      writeFileSync(
        join(reports_dir, "export-release-rollback.json"),
        JSON.stringify(
          {
            release_id: materialized.release_id,
            rolled_back_at: new Date().toISOString(),
            error: errors.join("; "),
            steps_completed,
          },
          null,
          2,
        ),
      );
      rmSync(workspace, { recursive: true, force: true });
    }
    return {
      pass: false,
      release_id: materialized.release_id,
      catalog_id,
      package_dir: pkgDir,
      target_root,
      slug_used: materialized.slug_used,
      reports_dir,
      snapshot_dir: materialized.snapshot_dir,
      rolled_back,
      errors,
      steps_completed,
    };
  }

  markConsumed(options.authorization.authorization_id, persist);
  steps_completed.push("commit_authorization");

  appendHistory(
    {
      release_id: materialized.release_id,
      catalog_id,
      template_id: catalog_id,
      release_version: "1.0.0",
      release_date: new Date().toISOString(),
      founder_name: options.authorization.founder_name,
      founder_approval_timestamp: options.authorization.approved_at,
      checksum: sha256(readFileSync(join(pkgDir, "template.json"))),
      package_dir: pkgDir,
      target_root,
      reports_dir,
      snapshot_dir: materialized.snapshot_dir,
      status: "released",
      authorization_id: options.authorization.authorization_id,
      export_package_id: options.authorization.export_package_id,
      slug_used: materialized.slug_used,
    },
    persist,
  );
  steps_completed.push("release_history");

  if (persist) {
    writeFileSync(
      join(reports_dir, "export-release-summary.json"),
      JSON.stringify(
        {
          release_id: materialized.release_id,
          catalog_id,
          slug_used: materialized.slug_used,
          steps_completed,
          authorization_id: options.authorization.authorization_id,
          pass: true,
        },
        null,
        2,
      ),
    );
    rmSync(workspace, { recursive: true, force: true });
  }

  return {
    pass: true,
    release_id: materialized.release_id,
    catalog_id,
    package_dir: pkgDir,
    target_root,
    slug_used: materialized.slug_used,
    reports_dir,
    snapshot_dir: materialized.snapshot_dir,
    rolled_back: false,
    errors: [],
    steps_completed,
  };
}
