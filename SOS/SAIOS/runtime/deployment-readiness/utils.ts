/**
 * Shared read helpers — read-only.
 */
import { accessSync, constants, existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { REPO_ROOT } from "./paths.js";

export function abs(rel: string): string {
  return join(REPO_ROOT, rel);
}

export function exists(rel: string): boolean {
  return existsSync(abs(rel));
}

export function readable(rel: string): boolean {
  try {
    accessSync(abs(rel), constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

export function readJson<T>(rel: string): T | null {
  if (!exists(rel)) return null;
  try {
    return JSON.parse(readFileSync(abs(rel), "utf8")) as T;
  } catch {
    return null;
  }
}

export function fileSize(rel: string): number {
  if (!exists(rel)) return 0;
  try {
    return statSync(abs(rel)).size;
  } catch {
    return 0;
  }
}
