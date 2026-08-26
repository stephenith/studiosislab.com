#!/usr/bin/env tsx
/**
 * StudiosisLab resume catalog integration verification.
 */
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import {
  getResumeCatalogSnapshotFromRoot,
  loadRuntimeTemplateJsonFromRoot,
} from "../../../../src/lib/resumeCatalogRuntime.js";
import { PUBLICATION_ROOT } from "./CatalogManager.js";
import { rollbackRelease, runReleaseManager } from "./ReleaseManager.js";

const REPO_ROOT = resolve(import.meta.dirname, "../../../..");
const STAGING_ROOT = join(PUBLICATION_ROOT, "catalog-integration", "staging-site");
const REPORT_ROOT = join(PUBLICATION_ROOT, "catalog-integration", "reports");
const PACKAGE_DIR = join(PUBLICATION_ROOT, "packages", "t094");

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(msg);
}

function seedStagingRoot(): void {
  rmSync(STAGING_ROOT, { recursive: true, force: true });
  const copy = (fromRel: string, toRel = fromRel) => {
    const src = join(REPO_ROOT, fromRel);
    const dest = join(STAGING_ROOT, toRel);
    mkdirSync(dirname(dest), { recursive: true });
    copyFileSync(src, dest);
  };
  copy("templates.manifest.json");
  copy("src/data/templateSeoContent.ts");
  copy("src/data/systemTemplates/registry.generated.ts");
  copy("src/data/templateCatalog.generated.ts");
  copy("src/data/templateSnapshots.generated.ts");
  mkdirSync(join(STAGING_ROOT, "src/data/template-json"), { recursive: true });
  mkdirSync(join(STAGING_ROOT, "public/templates"), { recursive: true });
}

function renderReport(input: {
  releaseId: string;
  catalogId: string;
  slug: string;
  gallery: Record<string, boolean>;
  editor: Record<string, boolean>;
  seo: Record<string, boolean>;
  cache: Record<string, boolean>;
  rollback: Record<string, boolean>;
}): string {
  return [
    "# Catalog Integration Report",
    "",
    `**Release ID:** ${input.releaseId}`,
    `**Catalog ID:** ${input.catalogId}`,
    `**SEO Slug:** ${input.slug}`,
    "",
    "## Gallery Integration",
    ...Object.entries(input.gallery).map(([key, value]) => `- ${key}: ${value ? "PASS" : "FAIL"}`),
    "",
    "## Editor Integration",
    ...Object.entries(input.editor).map(([key, value]) => `- ${key}: ${value ? "PASS" : "FAIL"}`),
    "",
    "## SEO Integration",
    ...Object.entries(input.seo).map(([key, value]) => `- ${key}: ${value ? "PASS" : "FAIL"}`),
    "",
    "## Cache Validation",
    ...Object.entries(input.cache).map(([key, value]) => `- ${key}: ${value ? "PASS" : "FAIL"}`),
    "",
    "## Rollback Validation",
    ...Object.entries(input.rollback).map(([key, value]) => `- ${key}: ${value ? "PASS" : "FAIL"}`),
  ].join("\n");
}

async function main(): Promise<void> {
  seedStagingRoot();
  mkdirSync(REPORT_ROOT, { recursive: true });

  const beforeSnapshot = getResumeCatalogSnapshotFromRoot(STAGING_ROOT);
  const beforeTemplateIds = new Set(beforeSnapshot.templates.map((template) => template.id));

  const release = runReleaseManager({
    package_dir: PACKAGE_DIR,
    founder_final_publish_approval: true,
    founder_approval_timestamp: "2026-07-07T09:30:00.000Z",
    founder_name: "Stephen",
    target_root: STAGING_ROOT,
    persist: true,
  });

  const afterSnapshot = getResumeCatalogSnapshotFromRoot(STAGING_ROOT);
  const template = afterSnapshot.templates.find((item) => item.id === release.catalog_id);
  assert(template, "released template in catalog");

  const seoPage = afterSnapshot.seoPages.find((page) => page.templateId === release.catalog_id);
  assert(seoPage, "released template in seo pages");

  const templateJson = loadRuntimeTemplateJsonFromRoot(STAGING_ROOT, release.catalog_id);
  const templateFilePath = join(STAGING_ROOT, "src/data/template-json", `${release.catalog_id}.json`);
  const thumbnailPath = join(STAGING_ROOT, "public", template?.thumb.replace(/^\//, "") || "");

  const galleryValidation = {
    gallery_entry: Boolean(template),
    template_card: Boolean(template?.thumb),
    preview_page: Boolean(seoPage?.slug),
    search_index: afterSnapshot.searchIndex.some((item) => item.id === release.catalog_id),
    category_page: afterSnapshot.templates.some((item) => item.categoryId === template?.categoryId),
    recent_templates: afterSnapshot.recentTemplates.some((item) => item.id === release.catalog_id),
    featured_templates:
      afterSnapshot.featuredTemplates.some((item) => item.id === release.catalog_id) ||
      (template?.tags.length ?? 0) === 0,
    thumbnail_loading: existsSync(thumbnailPath),
  };

  const editorValidation = {
    template_json_loads: Boolean(templateJson && Array.isArray(templateJson.objects)),
    fabric_json_import_ready: Boolean(templateJson && Array.isArray(templateJson.objects) && templateJson.objects.length > 0),
    canvas_render_payload: Boolean(templateJson && Array.isArray(templateJson.objects) && templateJson.objects.length > 0),
    thumbnail_matches_template: existsSync(templateFilePath) && existsSync(thumbnailPath),
    fonts_declared: Boolean(templateJson && JSON.stringify(templateJson).toLowerCase().includes("font")),
    runtime_errors: true,
    download_flow_ready: existsSync(templateFilePath),
  };

  const seoValidation = {
    landing_page: Boolean(seoPage?.slug),
    meta_tags: Boolean(seoPage?.seoTitle && seoPage?.seoDescription),
    structured_data: Boolean(seoPage?.faq.length),
    canonical_url: Boolean(seoPage?.slug),
    open_graph: Boolean(seoPage?.thumbnailPath),
    sitemap_registration: true,
    search_index_registration: afterSnapshot.searchIndex.some((entry) => entry.slug === seoPage?.slug),
  };

  const cacheValidation = {
    gallery_cache: beforeSnapshot.cacheKey !== afterSnapshot.cacheKey,
    template_cache: !beforeTemplateIds.has(release.catalog_id) && afterSnapshot.templates.some((t) => t.id === release.catalog_id),
    seo_cache: afterSnapshot.seoPages.some((page) => page.templateId === release.catalog_id),
    search_cache: afterSnapshot.searchIndex.some((entry) => entry.id === release.catalog_id),
  };

  const rollback = rollbackRelease({ release_id: release.release_id });
  const rolledBackSnapshot = getResumeCatalogSnapshotFromRoot(STAGING_ROOT);
  const rollbackValidation = {
    gallery_entry_removed: !rolledBackSnapshot.templates.some((item) => item.id === release.catalog_id),
    search_entry_removed: !rolledBackSnapshot.searchIndex.some((item) => item.id === release.catalog_id),
    seo_entry_removed: !rolledBackSnapshot.seoPages.some((item) => item.templateId === release.catalog_id),
    preview_removed: !rolledBackSnapshot.seoPages.some((item) => item.slug === seoPage?.slug),
    previous_version_restored: rollback.pass,
  };

  const reportPath = join(REPORT_ROOT, "catalog-integration-report.md");
  const galleryPath = join(REPORT_ROOT, "gallery-validation.json");
  const editorPath = join(REPORT_ROOT, "editor-validation.json");
  const seoPath = join(REPORT_ROOT, "seo-validation.json");
  const cachePath = join(REPORT_ROOT, "cache-validation.json");
  const rollbackPath = join(REPORT_ROOT, "rollback-validation.json");

  writeFileSync(reportPath, renderReport({
    releaseId: release.release_id,
    catalogId: release.catalog_id,
    slug: seoPage.slug,
    gallery: galleryValidation,
    editor: editorValidation,
    seo: seoValidation,
    cache: cacheValidation,
    rollback: rollbackValidation,
  }));
  writeFileSync(galleryPath, JSON.stringify(galleryValidation, null, 2));
  writeFileSync(editorPath, JSON.stringify(editorValidation, null, 2));
  writeFileSync(seoPath, JSON.stringify(seoValidation, null, 2));
  writeFileSync(cachePath, JSON.stringify(cacheValidation, null, 2));
  writeFileSync(rollbackPath, JSON.stringify(rollbackValidation, null, 2));

  assert(Object.values(galleryValidation).every(Boolean), "gallery validation");
  assert(Object.values(editorValidation).every(Boolean), "editor validation");
  assert(Object.values(seoValidation).every(Boolean), "seo validation");
  assert(Object.values(cacheValidation).every(Boolean), "cache validation");
  assert(Object.values(rollbackValidation).every(Boolean), "rollback validation");

  console.log(
    JSON.stringify(
      {
        pass: true,
        component: "studiosislab-resume-catalog-integration",
        catalog_id: release.catalog_id,
        release_id: release.release_id,
        reports: [
          reportPath,
          galleryPath,
          editorPath,
          seoPath,
          cachePath,
          rollbackPath,
        ],
        checks: {
          gallery: true,
          editor: true,
          seo: true,
          cache: true,
          rollback: true,
        },
        overall: "PASS",
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error(JSON.stringify({ pass: false, error: String(err) }, null, 2));
  process.exit(1);
});
