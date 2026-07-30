import type { TemplateSeoEntry } from "@/data/templateSeoContent";
import {
  getRuntimeSeoPageBySlug,
  getRuntimeSeoPageByTemplateId,
  getRuntimeSeoPages,
} from "@/lib/resumeCatalogRuntime";

export type TemplateSeoPage = TemplateSeoEntry & {
  templateTitle: string;
  thumbnailPath: string;
  templateCategoryId: string;
  templateCategory: string;
  templateTags: string[];
  templateStatus?: string;
};

export function getAllPublishedTemplateSeoPages(): TemplateSeoPage[] {
  return getRuntimeSeoPages();
}

export function getTemplateSeoBySlug(slug: string): TemplateSeoPage | null {
  return getRuntimeSeoPageBySlug(slug);
}

export function getTemplateSeoById(templateId: string): TemplateSeoPage | null {
  return getRuntimeSeoPageByTemplateId(templateId);
}
