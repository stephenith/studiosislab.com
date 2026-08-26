/**
 * Publication memory — append-only learning from founder and pipeline signals.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const SOS_ROOT = resolve(import.meta.dirname, "../../..");
export const PUBLICATION_MEMORY_ROOT = join(SOS_ROOT, "07_LOGS/saios/publication/memory");
const MEMORY_PATH = join(PUBLICATION_MEMORY_ROOT, "publication-learning.json");

export type PublicationMemoryEntry = {
  recorded_at: string;
  source: "approval" | "revision" | "rejection" | "qa" | "benchmark" | "design_brain" | "publication_prep";
  catalog_id: string;
  prototype_id: string;
  state: string;
  note: string;
};

export type PublicationMemoryStore = {
  version: string;
  updated_at: string;
  entries: PublicationMemoryEntry[];
};

export function loadPublicationMemory(): PublicationMemoryStore {
  if (!existsSync(MEMORY_PATH)) return { version: "1.0.0", updated_at: new Date().toISOString(), entries: [] };
  try {
    return JSON.parse(readFileSync(MEMORY_PATH, "utf8")) as PublicationMemoryStore;
  } catch {
    return { version: "1.0.0", updated_at: new Date().toISOString(), entries: [] };
  }
}

export function appendPublicationMemory(entry: PublicationMemoryEntry, persist = true): PublicationMemoryStore {
  const store = loadPublicationMemory();
  store.entries.push(entry);
  store.updated_at = new Date().toISOString();
  if (persist) {
    mkdirSync(PUBLICATION_MEMORY_ROOT, { recursive: true });
    writeFileSync(MEMORY_PATH, JSON.stringify(store, null, 2));
  }
  return store;
}
