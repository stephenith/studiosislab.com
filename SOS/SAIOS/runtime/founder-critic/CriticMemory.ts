/**
 * Critic memory — append-only learning from founder and pipeline signals.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import type { ApprovalRecommendation, FounderPredictions } from "./types.js";

const SOS_ROOT = resolve(import.meta.dirname, "../../..");
export const CRITIC_MEMORY_ROOT = join(SOS_ROOT, "07_LOGS/saios/founder-critic/memory");
const MEMORY_PATH = join(CRITIC_MEMORY_ROOT, "critic-learning.json");

export type CriticMemoryEntry = {
  recorded_at: string;
  source: "approval" | "revision" | "rejection" | "qa" | "benchmark" | "design_brain" | "critic_run";
  prototype_id: string;
  overall_score: number;
  policy_band: string;
  note: string;
};

export type CriticMemoryStore = {
  version: string;
  updated_at: string;
  entries: CriticMemoryEntry[];
};

export function loadCriticMemory(): CriticMemoryStore {
  if (!existsSync(MEMORY_PATH)) return createDefault();
  try {
    return JSON.parse(readFileSync(MEMORY_PATH, "utf8")) as CriticMemoryStore;
  } catch {
    return createDefault();
  }
}

function createDefault(): CriticMemoryStore {
  return { version: "1.0.0", updated_at: new Date().toISOString(), entries: [] };
}

export function appendCriticMemory(
  entry: CriticMemoryEntry,
  persist = true,
): CriticMemoryStore {
  const store = loadCriticMemory();
  store.entries.push(entry);
  store.updated_at = new Date().toISOString();
  if (persist) {
    mkdirSync(CRITIC_MEMORY_ROOT, { recursive: true });
    writeFileSync(MEMORY_PATH, JSON.stringify(store, null, 2));
  }
  return store;
}

export function recordCriticRun(input: {
  prototype_id: string;
  approval: ApprovalRecommendation;
  predictions: FounderPredictions;
  persist?: boolean;
}): void {
  appendCriticMemory(
    {
      recorded_at: new Date().toISOString(),
      source: "critic_run",
      prototype_id: input.prototype_id,
      overall_score: input.approval.overall_score,
      policy_band: input.approval.policy_band,
      note: `Approval prob ${input.predictions.founder_approval_probability}% — ${input.approval.summary}`,
    },
    input.persist !== false,
  );
}
