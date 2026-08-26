/**
 * BaseHealthSnapshot — Agent #173.
 * Helpers for writing/loading health + latest snapshot documents.
 */
import type { BaseAppendOnlyRepository } from "../repositories/BaseAppendOnlyRepository.js";

type RepoIO = {
  atomicWritePublic: (filename: string, data: unknown) => void;
  loadJsonPublic: <T>(filename: string) => T | null;
};

export class BaseHealthSnapshot {
  constructor(private readonly io: RepoIO) {}

  writeHealth(filename: string, health: unknown): void {
    this.io.atomicWritePublic(filename, health);
  }

  writeLatest(filename: string, snapshot: unknown): void {
    this.io.atomicWritePublic(filename, snapshot);
  }

  loadHealth<T>(filename: string): T | null {
    return this.io.loadJsonPublic<T>(filename);
  }

  loadLatest<T>(filename: string): T | null {
    return this.io.loadJsonPublic<T>(filename);
  }
}

/** Build a frozen false safety-flags object (platform default). */
export function lockedSafetyFlagsFalse<
  const K extends readonly string[],
>(keys: K): { [P in K[number]]: false } {
  const out = {} as { [P in K[number]]: false };
  for (const k of keys) {
    (out as Record<string, false>)[k] = false;
  }
  return out;
}

export type { BaseAppendOnlyRepository };
