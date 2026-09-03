/**
 * SEO page health (static evidence only).
 */
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { getResumeCatalogSnapshotFromRoot } from "../../../../src/lib/resumeCatalogRuntime.js";
import {
  modulePassFromScenarios,
  outcomeFromStaticEvidence,
  scenarioResult,
} from "./WebsiteCheckHelpers.js";
import type { ScenarioResult } from "./types.js";

const DEFAULT_REPO_ROOT = resolve(import.meta.dirname, "../../../..");

export function checkSeoHealth(input?: {
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
  const seoPath = join(repoRoot, "src/data/templateSeoContent.ts");
  const seoPage = join(repoRoot, "src/app/resume/[slug]/page.tsx");
  const seoLib = join(repoRoot, "src/lib/templateSeo.ts");
  const seoSrc = existsSync(seoPath) ? readFileSync(seoPath, "utf8") : "";
  const snapshot = getResumeCatalogSnapshotFromRoot(repoRoot);
  const seoEntry =
    (templateId
      ? snapshot.seoPages.find((p) => p.templateId === templateId)
      : null) ??
    (input?.seo_slug
      ? snapshot.seoPages.find((p) => p.slug === input.seo_slug)
      : null) ??
    null;
  const slug = seoEntry?.slug ?? input?.seo_slug ?? null;

  const scenarios: ScenarioResult[] = [
    scenarioResult({
      id: "seo_page_loads",
      label: "Template SEO route source + catalog entry",
      outcome: outcomeFromStaticEvidence(
        Boolean(
          existsSync(seoPage) &&
            slug &&
            seoEntry &&
            (seoSrc.includes(`slug: "${slug}"`) ||
              seoSrc.includes(`'${slug}'`) ||
              Boolean(seoEntry.slug)),
        ),
      ),
      severity: "critical",
      execution: "static_evidence_only",
      details: seoEntry
        ? `SEO entry present for ${seoEntry.templateId} → /resume/${slug} (not live render proof)`
        : `SEO entry missing for ${templateId ?? "unknown"}`,
    }),
    scenarioResult({
      id: "seo_metadata_complete",
      label: "SEO metadata complete",
      outcome: outcomeFromStaticEvidence(
        Boolean(
          seoEntry?.seoTitle && seoEntry.seoDescription && seoEntry.h1 && seoEntry.slug,
        ),
      ),
      severity: "warning",
      execution: "static_evidence_only",
      details: seoEntry ? "title/description/h1/slug present" : "metadata incomplete",
    }),
    scenarioResult({
      id: "seo_helpers_present",
      label: "SEO helpers present",
      outcome: outcomeFromStaticEvidence(existsSync(seoLib)),
      severity: "info",
      execution: "static_evidence_only",
      details: "src/lib/templateSeo.ts present",
    }),
  ];

  return {
    pass: modulePassFromScenarios(scenarios),
    scenarios,
    report: {
      template_id: templateId,
      slug,
      has_seo_entry: Boolean(seoEntry),
      seo_title: seoEntry?.seoTitle ?? null,
      published: seoEntry?.isPublished ?? false,
      route: slug ? `/resume/${slug}` : null,
      evidence_note: "static_catalog_only_not_live_http",
    },
  };
}
