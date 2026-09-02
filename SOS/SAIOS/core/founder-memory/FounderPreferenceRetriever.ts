/**
 * Retrieve eligible Founder preference memory for generation/revision.
 * Phase 6B: delegates to canonical FounderMemoryConsumption selector.
 */
import type {
  FounderPreferenceMemoryRecord,
  GenerationTargetContext,
} from "./FounderPreferenceMemoryTypes.js";
import { FounderPreferenceMemoryStore } from "./FounderPreferenceMemoryStore.js";
import { selectFounderMemory } from "./FounderMemoryConsumption.js";

export class FounderPreferenceRetriever {
  constructor(private readonly store = new FounderPreferenceMemoryStore()) {}

  retrieve(ctx: GenerationTargetContext): FounderPreferenceMemoryRecord[] {
    try {
      const selection = selectFounderMemory({
        ctx,
        channel: "generation",
        store: this.store,
      });
      const byId = new Map(
        this.store.listActive().map((r) => [r.memory_id, r] as const),
      );
      return selection.memory_ids
        .map((id) => byId.get(id))
        .filter(Boolean) as FounderPreferenceMemoryRecord[];
    } catch {
      return [];
    }
  }
}

export function retrieveFounderPreferencesSafe(
  ctx: GenerationTargetContext,
  repoRoot?: string,
): FounderPreferenceMemoryRecord[] {
  try {
    return new FounderPreferenceRetriever(
      new FounderPreferenceMemoryStore(repoRoot),
    ).retrieve(ctx);
  } catch {
    return [];
  }
}
