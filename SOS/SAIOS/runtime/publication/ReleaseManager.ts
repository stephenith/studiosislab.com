/**
 * Release Manager — controlled founder-approved publication release.
 * Converts a validated publication package into live website assets.
 * Never releases automatically; founder final publish approval is mandatory.
 *
 * Agent #246: export-package releases require FounderReleaseAuthorization.
 * Boolean founder_final_publish_approval alone cannot authorize export releases.
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
import { loadCatalog, PUBLICATION_ROOT } from "./CatalogManager.js";
import {
  runAuthorizedExportRelease,
  type ExportReleaseOptions,
  type ExportReleaseResult,
} from "./ExportPackageReleaseEngine.js";

export {
  runAuthorizedExportRelease,
  type ExportReleaseOptions,
  type ExportReleaseResult,
};

const REPO_ROOT = resolve(import.meta.dirname, "../../../..");
const RELEASE_ROOT = join(PUBLICATION_ROOT, "release-manager");
const RELEASE_HISTORY_PATH = join(RELEASE_ROOT, "release-history.json");

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

export const RELEASE_MANAGER = {
  module: "publication-release-manager",
  version: "1.0.0",
  role: "manual_release_only",
  prohibitions: [
    "no_auto_publish",
    "no_resume_generation",
    "no_design_intelligence_mutation",
    "no_founder_approval_bypass",
  ],
} as const;

export type ReleaseManagerOptions = {
  catalog_id?: string;
  package_dir?: string;
  founder_final_publish_approval?: boolean;
  founder_approval_timestamp?: string;
  founder_name?: string;
  target_root?: string;
  persist?: boolean;
};

export type ReleaseValidation = {
  pass: boolean;
  checks: Record<string, boolean>;
  errors: string[];
};

export type ReleaseSummary = {
  release_id: string;
  release_version: string;
  release_date: string;
  template_id: string;
  catalog_id: string;
  founder_name: string;
  founder_approval_timestamp: string;
  checksum: string;
  target_root: string;
  package_dir: string;
  status: "released";
  cache_refresh: "generated_template_files_updated";
};

export type ReleaseSnapshot = {
  release_id: string;
  snapshot_dir: string;
  files: Array<{ path: string; existed: boolean; snapshot_path: string | null }>;
};

export type ReleaseHistoryEntry = {
  release_id: string;
  catalog_id: string;
  template_id: string;
  release_version: string;
  release_date: string;
  founder_name: string;
  founder_approval_timestamp: string;
  checksum: string;
  package_dir: string;
  target_root: string;
  reports_dir: string;
  snapshot_dir: string;
  status: "released" | "rolled_back";
};

export type ReleaseManagerResult = {
  pass: boolean;
  release_id: string;
  catalog_id: string;
  package_dir: string;
  target_root: string;
  validation: ReleaseValidation;
  summary: ReleaseSummary;
  reports_dir: string;
  reports: string[];
};

type PackageDraft = {
  publication: {
    prototype_id: string;
    founder_approved: boolean;
    founder_final_publish_approval: boolean;
    state: string;
  };
  manifest: {
    id: string;
    title: string;
    categoryId: string;
    thumbnailPath: string;
    jsonPath: string;
    status: string;
    tags?: string[];
  };
  seo: {
    meta_title: string;
    meta_description: string;
    slug: string;
    keywords: string[];
    faq_suggestions: Array<{ question: string; answer: string }>;
  };
  metadata: {
    template_id: string;
    catalog_id: string;
    prototype_id: string;
    title: string;
    version: string;
  };
};

export function runReleaseManager(
  options: ReleaseManagerOptions = {},
): ReleaseManagerResult {
  const persist = options.persist !== false;
  const founder_final_publish_approval = options.founder_final_publish_approval === true;
  if (!founder_final_publish_approval) {
    throw new Error("Founder final publish approval is mandatory for release");
  }

  const package_dir = resolvePackageDir(options);
  // Agent #246 — AIOS export packages cannot use the legacy boolean gate.
  if (
    existsSync(join(package_dir, "origin.json")) &&
    existsSync(join(package_dir, "asset-report.json"))
  ) {
    throw new Error(
      "AIOS export packages require FounderReleaseAuthorization via FounderReleaseController / runAuthorizedExportRelease — boolean approval cannot bypass the controller",
    );
  }
  const target_root = options.target_root ?? REPO_ROOT;
  const draft = loadPackageDraft(package_dir);
  const release_id = `release-${draft.metadata.catalog_id}-${randomUUID().slice(0, 8)}`;
  const founder_approval_timestamp = options.founder_approval_timestamp ?? new Date().toISOString();

  const validation = validateReleasePackage({
    package_dir,
    target_root,
    catalog_id: draft.metadata.catalog_id,
    founder_final_publish_approval,
    draft,
  });
  if (!validation.pass) {
    throw new Error(`Release validation failed: ${validation.errors.join("; ")}`);
  }

  const reports_dir = join(RELEASE_ROOT, "releases", release_id);
  const snapshot = createReleaseSnapshot({
    release_id,
    target_root,
    catalog_id: draft.metadata.catalog_id,
    persist,
  });

  const checksum = sha256(readFileSync(join(package_dir, "template.json")));
  const release_version = draft.metadata.version;

  applyRelease({
    target_root,
    package_dir,
    catalog_id: draft.metadata.catalog_id,
    manifest: draft.manifest,
    seo: draft.seo,
    persist,
  });

  const summary: ReleaseSummary = {
    release_id,
    release_version,
    release_date: new Date().toISOString(),
    template_id: draft.metadata.template_id,
    catalog_id: draft.metadata.catalog_id,
    founder_name: options.founder_name ?? "Stephen",
    founder_approval_timestamp,
    checksum,
    target_root,
    package_dir,
    status: "released",
    cache_refresh: "generated_template_files_updated",
  };

  const releaseValidationPath = join(reports_dir, "release-validation.json");
  const releaseSummaryPath = join(reports_dir, "release-summary.json");
  const rollbackPath = join(reports_dir, "rollback.json");
  const reportPath = join(reports_dir, "release-report.md");
  const historyPath = RELEASE_HISTORY_PATH;

  if (persist) {
    mkdirSync(reports_dir, { recursive: true });
    writeFileSync(releaseValidationPath, JSON.stringify(validation, null, 2));
    writeFileSync(releaseSummaryPath, JSON.stringify(summary, null, 2));
    writeFileSync(
      rollbackPath,
      JSON.stringify(
        {
          release_id,
          rollback_available: true,
          snapshot_dir: snapshot.snapshot_dir,
          restore_command: "rollbackRelease(release_id)",
        },
        null,
        2,
      ),
    );
    writeFileSync(reportPath, renderReleaseReport({ summary, validation, snapshot }));
  }

  appendReleaseHistory(
    {
      release_id,
      catalog_id: draft.metadata.catalog_id,
      template_id: draft.metadata.template_id,
      release_version,
      release_date: summary.release_date,
      founder_name: summary.founder_name,
      founder_approval_timestamp,
      checksum,
      package_dir,
      target_root,
      reports_dir,
      snapshot_dir: snapshot.snapshot_dir,
      status: "released",
    },
    persist,
  );

  const reports = [
    releaseValidationPath,
    releaseSummaryPath,
    rollbackPath,
    historyPath,
    reportPath,
  ];

  return {
    pass: true,
    release_id,
    catalog_id: draft.metadata.catalog_id,
    package_dir,
    target_root,
    validation,
    summary,
    reports_dir,
    reports,
  };
}

export function verifyRelease(input: {
  catalog_id: string;
  target_root?: string;
}): { pass: boolean; checks: Record<string, boolean>; errors: string[] } {
  const target_root = input.target_root ?? REPO_ROOT;
  const checks = {
    template_json: existsSync(join(target_root, "src/data/template-json", `${input.catalog_id}.json`)),
    thumbnail: existsSync(join(target_root, "public/templates", `${input.catalog_id}.png`)),
    manifest: false,
    registry: false,
    template_catalog: false,
    template_snapshots: false,
    seo: false,
  };
  const errors: string[] = [];

  const manifestPath = join(target_root, "templates.manifest.json");
  if (existsSync(manifestPath)) {
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as {
      templates?: Array<{ id: string; status: string }>;
    };
    checks.manifest = Boolean(
      manifest.templates?.some((t) => t.id === input.catalog_id && t.status === "published"),
    );
  }

  const registryPath = join(target_root, "src/data/systemTemplates/registry.generated.ts");
  if (existsSync(registryPath)) {
    checks.registry = readFileSync(registryPath, "utf8").includes(`id: "${input.catalog_id}"`);
  }
  const catalogPath = join(target_root, "src/data/templateCatalog.generated.ts");
  if (existsSync(catalogPath)) {
    checks.template_catalog = readFileSync(catalogPath, "utf8").includes(`id: "${input.catalog_id}"`);
  }
  const snapshotsPath = join(target_root, "src/data/templateSnapshots.generated.ts");
  if (existsSync(snapshotsPath)) {
    checks.template_snapshots = readFileSync(snapshotsPath, "utf8").includes(`${input.catalog_id}.json`);
  }
  const seoPath = join(target_root, "src/data/templateSeoContent.ts");
  if (existsSync(seoPath)) {
    checks.seo = readFileSync(seoPath, "utf8").includes(`templateId: "${input.catalog_id}"`);
  }

  for (const [key, ok] of Object.entries(checks)) {
    if (!ok) errors.push(`verifyRelease failed: ${key}`);
  }
  return { pass: errors.length === 0, checks, errors };
}

export function rollbackRelease(input: {
  release_id: string;
}): { pass: boolean; restored_files: string[]; rollback_path: string } {
  const history = loadReleaseHistory();
  const entry = history.find((r) => r.release_id === input.release_id);
  if (!entry) {
    throw new Error(`Release history not found: ${input.release_id}`);
  }
  const snapshotPath = join(entry.snapshot_dir, "snapshot.json");
  if (!existsSync(snapshotPath)) {
    throw new Error(`Snapshot missing for release: ${input.release_id}`);
  }
  const snapshot = JSON.parse(readFileSync(snapshotPath, "utf8")) as ReleaseSnapshot;

  const restored: string[] = [];
  for (const file of snapshot.files) {
    if (file.snapshot_path) {
      mkdirSync(dirname(file.path), { recursive: true });
      copyFileSync(file.snapshot_path, file.path);
      restored.push(file.path);
    } else if (!file.existed && existsSync(file.path)) {
      rmSync(file.path);
      restored.push(file.path);
    }
  }

  entry.status = "rolled_back";
  writeReleaseHistory(history);

  const rollback_path = join(entry.reports_dir, "rollback.json");
  writeFileSync(
    rollback_path,
    JSON.stringify(
      {
        release_id: entry.release_id,
        rolled_back_at: new Date().toISOString(),
        restored_files: restored,
      },
      null,
      2,
    ),
  );

  return { pass: true, restored_files: restored, rollback_path };
}

export function restorePreviousRelease(input: {
  catalog_id: string;
}): { pass: boolean; restored_release_id: string | null } {
  const history = loadReleaseHistory()
    .filter((r) => r.catalog_id === input.catalog_id && r.status === "released")
    .sort((a, b) => b.release_date.localeCompare(a.release_date));
  const latest = history[0];
  if (!latest) return { pass: false, restored_release_id: null };
  rollbackRelease({ release_id: latest.release_id });
  return { pass: true, restored_release_id: latest.release_id };
}

function resolvePackageDir(options: ReleaseManagerOptions): string {
  if (options.package_dir) return options.package_dir;
  if (options.catalog_id) return join(PUBLICATION_ROOT, "packages", options.catalog_id);
  const catalog = loadCatalog();
  const latest = [...catalog.templates].sort((a, b) => b.added_at.localeCompare(a.added_at))[0];
  if (!latest) throw new Error("No publication package available for release");
  return join(PUBLICATION_ROOT, "packages", latest.catalog_id);
}

function loadPackageDraft(package_dir: string): PackageDraft {
  const read = <T>(name: string) =>
    JSON.parse(readFileSync(join(package_dir, name), "utf8")) as T;
  return {
    publication: read("publication.json"),
    manifest: read("manifest-entry.json"),
    seo: read("seo.json"),
    metadata: read("template-metadata.json"),
  };
}

function validateReleasePackage(input: {
  package_dir: string;
  target_root: string;
  catalog_id: string;
  founder_final_publish_approval: boolean;
  draft: PackageDraft;
}): ReleaseValidation {
  const checks: Record<string, boolean> = {
    founder_final_publish_approval: input.founder_final_publish_approval,
    package_completeness: REQUIRED_PACKAGE_FILES.every((f) => existsSync(join(input.package_dir, f))),
    template_integrity: false,
    thumbnail_integrity: false,
    seo_metadata: false,
    manifest_draft: false,
    registry_draft: false,
    catalog_uniqueness: false,
  };
  const errors: string[] = [];

  try {
    const template = JSON.parse(readFileSync(join(input.package_dir, "template.json"), "utf8")) as {
      objects?: unknown[];
      version?: string;
    };
    checks.template_integrity =
      Array.isArray(template.objects) && template.objects.length > 0 && template.version === "6.9.1";
  } catch {
    checks.template_integrity = false;
  }

  try {
    const thumb = readFileSync(join(input.package_dir, "thumbnail.png"));
    checks.thumbnail_integrity = thumb.byteLength > 1000;
  } catch {
    checks.thumbnail_integrity = false;
  }

  checks.seo_metadata =
    input.draft.seo.meta_title.length > 0 &&
    input.draft.seo.meta_description.length > 0 &&
    input.draft.seo.slug.length > 0 &&
    input.draft.seo.keywords.length >= 4;

  checks.manifest_draft =
    input.draft.manifest.id === input.catalog_id &&
    input.draft.manifest.status === "draft" &&
    input.draft.manifest.jsonPath.endsWith(`${input.catalog_id}.json`);

  const registryDraft = readFileSync(join(input.package_dir, "registry-entry.ts"), "utf8");
  checks.registry_draft =
    registryDraft.includes("DRAFT") && registryDraft.includes(input.catalog_id);

  const manifestPath = join(input.target_root, "templates.manifest.json");
  let alreadyPublished = false;
  if (existsSync(manifestPath)) {
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as {
      templates?: Array<{ id: string; status: string }>;
    };
    alreadyPublished = Boolean(
      manifest.templates?.some((t) => t.id === input.catalog_id && t.status === "published"),
    );
  }
  checks.catalog_uniqueness = !alreadyPublished;

  for (const [key, ok] of Object.entries(checks)) {
    if (!ok) errors.push(`Release validation failed: ${key}`);
  }

  return { pass: errors.length === 0, checks, errors };
}

function createReleaseSnapshot(input: {
  release_id: string;
  target_root: string;
  catalog_id: string;
  persist: boolean;
}): ReleaseSnapshot {
  const snapshot_dir = join(RELEASE_ROOT, "snapshots", input.release_id);
  const targets = resolveReleaseTargets(input.target_root, input.catalog_id);
  const files = targets.map((path, index) => {
    const existed = existsSync(path);
    const snapshot_path = existed ? join(snapshot_dir, `file-${index}`) : null;
    if (input.persist) {
      mkdirSync(snapshot_dir, { recursive: true });
      if (existed && snapshot_path) copyFileSync(path, snapshot_path);
    }
    return { path, existed, snapshot_path };
  });
  const snapshot: ReleaseSnapshot = { release_id: input.release_id, snapshot_dir, files };
  if (input.persist) {
    writeFileSync(join(snapshot_dir, "snapshot.json"), JSON.stringify(snapshot, null, 2));
  }
  return snapshot;
}

function applyRelease(input: {
  target_root: string;
  package_dir: string;
  catalog_id: string;
  manifest: PackageDraft["manifest"];
  seo: PackageDraft["seo"];
  persist: boolean;
}): void {
  const templateDest = join(
    input.target_root,
    "src/data/template-json",
    `${input.catalog_id}.json`,
  );
  const thumbDest = join(
    input.target_root,
    "public/templates",
    `${input.catalog_id}.png`,
  );
  if (input.persist) {
    mkdirSync(dirname(templateDest), { recursive: true });
    mkdirSync(dirname(thumbDest), { recursive: true });
    copyFileSync(join(input.package_dir, "template.json"), templateDest);
    copyFileSync(join(input.package_dir, "thumbnail.png"), thumbDest);
  }

  const manifestPath = join(input.target_root, "templates.manifest.json");
  const manifestDoc = JSON.parse(readFileSync(manifestPath, "utf8")) as {
    templates: Array<Record<string, unknown>>;
  };
  const publishedEntry = {
    ...input.manifest,
    thumbnailPath: `/templates/${input.catalog_id}.png`,
    status: "published",
  };
  const idx = manifestDoc.templates.findIndex((t) => t.id === input.catalog_id);
  if (idx >= 0) manifestDoc.templates[idx] = publishedEntry;
  else manifestDoc.templates.push(publishedEntry);
  if (input.persist) {
    writeFileSync(manifestPath, JSON.stringify(manifestDoc, null, 2));
  }

  writeTemplateSeoEntry({
    target_root: input.target_root,
    catalog_id: input.catalog_id,
    manifest: publishedEntry,
    seo: input.seo,
    persist: input.persist,
  });

  regenerateTemplateGeneratedFiles({
    target_root: input.target_root,
    manifest: manifestDoc,
    persist: input.persist,
  });
}

function writeTemplateSeoEntry(input: {
  target_root: string;
  catalog_id: string;
  manifest: {
    id: string;
    title: string;
    categoryId: string;
    tags?: string[];
  };
  seo: PackageDraft["seo"];
  persist: boolean;
}): void {
  const seoPath = join(input.target_root, "src/data/templateSeoContent.ts");
  const raw = readFileSync(seoPath, "utf8");
  const entry = `  {
    templateId: ${JSON.stringify(input.catalog_id)},
    slug: ${JSON.stringify(input.seo.slug)},
    seoTitle: ${JSON.stringify(input.seo.meta_title)},
    seoDescription: ${JSON.stringify(input.seo.meta_description)},
    h1: ${JSON.stringify(input.seo.meta_title.replace(/\s+\|\s+StudiosisLab$/, ""))},
    intro: ${JSON.stringify(input.seo.meta_description)},
    bestFor: ["ATS job applications", "StudiosisLab editor workflows", "Professional one-page resumes"],
    whatToInclude: ["Professional summary", "Experience", "Skills", "Education"],
    atsTips: ["Use standard headings", "Keep text machine-readable", "Preserve ATS-safe single-column structure"],
    writingTips: ["Lead with outcomes", "Keep bullets concise", "Match the role with relevant terminology"],
    faq: ${JSON.stringify(input.seo.faq_suggestions, null, 2).replace(/\n/g, "\n    ")},
    relatedTemplateIds: [],
    isPublished: true,
  },`;
  const existsAlready = raw.includes(`templateId: "${input.catalog_id}"`);
  if (existsAlready) return;
  const marker = "export const TEMPLATE_SEO_CONTENT: TemplateSeoEntry[] = [";
  const start = raw.indexOf(marker);
  const end = raw.lastIndexOf("];");
  if (start === -1 || end === -1) {
    throw new Error("Unable to update templateSeoContent.ts");
  }
  const next = `${raw.slice(0, end)}${entry}\n${raw.slice(end)}`;
  if (input.persist) writeFileSync(seoPath, next);
}

function regenerateTemplateGeneratedFiles(input: {
  target_root: string;
  manifest: { templates: Array<Record<string, unknown>> };
  persist: boolean;
}): void {
  const templates = input.manifest.templates as Array<{
    id: string;
    title: string;
    categoryId: string;
    thumbnailPath: string;
    jsonPath: string;
    status: "draft" | "published";
    tags?: string[];
  }>;

  const registryRows = templates
    .map((template) => {
      const importPath = relative(
        join(input.target_root, "src/data/systemTemplates"),
        join(input.target_root, template.jsonPath),
      )
        .split("\\")
        .join("/");
      const resolvedImport = importPath.startsWith(".") ? importPath : `./${importPath}`;
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
        join(input.target_root, "src/data"),
        join(input.target_root, template.jsonPath),
      )
        .split("\\")
        .join("/");
      const resolvedImport = importPath.startsWith(".") ? importPath : `./${importPath}`;
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

  if (input.persist) {
    mkdirSync(join(input.target_root, "src/data/systemTemplates"), { recursive: true });
    writeFileSync(
      join(input.target_root, "src/data/systemTemplates/registry.generated.ts"),
      registryContent,
    );
    writeFileSync(join(input.target_root, "src/data/templateCatalog.generated.ts"), catalogContent);
    writeFileSync(
      join(input.target_root, "src/data/templateSnapshots.generated.ts"),
      snapshotsContent,
    );
  }
}

function resolveReleaseTargets(target_root: string, catalog_id: string): string[] {
  return [
    join(target_root, "src/data/template-json", `${catalog_id}.json`),
    join(target_root, "public/templates", `${catalog_id}.png`),
    join(target_root, "templates.manifest.json"),
    join(target_root, "src/data/systemTemplates/registry.generated.ts"),
    join(target_root, "src/data/templateCatalog.generated.ts"),
    join(target_root, "src/data/templateSnapshots.generated.ts"),
    join(target_root, "src/data/templateSeoContent.ts"),
  ];
}

function renderReleaseReport(input: {
  summary: ReleaseSummary;
  validation: ReleaseValidation;
  snapshot: ReleaseSnapshot;
}): string {
  return [
    "# Release Report",
    "",
    `**Release ID:** ${input.summary.release_id}`,
    `**Catalog ID:** ${input.summary.catalog_id}`,
    `**Template ID:** ${input.summary.template_id}`,
    `**Version:** ${input.summary.release_version}`,
    `**Founder Approval Timestamp:** ${input.summary.founder_approval_timestamp}`,
    `**Checksum:** ${input.summary.checksum}`,
    `**Target Root:** ${input.summary.target_root}`,
    "",
    "## Validation",
    "",
    `**PASS:** ${input.validation.pass}`,
    ...Object.entries(input.validation.checks).map(([key, ok]) => `- ${key}: ${ok ? "PASS" : "FAIL"}`),
    "",
    "## Release Workflow",
    "",
    "1. Founder final publish approval confirmed",
    "2. Publication package validated",
    "3. Existing website files snapshotted",
    "4. Template JSON copied to src/data/template-json/",
    "5. Thumbnail copied to public/templates/",
    "6. templates.manifest.json updated",
    "7. registry.generated.ts, templateCatalog.generated.ts, templateSnapshots.generated.ts refreshed",
    "8. templateSeoContent updated",
    "9. Release history recorded",
    "",
    "## Rollback",
    "",
    `Snapshot stored at: ${input.snapshot.snapshot_dir}`,
    "Use rollbackRelease(release_id) or restorePreviousRelease(catalog_id).",
    "",
    "_Founder approval remains mandatory. No automatic release occurs without explicit invocation._",
  ].join("\n");
}

function appendReleaseHistory(entry: ReleaseHistoryEntry, persist: boolean): void {
  if (!persist) return;
  const history = loadReleaseHistory();
  history.push(entry);
  writeReleaseHistory(history);
}

function loadReleaseHistory(): ReleaseHistoryEntry[] {
  if (!existsSync(RELEASE_HISTORY_PATH)) return [];
  try {
    return JSON.parse(readFileSync(RELEASE_HISTORY_PATH, "utf8")) as ReleaseHistoryEntry[];
  } catch {
    return [];
  }
}

function writeReleaseHistory(history: ReleaseHistoryEntry[]): void {
  mkdirSync(dirname(RELEASE_HISTORY_PATH), { recursive: true });
  writeFileSync(RELEASE_HISTORY_PATH, JSON.stringify(history, null, 2));
}

function sha256(input: Buffer | string): string {
  return createHash("sha256").update(input).digest("hex");
}
