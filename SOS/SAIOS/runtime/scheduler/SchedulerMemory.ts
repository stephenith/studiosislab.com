/**
 * Scheduler memory — append-only production learning.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { SCHEDULER_ROOT } from "./SchedulerConfig.js";
import type { ProductionCategory } from "./types.js";

const MEMORY_PATH = join(SCHEDULER_ROOT, "scheduler-learning.json");
const JOB_HISTORY_PATH = join(SCHEDULER_ROOT, "job-history.json");

export type SchedulerMemoryEntry = {
  recorded_at: string;
  category: ProductionCategory;
  job_id: string;
  unified_run_id: string | null;
  status: string;
  duration_ms: number;
  production_speed_trend: string;
  failure_rate_note: string;
};

export type JobHistoryEntry = {
  recorded_at: string;
  job_id: string;
  goal_id: string;
  category: ProductionCategory;
  unified_run_id: string | null;
  status: string;
  awaiting_founder: boolean;
};

export type SchedulerMemoryStore = {
  version: string;
  updated_at: string;
  entries: SchedulerMemoryEntry[];
};

export type JobHistoryStore = {
  version: string;
  updated_at: string;
  entries: JobHistoryEntry[];
};

export function loadSchedulerMemory(): SchedulerMemoryStore {
  if (!existsSync(MEMORY_PATH)) {
    return { version: "1.0.0", updated_at: new Date().toISOString(), entries: [] };
  }
  try {
    return JSON.parse(readFileSync(MEMORY_PATH, "utf8")) as SchedulerMemoryStore;
  } catch {
    return { version: "1.0.0", updated_at: new Date().toISOString(), entries: [] };
  }
}

export function appendSchedulerMemory(entry: SchedulerMemoryEntry, persist = true): void {
  const store = loadSchedulerMemory();
  store.entries.push(entry);
  store.updated_at = new Date().toISOString();
  if (persist) {
    mkdirSync(SCHEDULER_ROOT, { recursive: true });
    writeFileSync(MEMORY_PATH, JSON.stringify(store, null, 2));
  }
}

export function loadJobHistory(): JobHistoryStore {
  if (!existsSync(JOB_HISTORY_PATH)) {
    return { version: "1.0.0", updated_at: new Date().toISOString(), entries: [] };
  }
  try {
    return JSON.parse(readFileSync(JOB_HISTORY_PATH, "utf8")) as JobHistoryStore;
  } catch {
    return { version: "1.0.0", updated_at: new Date().toISOString(), entries: [] };
  }
}

export function appendJobHistory(entry: JobHistoryEntry, persist = true): void {
  const store = loadJobHistory();
  store.entries.push(entry);
  store.updated_at = new Date().toISOString();
  if (persist) {
    mkdirSync(SCHEDULER_ROOT, { recursive: true });
    writeFileSync(JOB_HISTORY_PATH, JSON.stringify(store, null, 2));
  }
}
