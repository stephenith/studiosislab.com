/**
 * Design memory — append-only founder preference history for Design Brain.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const SOS_ROOT = resolve(import.meta.dirname, "../../..");
export const BRAIN_MEMORY_ROOT = join(SOS_ROOT, "07_LOGS/saios/design-brain/memory");
const MEMORY_PATH = join(BRAIN_MEMORY_ROOT, "founder-preferences.json");

export type BrainMemoryEntry = {
  recorded_at: string;
  source: "approval" | "revision" | "rejection" | "qa" | "local_review" | "research";
  note: string;
  preferences: {
    spacing_bias?: "tight" | "balanced" | "spacious";
    typography_bias?: string[];
    color_bias?: string[];
    layout_bias?: string[];
    ats_priority?: boolean;
    premium_preference?: boolean;
  };
};

export type BrainMemoryStore = {
  version: string;
  updated_at: string;
  entries: BrainMemoryEntry[];
  aggregate: {
    approval_count: number;
    revision_count: number;
    rejection_count: number;
    preferred_fonts: string[];
    preferred_accents: string[];
    ats_first_ratio: number;
  };
};

export function loadBrainMemory(): BrainMemoryStore {
  if (!existsSync(MEMORY_PATH)) return createDefaultBrainMemory();
  try {
    return JSON.parse(readFileSync(MEMORY_PATH, "utf8")) as BrainMemoryStore;
  } catch {
    return createDefaultBrainMemory();
  }
}

export function createDefaultBrainMemory(): BrainMemoryStore {
  return {
    version: "1.0.0",
    updated_at: new Date().toISOString(),
    entries: [],
    aggregate: {
      approval_count: 0,
      revision_count: 0,
      rejection_count: 0,
      preferred_fonts: ["Inter", "Arial"],
      preferred_accents: ["#2563eb"],
      ats_first_ratio: 0.85,
    },
  };
}

export function appendBrainMemory(entry: BrainMemoryEntry, persist = true): BrainMemoryStore {
  const store = loadBrainMemory();
  store.entries.push(entry);
  store.updated_at = new Date().toISOString();

  if (entry.source === "approval") store.aggregate.approval_count += 1;
  if (entry.source === "revision") store.aggregate.revision_count += 1;
  if (entry.source === "rejection") store.aggregate.rejection_count += 1;

  const fonts = entry.preferences.typography_bias ?? [];
  for (const f of fonts) {
    if (!store.aggregate.preferred_fonts.includes(f)) {
      store.aggregate.preferred_fonts.push(f);
    }
  }

  if (persist) {
    mkdirSync(BRAIN_MEMORY_ROOT, { recursive: true });
    writeFileSync(MEMORY_PATH, JSON.stringify(store, null, 2));
  }

  return store;
}

export function getMemoryConfidence(memory: BrainMemoryStore): number {
  const total =
    memory.aggregate.approval_count +
    memory.aggregate.revision_count +
    memory.aggregate.rejection_count;
  if (total === 0) return 70;
  const approvalRate = memory.aggregate.approval_count / total;
  return Math.min(98, Math.round(60 + approvalRate * 40));
}
