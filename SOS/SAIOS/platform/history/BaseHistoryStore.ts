/**
 * BaseHistoryStore — Agent #173.
 * Generic history / event append helpers over an append-only repo dir.
 */
import type { BaseAppendOnlyRepository } from "../repositories/BaseAppendOnlyRepository.js";

export class BaseHistoryStore {
  constructor(
    private readonly repo: Pick<
      BaseAppendOnlyRepository,
      "ensureDir"
    > & {
      // Access protected methods via a narrow adapter
      appendJsonlPublic: (filename: string, record: unknown) => void;
      readJsonlPublic: <T>(filename: string) => T[];
    },
  ) {}

  append(filename: string, entry: unknown): void {
    this.repo.appendJsonlPublic(filename, entry);
  }

  list<T>(filename: string): T[] {
    return this.repo.readJsonlPublic<T>(filename);
  }
}

/**
 * Mixin-style helpers for repositories that expose history/events.
 * Prefer calling BaseAppendOnlyRepository protected methods directly.
 */
export function appendHistoryLine(
  repo: { ensureDir(): void; dir: string },
  filename: string,
  entry: unknown,
  write: (path: string, data: string, opts: object) => void,
  joinPath: (dir: string, name: string) => string,
): void {
  repo.ensureDir();
  write(joinPath(repo.dir, filename), `${JSON.stringify(entry)}\n`, {
    flag: "a",
    encoding: "utf8",
  });
}
