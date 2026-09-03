/**
 * Static + optional live route health checks.
 * Static evidence is never presented as browser/auth/production proof.
 *
 * Operational execution must go through runWebsiteDepartment (policy gate).
 */
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { outcomeFromExecuted, outcomeFromStaticEvidence } from "./WebsiteCheckHelpers.js";
import { buildRouteRegistry } from "./WebsiteRouteRegistry.js";
import type {
  RouteDefinition,
  RouteHealthResult,
  WebsiteDepartmentOptions,
} from "./types.js";

const DEFAULT_REPO_ROOT = resolve(import.meta.dirname, "../../../..");

export async function probeLiveRoute(
  baseUrl: string,
  route: RouteDefinition,
  repoRoot = DEFAULT_REPO_ROOT,
): Promise<RouteHealthResult> {
  const url = `${baseUrl.replace(/\/$/, "")}${route.path}`;
  const started = Date.now();
  try {
    const res = await fetch(url, {
      redirect: "follow",
      signal: AbortSignal.timeout(15_000),
    });
    const ok = res.status >= 200 && res.status < 400;
    return {
      route_id: route.id,
      path: route.path,
      ok,
      status_code: res.status,
      latency_ms: Date.now() - started,
      mode: "live",
      detail: ok
        ? `reachable (HTTP ${res.status}); auth behaviour not validated`
        : `HTTP ${res.status}`,
      execution: "executed",
      outcome: outcomeFromExecuted(ok),
      auth: route.auth,
      source_files_ok: route.source_files.every((f) =>
        existsSync(join(repoRoot, f.replace(/^\/+/, ""))),
      ),
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
      execution: "executed",
      outcome: "fail",
      auth: route.auth,
      source_files_ok: false,
    };
  }
}

function staticRouteEvidence(
  route: RouteDefinition,
  repoRoot: string,
): RouteHealthResult {
  const missing = route.source_files.filter(
    (f) => !existsSync(join(repoRoot, f.replace(/^\/+/, ""))),
  );
  const sourceOk = missing.length === 0;
  const authNote =
    route.auth === "auth_required"
      ? "; auth_required — static evidence does not validate authentication"
      : "";

  return {
    route_id: route.id,
    path: route.path,
    ok: sourceOk,
    status_code: null,
    latency_ms: null,
    mode: "static",
    detail: sourceOk
      ? `static source evidence ok for URL path ${route.path}${authNote}`
      : `missing source files: ${missing.join(", ")}`,
    execution: "static_evidence_only",
    outcome: outcomeFromStaticEvidence(sourceOk),
    auth: route.auth,
    source_files_ok: sourceOk,
  };
}

export async function checkWebsiteRoutes(
  options: WebsiteDepartmentOptions = {},
): Promise<{
  results: RouteHealthResult[];
  mode: "static" | "live" | "hybrid";
  base_url: string | null;
}> {
  const repoRoot = options.repo_root ?? DEFAULT_REPO_ROOT;
  const registry = buildRouteRegistry({ repo_root: repoRoot });
  const routes = registry.routes;

  const preferred =
    options.base_url ?? process.env.WEBSITE_DEPARTMENT_BASE_URL ?? "http://localhost:3000";
  const modePref = options.mode ?? "auto";
  const allowNetwork =
    options.verification_only === true
      ? false
      : options.allow_network === true && modePref !== "static";

  let liveAvailable = false;
  if (allowNetwork && modePref !== "static") {
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

  if (liveAvailable && allowNetwork && modePref !== "static") {
    const results = await Promise.all(
      routes.map((route) => probeLiveRoute(preferred, route, repoRoot)),
    );
    return { results, mode: "live", base_url: preferred };
  }

  const results = routes.map((route) => staticRouteEvidence(route, repoRoot));
  return { results, mode: "static", base_url: null };
}
