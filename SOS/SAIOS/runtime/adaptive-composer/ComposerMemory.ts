/**
 * Composer memory — append-only successful compositions.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const SOS_ROOT = resolve(import.meta.dirname, "../../..");
export const COMPOSER_MEMORY_ROOT = join(SOS_ROOT, "07_LOGS/saios/adaptive-composer/memory");
const MEMORY_PATH = join(COMPOSER_MEMORY_ROOT, "composer-learning.json");

export type ComposerMemoryEntry = {
  recorded_at: string;
  composition_id: string;
  objective: string;
  fingerprint: string;
  layout_mode: string;
  typography_pairing: string;
  spacing_rhythm_px: number;
  successful_compositions: string[];
  successful_spacing: string[];
  successful_typography: string[];
  successful_layouts: string[];
  successful_hierarchy: string[];
  successful_combinations: string[];
};

export type ComposerMemoryStore = {
  version: string;
  updated_at: string;
  entries: ComposerMemoryEntry[];
};

export function loadComposerMemory(): ComposerMemoryStore {
  if (!existsSync(MEMORY_PATH)) {
    return { version: "1.0.0", updated_at: new Date().toISOString(), entries: [] };
  }
  try {
    return JSON.parse(readFileSync(MEMORY_PATH, "utf8")) as ComposerMemoryStore;
  } catch {
    return { version: "1.0.0", updated_at: new Date().toISOString(), entries: [] };
  }
}

export function appendComposerMemory(entry: ComposerMemoryEntry, persist = true): ComposerMemoryStore {
  const store = loadComposerMemory();
  store.entries.push(entry);
  store.updated_at = new Date().toISOString();
  if (persist) {
    mkdirSync(COMPOSER_MEMORY_ROOT, { recursive: true });
    writeFileSync(MEMORY_PATH, JSON.stringify(store, null, 2));
  }
  return store;
}
