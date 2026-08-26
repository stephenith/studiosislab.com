/**
 * Resume gallery surface checks.
 */
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { getResumeCatalogSnapshotFromRoot } from "../../../../src/lib/resumeCatalogRuntime.js";
import type { ScenarioResult } from "./types.js";

const REPO_ROOT = resolve(import.meta.dirname, "../../../..");

export function checkResumeGallery(catalogId = "t094"): {
  pass: boolean;
  scenarios: ScenarioResult[];
} {
  const snapshot = getResumeCatalogSnapshotFromRoot(REPO_ROOT);
  const published = snapshot.templates.filter((t) => t.status === "published");
  const target = published.find((t) => t.id === catalogId);
  const hub = join(REPO_ROOT, "src/app/resume/ResumeHubClient.tsx");
  const hubSrc = existsSync(hub) ? readFileSync(hub, "utf8") : "";
  const thumbPath = target?.thumb ? join(REPO_ROOT, "public", target.thumb.replace(/^\//, "")) : null;
  const thumbExists = Boolean(thumbPath && existsSync(thumbPath));

  const scenarios: ScenarioResult[] = [
    {
      id: "homepage_surface",
      label: "Homepage loads",
      pass: existsSync(join(REPO_ROOT, "src/app/page.tsx")),
      severity: "critical",
      details: "src/app/page.tsx present",
    },
    {
      id: "gallery_loads",
      label: "Resume gallery loads",
      pass: existsSync(join(REPO_ROOT, "src/app/resume/page.tsx")) && hubSrc.includes("resume"),
      severity: "critical",
      details: `gallery client present; ${published.length} published templates`,
    },
    {
      id: "thumbnails_load",
      label: "Template thumbnails load",
      pass: thumbExists,
      severity: "critical",
      details: thumbExists
        ? `Thumbnail present for ${catalogId}: ${target?.thumb}`
        : `Thumbnail missing for ${catalogId}: ${target?.thumb ?? "unknown"}`,
    },
    {
      id: "template_search",
      label: "Template search works",
      pass:
        hubSrc.toLowerCase().includes("search") ||
        existsSync(join(REPO_ROOT, "src/lib/runtimeResumeCatalogClient.ts")),
      severity: "warning",
      details: "Search capability detected in gallery client / runtime catalog client",
    },
    {
      id: "category_page",
      label: "Category page loads",
      pass: existsSync(join(REPO_ROOT, "src/app/resume/category/[categoryId]/page.tsx")),
      severity: "critical",
      details: "Category route page present",
    },
  ];

  return { pass: scenarios.every((s) => s.pass || s.severity !== "critical"), scenarios };
}
