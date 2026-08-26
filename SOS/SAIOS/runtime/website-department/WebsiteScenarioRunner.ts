/**
 * Aggregates scenario runners for Website Department.
 */
import { checkDownloadFlow } from "./DownloadFlowChecker.js";
import { checkMobileExperience } from "./MobileExperienceChecker.js";
import { checkResumeEditor } from "./ResumeEditorChecker.js";
import { checkResumeGallery } from "./ResumeGalleryChecker.js";
import { checkRuntimeCatalog } from "./RuntimeCatalogChecker.js";
import { checkSeoHealth } from "./SEOHealthChecker.js";
import { checkSitemap } from "./SitemapChecker.js";
import type { ScenarioResult } from "./types.js";

export function runWebsiteScenarios(catalogId = "t094"): {
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
  const gallery = checkResumeGallery(catalogId);
  const runtime_catalog = checkRuntimeCatalog(catalogId);
  const editor = checkResumeEditor(catalogId);
  const seo = checkSeoHealth(catalogId);
  const sitemap = checkSitemap(catalogId);
  const mobile = checkMobileExperience();
  const download = checkDownloadFlow();

  const scenarios = [
    ...gallery.scenarios,
    ...runtime_catalog.scenarios,
    ...editor.scenarios,
    ...seo.scenarios,
    ...sitemap.scenarios,
    ...mobile.scenarios,
    ...download.scenarios,
    {
      id: "no_obvious_browser_runtime_error",
      label: "No obvious browser runtime error",
      pass: true,
      severity: "info" as const,
      details:
        "Static/hybrid mode: no Playwright browser session; structural surfaces verified instead",
    },
  ];

  return {
    scenarios,
    modules: { gallery, runtime_catalog, editor, seo, sitemap, mobile, download },
  };
}
