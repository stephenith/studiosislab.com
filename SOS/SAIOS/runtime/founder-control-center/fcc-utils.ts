/**
 * Shared JSON helpers — read-only aggregation.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { REPO_ROOT } from "./FounderControlConfiguration.js";

export function readJsonSafe<T>(relOrAbs: string): {
  ok: boolean;
  path: string;
  data: T | null;
} {
  const path = relOrAbs.startsWith("/") ? relOrAbs : join(REPO_ROOT, relOrAbs);
  if (!existsSync(path)) return { ok: false, path, data: null };
  try {
    return { ok: true, path, data: JSON.parse(readFileSync(path, "utf8")) as T };
  } catch {
    return { ok: false, path, data: null };
  }
}

export function readTextSafe(relOrAbs: string, max = 400): string {
  const path = relOrAbs.startsWith("/") ? relOrAbs : join(REPO_ROOT, relOrAbs);
  if (!existsSync(path)) return "(missing)";
  try {
    const text = readFileSync(path, "utf8").trim();
    return text.length > max ? `${text.slice(0, max)}…` : text;
  } catch {
    return "(unreadable)";
  }
}

export function na(value: unknown, fallback = "n/a"): string {
  if (value == null || value === "") return fallback;
  return String(value);
}
