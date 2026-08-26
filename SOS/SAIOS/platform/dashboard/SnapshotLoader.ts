/**
 * SnapshotLoader — Agent #174.
 * Aggregates registered SnapshotSources into company_brain field patches.
 */
import type { SnapshotLoadContext, SnapshotSource } from "./SnapshotSource.js";
import type { SnapshotRegistry } from "./SnapshotRegistry.js";

export class SnapshotLoader {
  constructor(private readonly registry: SnapshotRegistry) {}

  /** Merge empty() defaults from all registered sources (registration order). */
  emptyDefaults(): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const source of this.registry.list()) {
      Object.assign(out, source.empty());
    }
    return out;
  }

  /** Load and merge all registered sources. Later sources overwrite earlier keys. */
  loadAll(ctx: SnapshotLoadContext): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const source of this.registry.list()) {
      Object.assign(out, source.load(ctx));
    }
    return out;
  }

  loadOne(id: string, ctx: SnapshotLoadContext): Record<string, unknown> {
    const source = this.registry.get(id);
    if (!source) throw new Error(`SnapshotSource not found: ${id}`);
    return source.load(ctx);
  }

  sources(): SnapshotSource[] {
    return this.registry.list();
  }
}
