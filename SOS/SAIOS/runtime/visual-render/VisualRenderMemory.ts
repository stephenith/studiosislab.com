/**
 * Visual render memory — append-only visual principles learning.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const SOS_ROOT = resolve(import.meta.dirname, "../../..");
export const VISUAL_RENDER_MEMORY_ROOT = join(SOS_ROOT, "07_LOGS/saios/visual-render/memory");
const MEMORY_PATH = join(VISUAL_RENDER_MEMORY_ROOT, "render-learning.json");

export type RenderMemoryEntry = {
  recorded_at: string;
  template_name: string;
  overall_render_score: number;
  layout_improvements: string[];
  spacing_improvements: string[];
  hierarchy_improvements: string[];
  visual_principles: string[];
};

export type RenderMemoryStore = {
  version: string;
  updated_at: string;
  entries: RenderMemoryEntry[];
};

export function loadRenderMemory(): RenderMemoryStore {
  if (!existsSync(MEMORY_PATH)) return { version: "1.0.0", updated_at: new Date().toISOString(), entries: [] };
  try {
    return JSON.parse(readFileSync(MEMORY_PATH, "utf8")) as RenderMemoryStore;
  } catch {
    return { version: "1.0.0", updated_at: new Date().toISOString(), entries: [] };
  }
}

export function appendRenderMemory(entry: RenderMemoryEntry, persist = true): RenderMemoryStore {
  const store = loadRenderMemory();
  store.entries.push(entry);
  store.updated_at = new Date().toISOString();
  if (persist) {
    mkdirSync(VISUAL_RENDER_MEMORY_ROOT, { recursive: true });
    writeFileSync(MEMORY_PATH, JSON.stringify(store, null, 2));
  }
  return store;
}
