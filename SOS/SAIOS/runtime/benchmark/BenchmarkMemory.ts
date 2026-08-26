/**
 * Benchmark memory — append-only learning from founder, QA, and discoveries.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const SOS_ROOT = resolve(import.meta.dirname, "../../..");
export const BENCHMARK_MEMORY_ROOT = join(SOS_ROOT, "07_LOGS/saios/benchmark/memory");
const MEMORY_PATH = join(BENCHMARK_MEMORY_ROOT, "benchmark-learning.json");

export type BenchmarkMemoryEntry = {
  recorded_at: string;
  source: "approval" | "revision" | "qa" | "research" | "discovery" | "learning_engine";
  note: string;
  principle_ids: string[];
  score_delta: number;
};

export type BenchmarkMemoryStore = {
  version: string;
  updated_at: string;
  entries: BenchmarkMemoryEntry[];
  aggregate: {
    discoveries: number;
    qa_improvements: number;
    founder_approvals: number;
    avg_score_delta: number;
  };
};

export function loadBenchmarkMemory(): BenchmarkMemoryStore {
  if (!existsSync(MEMORY_PATH)) return createDefaultMemory();
  try {
    return JSON.parse(readFileSync(MEMORY_PATH, "utf8")) as BenchmarkMemoryStore;
  } catch {
    return createDefaultMemory();
  }
}

function createDefaultMemory(): BenchmarkMemoryStore {
  return {
    version: "1.0.0",
    updated_at: new Date().toISOString(),
    entries: [],
    aggregate: { discoveries: 0, qa_improvements: 0, founder_approvals: 0, avg_score_delta: 0 },
  };
}

export function appendBenchmarkMemory(entry: BenchmarkMemoryEntry, persist = true): BenchmarkMemoryStore {
  const store = loadBenchmarkMemory();
  store.entries.push(entry);
  store.updated_at = new Date().toISOString();
  if (entry.source === "discovery") store.aggregate.discoveries += 1;
  if (entry.source === "qa") store.aggregate.qa_improvements += 1;
  if (entry.source === "approval") store.aggregate.founder_approvals += 1;
  const deltas = store.entries.map((e) => e.score_delta);
  store.aggregate.avg_score_delta =
    deltas.length > 0 ? Math.round(deltas.reduce((a, b) => a + b, 0) / deltas.length) : 0;

  if (persist) {
    mkdirSync(BENCHMARK_MEMORY_ROOT, { recursive: true });
    writeFileSync(MEMORY_PATH, JSON.stringify(store, null, 2));
  }
  return store;
}
