/**
 * Atomic JSON write + append-only JSONL helpers — Agent #173.
 */
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";

export function atomicWriteJson(path: string, data: unknown): void {
  const tmp = `${path}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  renameSync(tmp, path);
}

export function appendJsonlLine(path: string, record: unknown): void {
  writeFileSync(path, `${JSON.stringify(record)}\n`, {
    flag: "a",
    encoding: "utf8",
  });
}

export function readJsonlFile<T>(
  path: string,
  opts?: { lenient?: boolean },
): T[] {
  if (!existsSync(path)) return [];
  return readFileSync(path, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line) as T;
      } catch {
        if (opts?.lenient) return null;
        throw new Error(`Invalid JSONL line in ${path}`);
      }
    })
    .filter((x): x is T => x != null);
}

export function loadJsonFile<T>(path: string): T | null {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf8")) as T;
  } catch {
    return null;
  }
}

export function ensureDirectory(dir: string): void {
  mkdirSync(dir, { recursive: true });
}

export function joinLogPath(dir: string, name: string): string {
  return join(dir, name);
}
