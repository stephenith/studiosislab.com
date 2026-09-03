/**
 * Bounded critical-route registry derived from current repository data.
 * No hard-coded t094 / senior-software-engineer-resume.
 */
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { getResumeCatalogSnapshotFromRoot } from "../../../../src/lib/resumeCatalogRuntime.js";
import type { RouteDefinition } from "./types.js";

const DEFAULT_REPO_ROOT = resolve(import.meta.dirname, "../../../..");

export type RegistryExample = {
  template_id: string | null;
  seo_slug: string | null;
  category_id: string | null;
};

export function resolveCurrentRegistryExample(repoRoot = DEFAULT_REPO_ROOT): RegistryExample {
  const snapshot = getResumeCatalogSnapshotFromRoot(repoRoot);
  const published = snapshot.templates.filter((t) => t.status === "published");
  const seoPages = snapshot.seoPages.filter((p) => p.isPublished && p.slug);

  // Prefer a published SEO page whose template is also published and has JSON on disk.
  let chosen = seoPages.find((p) => {
    const tmpl = published.find((t) => t.id === p.templateId);
    if (!tmpl) return false;
    return existsSync(join(repoRoot, tmpl.jsonPath));
  });

  if (!chosen && seoPages.length > 0) {
    chosen = seoPages[0];
  }

  const template =
    (chosen && published.find((t) => t.id === chosen!.templateId)) ||
    published.find((t) => existsSync(join(repoRoot, t.jsonPath))) ||
    published[0] ||
    null;

  const categoryId = template?.categoryId ?? published[0]?.categoryId ?? null;

  return {
    template_id: template?.id ?? chosen?.templateId ?? null,
    seo_slug: chosen?.slug ?? null,
    category_id: categoryId,
  };
}

export function buildRouteRegistry(input?: {
  repo_root?: string;
  example?: RegistryExample;
}): { routes: RouteDefinition[]; example: RegistryExample } {
  const repoRoot = input?.repo_root ?? DEFAULT_REPO_ROOT;
  const example = input?.example ?? resolveCurrentRegistryExample(repoRoot);

  const seoPath = example.seo_slug ? `/resume/${example.seo_slug}` : "/resume";
  const editorPath = example.template_id
    ? `/editor/template/${example.template_id}`
    : "/editor";

  const routes: RouteDefinition[] = [
    {
      id: "home",
      path: "/",
      label: "Homepage",
      critical: true,
      type: "page",
      source_files: ["src/app/page.tsx"],
      auth: "public",
    },
    {
      id: "resume_gallery",
      path: "/resume",
      label: "Resume gallery",
      critical: true,
      type: "page",
      source_files: ["src/app/resume/page.tsx", "src/app/resume/ResumeHubClient.tsx"],
      auth: "public",
    },
    {
      id: "resume_template_detail",
      path: seoPath,
      label: "Resume Template detail (SEO)",
      critical: true,
      type: "page",
      source_files: ["src/app/resume/[slug]/page.tsx", "src/data/templateSeoContent.ts"],
      auth: "public",
      notes: example.seo_slug
        ? `Derived slug ${example.seo_slug} for template ${example.template_id ?? "unknown"}`
        : "No published SEO slug available; path falls back to /resume",
    },
    {
      id: "resume_builder",
      path: "/resume-builder",
      label: "Resume Builder landing",
      critical: true,
      type: "page",
      source_files: ["src/app/resume-builder/page.tsx"],
      auth: "public",
    },
    {
      id: "editor_entry",
      path: editorPath,
      label: "Editor entry",
      critical: true,
      type: "page",
      source_files: [
        "src/app/editor/page.tsx",
        "src/app/editor/template/[templateId]/page.tsx",
        "src/components/editor/EditorAuthGate.tsx",
      ],
      auth: "auth_required",
      notes: "Static evidence does not validate authentication behaviour",
    },
    {
      id: "tools_entry",
      path: "/tools",
      label: "Tools hub",
      critical: true,
      type: "page",
      source_files: ["src/app/tools/page.tsx", "src/app/tools/ToolsHubClient.tsx"],
      auth: "auth_required",
      notes: "Hub redirects unauthenticated users; static check does not prove auth",
    },
    {
      id: "esign_marketing",
      path: "/esign-online",
      label: "E-sign marketing entry",
      critical: true,
      type: "page",
      source_files: ["src/app/esign-online/page.tsx"],
      auth: "public",
    },
    {
      id: "login",
      path: "/login",
      label: "Login",
      critical: true,
      type: "page",
      source_files: ["src/app/login/page.tsx"],
      auth: "public",
    },
    {
      id: "sitemap",
      path: "/sitemap.xml",
      label: "Sitemap",
      critical: true,
      type: "meta",
      source_files: ["src/app/sitemap.ts"],
      auth: "public",
    },
    {
      id: "robots",
      path: "/robots.txt",
      label: "Robots",
      critical: true,
      type: "meta",
      source_files: ["src/app/robots.ts"],
      auth: "public",
    },
    {
      id: "api_resume_catalog",
      path: "/api/resume-catalog",
      label: "Public resume-catalog API",
      critical: true,
      type: "api",
      source_files: ["src/app/api/resume-catalog/route.ts", "src/lib/resumeCatalogRuntime.ts"],
      auth: "public",
    },
  ];

  return { routes, example };
}

export function listCriticalRoutes(
  registry = buildRouteRegistry(),
): RouteDefinition[] {
  return registry.routes.filter((r) => r.critical);
}

/** Legacy constants removed from runtime use — kept absent intentionally. */
export const FORBIDDEN_LEGACY_SLUG = "senior-software-engineer-resume";
export const FORBIDDEN_LEGACY_CATALOG = "t094";
