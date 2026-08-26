/**
 * Static + live route health checks.
 */
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { buildRouteRegistry } from "./WebsiteRouteRegistry.js";
import type { RouteDefinition, RouteHealthResult, WebsiteDepartmentOptions } from "./types.js";

const REPO_ROOT = resolve(import.meta.dirname, "../../../..");

export async function probeLiveRoute(
  baseUrl: string,
  route: RouteDefinition,
): Promise<RouteHealthResult> {
  const url = `${baseUrl.replace(/\/$/, "")}${route.path}`;
  const started = Date.now();
  try {
    const res = await fetch(url, {
      redirect: "follow",
      signal: AbortSignal.timeout(15_000),
    });
    return {
      route_id: route.id,
      path: route.path,
      ok: res.status >= 200 && res.status < 400,
      status_code: res.status,
      latency_ms: Date.now() - started,
      mode: "live",
      detail: res.ok ? "reachable" : `HTTP ${res.status}`,
    };
  } catch (err) {
    return {
      route_id: route.id,
      path: route.path,
      ok: false,
      status_code: null,
      latency_ms: Date.now() - started,
      mode: "live",
      detail: err instanceof Error ? err.message : String(err),
    };
  }
}

function staticRouteEvidence(route: RouteDefinition, catalogId: string): RouteHealthResult {
  const checks: Record<string, boolean> = {};

  switch (route.id) {
    case "home":
      checks.page = existsSync(join(REPO_ROOT, "src/app/page.tsx"));
      break;
    case "resume_gallery":
      checks.page = existsSync(join(REPO_ROOT, "src/app/resume/page.tsx"));
      checks.client = existsSync(join(REPO_ROOT, "src/app/resume/ResumeHubClient.tsx"));
      break;
    case "resume_category_it":
      checks.page = existsSync(join(REPO_ROOT, "src/app/resume/category/[categoryId]/page.tsx"));
      break;
    case "resume_seo":
      checks.page = existsSync(join(REPO_ROOT, "src/app/resume/[slug]/page.tsx"));
      checks.seo =
        existsSync(join(REPO_ROOT, "src/data/templateSeoContent.ts")) &&
        readFileSync(join(REPO_ROOT, "src/data/templateSeoContent.ts"), "utf8").includes(
          `templateId: "${catalogId}"`,
        );
      break;
    case "editor_template":
      checks.page = existsSync(join(REPO_ROOT, "src/app/editor/template/[templateId]/page.tsx"));
      checks.json = existsSync(join(REPO_ROOT, "src/data/template-json", `${catalogId}.json`));
      break;
    case "api_resume_catalog":
      checks.route = existsSync(join(REPO_ROOT, "src/app/api/resume-catalog/route.ts"));
      checks.runtime = existsSync(join(REPO_ROOT, "src/lib/resumeCatalogRuntime.ts"));
      break;
    case "api_resume_template":
      checks.route = existsSync(
        join(REPO_ROOT, "src/app/api/resume-catalog/template/[templateId]/route.ts"),
      );
      checks.json = existsSync(join(REPO_ROOT, "src/data/template-json", `${catalogId}.json`));
      break;
    case "sitemap":
      checks.sitemap = existsSync(join(REPO_ROOT, "src/app/sitemap.ts"));
      break;
    default:
      checks.unknown = false;
  }

  const ok = Object.values(checks).every(Boolean);
  return {
    route_id: route.id,
    path: route.path,
    ok,
    status_code: ok ? 200 : null,
    latency_ms: null,
    mode: "static",
    detail: ok
      ? `static evidence ok: ${Object.keys(checks).join(",")}`
      : `static evidence failed: ${JSON.stringify(checks)}`,
  };
}

export async function checkWebsiteRoutes(
  options: WebsiteDepartmentOptions = {},
): Promise<{
  results: RouteHealthResult[];
  mode: "static" | "live" | "hybrid";
  base_url: string | null;
}> {
  const catalogId = options.catalog_id ?? "t094";
  const registry = buildRouteRegistry({ catalog_id: catalogId });
  const preferred = options.base_url ?? process.env.WEBSITE_DEPARTMENT_BASE_URL ?? "http://localhost:3000";
  const modePref = options.mode ?? "auto";

  let liveAvailable = false;
  if (modePref !== "static") {
    try {
      const probe = await fetch(preferred, { signal: AbortSignal.timeout(3_000) });
      liveAvailable = probe.status > 0;
    } catch {
      liveAvailable = false;
    }
  }

  if (modePref === "live" && !liveAvailable) {
    throw new Error(`Live mode requested but ${preferred} is unreachable`);
  }

  if (liveAvailable && modePref !== "static") {
    const results = await Promise.all(registry.map((route) => probeLiveRoute(preferred, route)));
    return { results, mode: "live", base_url: preferred };
  }

  const results = registry.map((route) => staticRouteEvidence(route, catalogId));
  return { results, mode: "static", base_url: liveAvailable ? preferred : null };
}
