/**
 * Shared JSON helpers for read-only security checks.
 */
import { existsSync, readFileSync } from "node:fs";

export function readJsonSafe<T>(path: string): { ok: boolean; data: T | null } {
  if (!existsSync(path)) return { ok: false, data: null };
  try {
    return { ok: true, data: JSON.parse(readFileSync(path, "utf8")) as T };
  } catch {
    return { ok: false, data: null };
  }
}

export function sourceEntry(id: string, path: string) {
  return {
    id,
    path,
    status: (existsSync(path) ? "available" : "unavailable") as "available" | "unavailable",
  };
}
