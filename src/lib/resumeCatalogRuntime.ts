import { existsSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

const REPO_ROOT = resolve(process.cwd());

export type RuntimeTemplateRecord = {
  id: string;
  title: string;
  categoryId: string;
  category: string;
  tags: string[];
  thumb: string;
  status: "draft" | "published";
  jsonPath: string;
  numericId: number;
};

export type RuntimeTemplateSeoEntry = {
  templateId: string;
  slug: string;
  seoTitle: string;
  seoDescription: string;
  h1: string;
  intro: string;
  bestFor: string[];
  whatToInclude: string[];
  atsTips: string[];
  writingTips: string[];
  faq: Array<{ question: string; answer: string }>;
  relatedTemplateIds: string[];
  isPublished: true;
};

export type RuntimeTemplateSeoPage = RuntimeTemplateSeoEntry & {
  templateTitle: string;
  thumbnailPath: string;
  templateCategoryId: string;
  templateCategory: string;
  templateTags: string[];
  templateStatus: string;
};

export type ResumeCatalogSnapshot = {
  templates: RuntimeTemplateRecord[];
  seoPages: RuntimeTemplateSeoPage[];
  featuredTemplates: RuntimeTemplateRecord[];
  recentTemplates: RuntimeTemplateRecord[];
  searchIndex: Array<{
    id: string;
    title: string;
    slug: string | null;
    category: string;
    tags: string[];
    searchText: string;
  }>;
  generatedAt: string;
  cacheKey: string;
};

type ManifestTemplate = {
  id: string;
  title: string;
  categoryId: string;
  thumbnailPath: string;
  jsonPath: string;
  status: "draft" | "published";
  tags?: string[];
};

type ManifestDoc = {
  templates: ManifestTemplate[];
};

type CacheEntry = {
  key: string;
  snapshot: ResumeCatalogSnapshot;
};

declare global {
  var __resumeCatalogCache: CacheEntry | undefined;
}

function normalize(input: string): string {
  return String(input || "").trim().toLowerCase();
}

function normalizeCategory(categoryId: string): string {
  return categoryId.replace(/[-_]+/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function toNumericId(templateId: string): number {
  const match = templateId.match(/(\d+)/);
  return match ? Number(match[1]) : 0;
}

function manifestPathFor(root: string): string {
  return join(root, "templates.manifest.json");
}

function seoPathFor(root: string): string {
  return join(root, "src/data/templateSeoContent.ts");
}

function templateJsonDirFor(root: string): string {
  return join(root, "src/data/template-json");
}

function getMtimeMs(path: string): number {
  return existsSync(path) ? statSync(path).mtimeMs : 0;
}

function buildCacheKey(root: string): string {
  return [root, getMtimeMs(manifestPathFor(root)), getMtimeMs(seoPathFor(root))].join(":");
}

function readManifest(root: string): ManifestDoc {
  const raw = readFileSync(manifestPathFor(root), "utf8");
  return JSON.parse(raw) as ManifestDoc;
}

function parseSeoEntries(root: string): RuntimeTemplateSeoEntry[] {
  const raw = readFileSync(seoPathFor(root), "utf8");
  const marker = "export const TEMPLATE_SEO_CONTENT: TemplateSeoEntry[] =";
  const markerIndex = raw.indexOf(marker);
  if (markerIndex === -1) return [];
  const arrayStart = raw.indexOf("[", markerIndex);
  const arrayEnd = raw.lastIndexOf("];");
  if (arrayStart === -1 || arrayEnd === -1) return [];
  const arraySource = raw.slice(arrayStart, arrayEnd + 1);
  const evaluated = Function(`"use strict"; return (${arraySource});`)();
  return Array.isArray(evaluated) ? (evaluated as RuntimeTemplateSeoEntry[]) : [];
}

function buildSnapshot(root: string): ResumeCatalogSnapshot {
  const manifest = readManifest(root);
  const templates = manifest.templates
    .filter((template) => normalize(template.status) === "published")
    .map(
      (template): RuntimeTemplateRecord => ({
        id: template.id,
        title: template.title,
        categoryId: template.categoryId,
        category: normalizeCategory(template.categoryId),
        tags: Array.isArray(template.tags) ? template.tags : [],
        thumb: template.thumbnailPath || `/templates/${template.id}.png`,
        status: "published",
        jsonPath: template.jsonPath,
        numericId: toNumericId(template.id),
      }),
    )
    .sort((a, b) => b.numericId - a.numericId || a.id.localeCompare(b.id));

  const seoEntries = parseSeoEntries(root);
  const templateById = new Map(templates.map((template) => [normalize(template.id), template]));
  const seoPages = seoEntries.flatMap((entry) => {
    if (!entry.isPublished) return [];
    const template = templateById.get(normalize(entry.templateId));
    if (!template) return [];
    return [
      {
        ...entry,
        templateTitle: template.title,
        thumbnailPath: template.thumb,
        templateCategoryId: template.categoryId,
        templateCategory: template.category,
        templateTags: template.tags,
        templateStatus: template.status,
      },
    ];
  });

  // Highest catalogue ids first (already sorted) → "Recent templates" on /resume.
  const recentTemplates = templates.slice(0, 8);
  const recentIdSet = new Set(recentTemplates.map((template) => template.id));
  // Featured must not reuse Recent ids (gallery sections are mutually exclusive by id).
  const featuredTemplates = templates
    .filter(
      (template) =>
        !recentIdSet.has(template.id) && template.tags.length > 0,
    )
    .slice(0, 8);

  const seoById = new Map(seoPages.map((page) => [normalize(page.templateId), page]));
  const searchIndex = templates.map((template) => {
    const seo = seoById.get(normalize(template.id));
    const searchText = [
      template.id,
      template.title,
      template.category,
      template.categoryId,
      ...template.tags,
      seo?.slug ?? "",
      seo?.seoTitle ?? "",
      seo?.seoDescription ?? "",
    ]
      .join(" ")
      .toLowerCase();
    return {
      id: template.id,
      title: template.title,
      slug: seo?.slug ?? null,
      category: template.category,
      tags: template.tags,
      searchText,
    };
  });

  return {
    templates,
    seoPages,
    featuredTemplates,
    recentTemplates,
    searchIndex,
    generatedAt: new Date().toISOString(),
    cacheKey: buildCacheKey(root),
  };
}

export function getResumeCatalogSnapshot(): ResumeCatalogSnapshot {
  const key = buildCacheKey(REPO_ROOT);
  if (globalThis.__resumeCatalogCache?.key === key) {
    return globalThis.__resumeCatalogCache.snapshot;
  }
  const snapshot = buildSnapshot(REPO_ROOT);
  globalThis.__resumeCatalogCache = { key, snapshot };
  return snapshot;
}

export function getResumeCatalogSnapshotFromRoot(root: string): ResumeCatalogSnapshot {
  return buildSnapshot(root);
}

export function getRuntimeTemplates(): RuntimeTemplateRecord[] {
  return getResumeCatalogSnapshot().templates;
}

export function getRuntimeTemplateById(templateId: string): RuntimeTemplateRecord | null {
  return (
    getResumeCatalogSnapshot().templates.find((template) => normalize(template.id) === normalize(templateId)) ??
    null
  );
}

export function getRuntimeSeoPages(): RuntimeTemplateSeoPage[] {
  return getResumeCatalogSnapshot().seoPages;
}

export function getRuntimeSeoPageBySlug(slug: string): RuntimeTemplateSeoPage | null {
  return (
    getResumeCatalogSnapshot().seoPages.find((page) => normalize(page.slug) === normalize(slug)) ?? null
  );
}

export function getRuntimeSeoPageByTemplateId(templateId: string): RuntimeTemplateSeoPage | null {
  return (
    getResumeCatalogSnapshot().seoPages.find(
      (page) => normalize(page.templateId) === normalize(templateId),
    ) ?? null
  );
}

export function loadRuntimeTemplateJson(templateId: string): { objects: unknown[] } | null {
  const template = getRuntimeTemplateById(templateId);
  if (!template) return null;
  const templateJsonPath = join(REPO_ROOT, template.jsonPath);
  if (!existsSync(templateJsonPath)) return null;
  return JSON.parse(readFileSync(templateJsonPath, "utf8")) as { objects: unknown[] };
}

export function loadRuntimeTemplateJsonFromRoot(
  root: string,
  templateId: string,
): { objects: unknown[] } | null {
  const template = getResumeCatalogSnapshotFromRoot(root).templates.find(
    (item) => normalize(item.id) === normalize(templateId),
  );
  if (!template) return null;
  const templateJsonPath = join(root, template.jsonPath);
  if (!existsSync(templateJsonPath)) return null;
  return JSON.parse(readFileSync(templateJsonPath, "utf8")) as { objects: unknown[] };
}

export function runtimeTemplateJsonExists(templateId: string): boolean {
  const template = getRuntimeTemplateById(templateId);
  if (!template) return false;
  return existsSync(join(templateJsonDirFor(REPO_ROOT), `${template.id}.json`));
}
