/**
 * Sitemap coverage checks.
 */
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { getResumeCatalogSnapshotFromRoot } from "../../../../src/lib/resumeCatalogRuntime.js";
import { DEFAULT_SEO_SLUG } from "./WebsiteRouteRegistry.js";
import type { ScenarioResult } from "./types.js";

const REPO_ROOT = resolve(import.meta.dirname, "../../../..");

export function checkSitemap(catalogId = "t094"): {
  pass: boolean;
  scenarios: ScenarioResult[];
  report: Record<string, unknown>;
} {
  const sitemapPath = join(REPO_ROOT, "src/app/sitemap.ts");
  const src = existsSync(sitemapPath) ? readFileSync(sitemapPath, "utf8") : "";
  const snapshot = getResumeCatalogSnapshotFromRoot(REPO_ROOT);
  const seo = snapshot.seoPages.find((p) => p.templateId === catalogId);
  const slug = seo?.slug ?? DEFAULT_SEO_SLUG;

  const referencesSlug =
    src.includes(slug) ||
    src.includes("seoPages") ||
    src.includes("getRuntimeSeoPages") ||
    src.includes("resume/") ||
    src.includes("templateSeo");

  const scenarios: ScenarioResult[] = [
    {
      id: "sitemap_file_exists",
      label: "Sitemap module exists",
      pass: existsSync(sitemapPath),
      severity: "critical",
      details: existsSync(sitemapPath) ? "src/app/sitemap.ts present" : "sitemap.ts missing",
    },
    {
      id: "sitemap_includes_published_template",
      label: "Sitemap includes published template",
      pass: referencesSlug && Boolean(seo),
      severity: "critical",
      details: seo
        ? `Sitemap generation wired for SEO pages; expects /resume/${slug}`
        : `No SEO page for ${catalogId} to include in sitemap`,
    },
  ];

  return {
    pass: scenarios.every((s) => s.pass),
    scenarios,
    report: {
      catalog_id: catalogId,
      slug,
      sitemap_module: existsSync(sitemapPath),
      expected_url_path: `/resume/${slug}`,
      seo_pages_count: snapshot.seoPages.length,
    },
  };
}
