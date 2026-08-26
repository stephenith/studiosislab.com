/**
 * SnapshotRegistry — Agent #174.
 */
import type { SnapshotSource } from "./SnapshotSource.js";

export class SnapshotRegistry {
  private readonly sources = new Map<string, SnapshotSource>();

  register(source: SnapshotSource): void {
    if (this.sources.has(source.id)) {
      throw new Error(`SnapshotSource already registered: ${source.id}`);
    }
    this.sources.set(source.id, source);
  }

  get(id: string): SnapshotSource | undefined {
    return this.sources.get(id);
  }

  list(): SnapshotSource[] {
    return [...this.sources.values()];
  }

  ids(): string[] {
    return [...this.sources.keys()];
  }

  clear(): void {
    this.sources.clear();
  }
}

/** Process-wide default registry for dashboard loaders. */
export const defaultSnapshotRegistry = new SnapshotRegistry();
