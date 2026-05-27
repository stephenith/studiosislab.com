import { TEMPLATE_SEO_CONTENT, type TemplateSeoEntry } from "@/data/templateSeoContent";
import { TEMPLATES } from "@/data/templates";

type TemplateRecord = {
  id: string;
  title: string;
  categoryId?: string;
  category?: string;
  tags?: string[];
  thumb?: string;
  status?: "draft" | "published" | string;
};

export type TemplateSeoPage = TemplateSeoEntry & {
  templateTitle: string;
  thumbnailPath: string;
  templateCategoryId: string;
  templateCategory: string;
  templateTags: string[];
  templateStatus?: string;
};

function normalize(value: string): string {
  return String(value || "").trim().toLowerCase();
}

function isTemplatePublished(template: TemplateRecord): boolean {
  if (typeof template.status === "string") {
    return normalize(template.status) === "published";
  }
  return true;
}

function toTemplateSeoPage(entry: TemplateSeoEntry, template: TemplateRecord): TemplateSeoPage {
  return {
    ...entry,
    templateTitle: template.title,
    thumbnailPath: template.thumb || `/templates/${template.id}.png`,
    templateCategoryId: template.categoryId || "",
    templateCategory: template.category || template.categoryId || "",
    templateTags: Array.isArray(template.tags) ? template.tags : [],
    templateStatus: template.status,
  };
}

function buildPublishedTemplateSeoPages(): TemplateSeoPage[] {
  const templateById = new Map(
    (TEMPLATES as TemplateRecord[]).map((template) => [normalize(template.id), template])
  );

  return TEMPLATE_SEO_CONTENT.flatMap((entry) => {
    if (!entry.isPublished) return [];
    const template = templateById.get(normalize(entry.templateId));
    if (!template) return [];
    if (!isTemplatePublished(template)) return [];
    return [toTemplateSeoPage(entry, template)];
  });
}

const PUBLISHED_TEMPLATE_SEO_PAGES = buildPublishedTemplateSeoPages();
const SEO_BY_SLUG = new Map(PUBLISHED_TEMPLATE_SEO_PAGES.map((page) => [normalize(page.slug), page]));
const SEO_BY_TEMPLATE_ID = new Map(
  PUBLISHED_TEMPLATE_SEO_PAGES.map((page) => [normalize(page.templateId), page])
);

export function getAllPublishedTemplateSeoPages(): TemplateSeoPage[] {
  return [...PUBLISHED_TEMPLATE_SEO_PAGES];
}

export function getTemplateSeoBySlug(slug: string): TemplateSeoPage | null {
  return SEO_BY_SLUG.get(normalize(slug)) ?? null;
}

export function getTemplateSeoById(templateId: string): TemplateSeoPage | null {
  return SEO_BY_TEMPLATE_ID.get(normalize(templateId)) ?? null;
}
