/**
 * Sitemap coverage checks (static evidence only).
 */
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { getResumeCatalogSnapshotFromRoot } from "../../../../src/lib/resumeCatalogRuntime.js";
import type { ScenarioResult } from "./types.js";

const DEFAULT_REPO_ROOT = resolve(import.meta.dirname, "../../../..");

export function checkSitemap(input?: {
  repo_root?: string;
  template_id?: string | null;
  seo_slug?: string | null;
}): {
  pass: boolean;
  scenarios: ScenarioResult[];
  report: Record<string, unknown>;
} {
  const repoRoot = input?.repo_root ?? DEFAULT_REPO_ROOT;
  const templateId = input?.template_id;
  const sitemapPath = join(repoRoot, "src/app/sitemap.ts");
  const robotsPath = join(repoRoot, "src/app/robots.ts");
  const src = existsSync(sitemapPath) ? readFileSync(sitemapPath, "utf8") : "";
  const snapshot = getResumeCatalogSnapshotFromRoot(repoRoot);
  const seo =
    (templateId
      ? snapshot.seoPages.find((p) => p.templateId === templateId)
      : null) ??
    (input?.seo_slug
      ? snapshot.seoPages.find((p) => p.slug === input.seo_slug)
      : null) ??
    null;
  const slug = seo?.slug ?? input?.seo_slug ?? null;

  const referencesSlug =
    src.includes("seoPages") ||
    src.includes("getRuntimeSeoPages") ||
    src.includes("resume/") ||
    src.includes("templateSeo") ||
    (slug ? src.includes(slug) : false);

  const scenarios: ScenarioResult[] = [
    {
      id: "sitemap_file_exists",
      label: "Sitemap module exists",
      pass: existsSync(sitemapPath),
      severity: "critical",
      execution: "static_evidence_only",
      details: existsSync(sitemapPath) ? "src/app/sitemap.ts present" : "sitemap.ts missing",
    },
    {
      id: "robots_file_exists",
      label: "Robots module exists",
      pass: existsSync(robotsPath),
      severity: "critical",
      execution: "static_evidence_only",
      details: existsSync(robotsPath) ? "src/app/robots.ts present" : "robots.ts missing",
    },
    {
      id: "sitemap_includes_published_template",
      label: "Sitemap generation wired for SEO pages",
      pass: referencesSlug && Boolean(seo),
      severity: "critical",
      execution: "static_evidence_only",
      details: seo
        ? `Sitemap generation wired for SEO pages; expects /resume/${slug} (not live sitemap fetch)`
        : `No SEO page for ${templateId ?? "unknown"} to include in sitemap`,
    },
  ];

  return {
    pass: scenarios.every((s) => s.pass),
    scenarios,
    report: {
      template_id: templateId,
      slug,
      sitemap_module: existsSync(sitemapPath),
      robots_module: existsSync(robotsPath),
      expected_url_path: slug ? `/resume/${slug}` : null,
      seo_pages_count: snapshot.seoPages.length,
    },
  };
}
