/**
 * Shared read helpers for department log publishers (read-only).
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { REPO_ROOT } from "./LiveMonitoringConfiguration.js";

export function readJsonSafe<T>(relOrAbs: string): {
  ok: boolean;
  path: string;
  data: T | null;
} {
  const path = relOrAbs.startsWith("/")
    ? relOrAbs
    : join(REPO_ROOT, relOrAbs);
  if (!existsSync(path)) return { ok: false, path, data: null };
  try {
    return { ok: true, path, data: JSON.parse(readFileSync(path, "utf8")) as T };
  } catch {
    return { ok: false, path, data: null };
  }
}

export function mapSecurityLevelToEvent(
  level: string,
): "SECURITY_WARNING" | "SECURITY_CRITICAL" | null {
  const l = level.toUpperCase();
  if (l === "CRITICAL" || l === "RED") return "SECURITY_CRITICAL";
  if (l === "ORANGE" || l === "YELLOW") return "SECURITY_WARNING";
  return null;
}
