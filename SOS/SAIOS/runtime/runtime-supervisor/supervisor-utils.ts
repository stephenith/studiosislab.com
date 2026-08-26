/**
 * Shared read helpers for supervisor (read-only).
 */
import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { REPO_ROOT } from "./SupervisorConfiguration.js";

export function readJsonSafe<T>(rel: string): {
  ok: boolean;
  path: string;
  data: T | null;
  mtime_ms: number | null;
} {
  const path = join(REPO_ROOT, rel);
  if (!existsSync(path)) return { ok: false, path, data: null, mtime_ms: null };
  try {
    const mtime_ms = statSync(path).mtimeMs;
    return {
      ok: true,
      path,
      data: JSON.parse(readFileSync(path, "utf8")) as T,
      mtime_ms,
    };
  } catch {
    return { ok: false, path, data: null, mtime_ms: null };
  }
}

export function fileAgeMs(rel: string): number | null {
  const path = join(REPO_ROOT, rel);
  if (!existsSync(path)) return null;
  try {
    return Date.now() - statSync(path).mtimeMs;
  } catch {
    return null;
  }
}

export function isoAgeMs(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return Date.now() - t;
}
