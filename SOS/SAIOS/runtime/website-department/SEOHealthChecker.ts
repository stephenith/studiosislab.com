/**
 * SEO page health for Website Department.
 */
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { getResumeCatalogSnapshotFromRoot } from "../../../../src/lib/resumeCatalogRuntime.js";
import { DEFAULT_SEO_SLUG } from "./WebsiteRouteRegistry.js";
import type { ScenarioResult } from "./types.js";

const REPO_ROOT = resolve(import.meta.dirname, "../../../..");

export function checkSeoHealth(catalogId = "t094"): {
  pass: boolean;
  scenarios: ScenarioResult[];
  report: Record<string, unknown>;
} {
  const seoPath = join(REPO_ROOT, "src/data/templateSeoContent.ts");
  const seoPage = join(REPO_ROOT, "src/app/resume/[slug]/page.tsx");
  const seoLib = join(REPO_ROOT, "src/lib/templateSeo.ts");
  const seoSrc = existsSync(seoPath) ? readFileSync(seoPath, "utf8") : "";
  const snapshot = getResumeCatalogSnapshotFromRoot(REPO_ROOT);
  const seoEntry = snapshot.seoPages.find((p) => p.templateId === catalogId) ?? null;
  const slug = seoEntry?.slug ?? DEFAULT_SEO_SLUG;

  const scenarios: ScenarioResult[] = [
    {
      id: "seo_page_loads",
      label: "Template SEO page loads",
      pass:
        existsSync(seoPage) &&
        seoSrc.includes(`templateId: "${catalogId}"`) &&
        seoSrc.includes(`slug: "${slug}"`),
      severity: "critical",
      details: seoEntry
        ? `SEO entry present for ${catalogId} → /resume/${slug}`
        : `SEO entry missing for ${catalogId}`,
    },
    {
      id: "seo_metadata_complete",
      label: "SEO metadata complete",
      pass: Boolean(
        seoEntry?.seoTitle &&
          seoEntry.seoDescription &&
          seoEntry.h1 &&
          seoEntry.slug,
      ),
      severity: "warning",
      details: seoEntry
        ? `title/description/h1/slug present`
        : "metadata incomplete",
    },
    {
      id: "seo_helpers_present",
      label: "SEO helpers present",
      pass: existsSync(seoLib),
      severity: "info",
      details: "src/lib/templateSeo.ts present",
    },
  ];

  return {
    pass: scenarios.filter((s) => s.severity === "critical").every((s) => s.pass),
    scenarios,
    report: {
      catalog_id: catalogId,
      slug,
      has_seo_entry: Boolean(seoEntry),
      seo_title: seoEntry?.seoTitle ?? null,
      published: seoEntry?.isPublished ?? false,
      route: `/resume/${slug}`,
    },
  };
}
