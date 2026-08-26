/**
 * Canonical StudiosisLab website routes for Website Department.
 */
import type { RouteDefinition } from "./types.js";

export const DEFAULT_CATALOG_ID = "t094";
export const DEFAULT_SEO_SLUG = "senior-software-engineer-resume";

export function buildRouteRegistry(input?: {
  catalog_id?: string;
  seo_slug?: string;
}): RouteDefinition[] {
  const catalogId = input?.catalog_id ?? DEFAULT_CATALOG_ID;
  const seoSlug = input?.seo_slug ?? DEFAULT_SEO_SLUG;

  return [
    { id: "home", path: "/", label: "Homepage", critical: true, type: "page" },
    { id: "resume_gallery", path: "/resume", label: "Resume gallery", critical: true, type: "page" },
    {
      id: "resume_category_it",
      path: "/resume/category/it",
      label: "IT category",
      critical: true,
      type: "page",
    },
    {
      id: "resume_seo",
      path: `/resume/${seoSlug}`,
      label: "Template SEO page",
      critical: true,
      type: "page",
    },
    {
      id: "editor_template",
      path: `/editor/template/${catalogId}`,
      label: "Editor template",
      critical: true,
      type: "page",
    },
    {
      id: "api_resume_catalog",
      path: "/api/resume-catalog",
      label: "Resume catalog API",
      critical: true,
      type: "api",
    },
    {
      id: "api_resume_template",
      path: `/api/resume-catalog/template/${catalogId}`,
      label: "Template catalog API",
      critical: true,
      type: "api",
    },
    {
      id: "sitemap",
      path: "/sitemap.xml",
      label: "Sitemap",
      critical: true,
      type: "page",
    },
  ];
}

export function listCriticalRoutes(registry = buildRouteRegistry()): RouteDefinition[] {
  return registry.filter((r) => r.critical);
}
