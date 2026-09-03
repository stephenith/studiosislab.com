/**
 * Resume gallery surface checks (static source evidence only).
 */
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { getResumeCatalogSnapshotFromRoot } from "../../../../src/lib/resumeCatalogRuntime.js";
import type { ScenarioResult } from "./types.js";

const DEFAULT_REPO_ROOT = resolve(import.meta.dirname, "../../../..");

export function checkResumeGallery(input?: {
  repo_root?: string;
  template_id?: string | null;
}): {
  pass: boolean;
  scenarios: ScenarioResult[];
} {
  const repoRoot = input?.repo_root ?? DEFAULT_REPO_ROOT;
  const snapshot = getResumeCatalogSnapshotFromRoot(repoRoot);
  const published = snapshot.templates.filter((t) => t.status === "published");
  const templateId = input?.template_id;
  const target = templateId
    ? published.find((t) => t.id === templateId)
    : published.find((t) => t.thumb) ?? published[0];
  const hub = join(repoRoot, "src/app/resume/ResumeHubClient.tsx");
  const hubSrc = existsSync(hub) ? readFileSync(hub, "utf8") : "";
  const thumbPath = target?.thumb
    ? join(repoRoot, "public", target.thumb.replace(/^\//, ""))
    : null;
  const thumbExists = Boolean(thumbPath && existsSync(thumbPath));

  const scenarios: ScenarioResult[] = [
    {
      id: "homepage_surface",
      label: "Homepage source present",
      pass: existsSync(join(repoRoot, "src/app/page.tsx")),
      severity: "critical",
      execution: "static_evidence_only",
      details: "src/app/page.tsx present (not live render proof)",
    },
    {
      id: "gallery_loads",
      label: "Resume gallery source present",
      pass: existsSync(join(repoRoot, "src/app/resume/page.tsx")) && hubSrc.includes("resume"),
      severity: "critical",
      execution: "static_evidence_only",
      details: `gallery client present; ${published.length} published templates (not browser proof)`,
    },
    {
      id: "thumbnails_load",
      label: "Template thumbnail file present",
      pass: thumbExists,
      severity: "critical",
      execution: "static_evidence_only",
      details: thumbExists
        ? `Thumbnail file present for ${target?.id}: ${target?.thumb}`
        : `Thumbnail missing for ${target?.id ?? "unknown"}: ${target?.thumb ?? "none"}`,
    },
    {
      id: "template_search",
      label: "Template search surface present",
      pass:
        hubSrc.toLowerCase().includes("search") ||
        existsSync(join(repoRoot, "src/lib/runtimeResumeCatalogClient.ts")),
      severity: "warning",
      execution: "static_evidence_only",
      details: "Search capability detected in gallery client / runtime catalog client",
    },
    {
      id: "category_page",
      label: "Category page source present",
      pass: existsSync(join(repoRoot, "src/app/resume/category/[categoryId]/page.tsx")),
      severity: "critical",
      execution: "static_evidence_only",
      details: "Category route page present (not live render proof)",
    },
  ];

  return {
    pass: scenarios.every((s) => s.pass || s.severity !== "critical"),
    scenarios,
  };
}
