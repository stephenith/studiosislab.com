/**
 * Path helpers for Website Department evidence roots.
 * Narrow realpath-based canonicalization (no general FS security framework).
 */
import { existsSync, realpathSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";

const DEFAULT_REPO_ROOT = resolve(import.meta.dirname, "../../../..");

export function defaultWebsiteDepartmentRoot(repoRoot = DEFAULT_REPO_ROOT): string {
  return join(repoRoot, "SOS/07_LOGS/saios/website-department");
}

export const WEBSITE_DEPARTMENT_ROOT = defaultWebsiteDepartmentRoot();

/**
 * Canonicalize a path: realpath of nearest existing ancestor + unresolved remainder.
 * Falls back to resolve() if realpath fails.
 */
export function canonicalizePath(inputPath: string): string {
  const resolved = resolve(inputPath);
  const missing: string[] = [];
  let cursor = resolved;
  while (!existsSync(cursor)) {
    const parent = dirname(cursor);
    if (parent === cursor) break;
    missing.unshift(basename(cursor));
    cursor = parent;
  }
  try {
    const realBase = realpathSync(cursor);
    return missing.length > 0 ? join(realBase, ...missing) : realBase;
  } catch {
    return resolved;
  }
}

export function isSameOrInsidePath(candidate: string, root: string): boolean {
  const c = canonicalizePath(candidate);
  const r = canonicalizePath(root);
  return c === r || c.startsWith(r + "/");
}
