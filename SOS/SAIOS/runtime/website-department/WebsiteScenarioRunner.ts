/**
 * Aggregates scenario runners for Website Department.
 * Browser/auth journeys are explicitly NOT_RUN until Phase 2B.
 */
import { checkDownloadFlow } from "./DownloadFlowChecker.js";
import { checkMobileExperience } from "./MobileExperienceChecker.js";
import { checkResumeEditor } from "./ResumeEditorChecker.js";
import { checkResumeGallery } from "./ResumeGalleryChecker.js";
import { checkRuntimeCatalog } from "./RuntimeCatalogChecker.js";
import { checkSeoHealth } from "./SEOHealthChecker.js";
import { checkSitemap } from "./SitemapChecker.js";
import { scenarioResult } from "./WebsiteCheckHelpers.js";
import type { ScenarioResult } from "./types.js";

export function runWebsiteScenarios(input?: {
  repo_root?: string;
  template_id?: string | null;
  seo_slug?: string | null;
}): {
  scenarios: ScenarioResult[];
  modules: {
    gallery: ReturnType<typeof checkResumeGallery>;
    runtime_catalog: ReturnType<typeof checkRuntimeCatalog>;
    editor: ReturnType<typeof checkResumeEditor>;
    seo: ReturnType<typeof checkSeoHealth>;
    sitemap: ReturnType<typeof checkSitemap>;
    mobile: ReturnType<typeof checkMobileExperience>;
    download: ReturnType<typeof checkDownloadFlow>;
  };
} {
  const templateId = input?.template_id ?? null;
  const seoSlug = input?.seo_slug ?? null;
  const repoRoot = input?.repo_root;

  const gallery = checkResumeGallery({ repo_root: repoRoot, template_id: templateId });
  const runtime_catalog = checkRuntimeCatalog({
    repo_root: repoRoot,
    template_id: templateId,
  });
  const editor = checkResumeEditor({ repo_root: repoRoot, template_id: templateId });
  const seo = checkSeoHealth({
    repo_root: repoRoot,
    template_id: templateId,
    seo_slug: seoSlug,
  });
  const sitemap = checkSitemap({
    repo_root: repoRoot,
    template_id: templateId,
    seo_slug: seoSlug,
  });
  const mobile = checkMobileExperience({ repo_root: repoRoot });
  const download = checkDownloadFlow({ repo_root: repoRoot });

  const browserScenario = scenarioResult({
    id: "browser_journey",
    label: "Browser journey (Playwright)",
    outcome: "not_run",
    severity: "info",
    execution: "not_run",
    details:
      "NOT_RUN: browser automation deferred to Phase 2B; static source evidence is not proof of browser journeys, console cleanliness, or production health",
    evidence: { coverage: "NOT_RUN", playwright: false },
  });

  const authScenario = scenarioResult({
    id: "authentication_behaviour",
    label: "Authentication behaviour",
    outcome: "not_run",
    severity: "info",
    execution: "not_run",
    details:
      "NOT_RUN: auth-required routes are identified in the registry only; static checks do not validate login, redirects, or session behaviour",
    evidence: { coverage: "NOT_RUN" },
  });

  const scenarios = [
    ...gallery.scenarios,
    ...runtime_catalog.scenarios,
    ...editor.scenarios,
    ...seo.scenarios,
    ...sitemap.scenarios,
    ...mobile.scenarios,
    ...download.scenarios,
    browserScenario,
    authScenario,
  ];

  return {
    scenarios,
    modules: { gallery, runtime_catalog, editor, seo, sitemap, mobile, download },
  };
}
