/**
 * Competitive validation memory — append-only learning.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const SOS_ROOT = resolve(import.meta.dirname, "../../..");
export const COMPETITIVE_OUTPUT_ROOT = join(SOS_ROOT, "07_LOGS/saios/competitive-validation");
export const COMPETITIVE_MEMORY_PATH = join(COMPETITIVE_OUTPUT_ROOT, "memory", "competitive-learning.json");

export type CompetitiveMemoryEntry = {
  recorded_at: string;
  template_name: string;
  template_path: string;
  overall_competitive_score: number;
  likely_user_choice: "YES" | "MAYBE" | "NO";
  strengths: string[];
  weaknesses: string[];
  recommended_improvements: string[];
  founder_status: "AWAITING_FOUNDER_APPROVAL";
};

export function loadCompetitiveMemory(): { entries: CompetitiveMemoryEntry[] } {
  if (!existsSync(COMPETITIVE_MEMORY_PATH)) {
    return { entries: [] };
  }
  try {
    return JSON.parse(readFileSync(COMPETITIVE_MEMORY_PATH, "utf8")) as {
      entries: CompetitiveMemoryEntry[];
    };
  } catch {
    return { entries: [] };
  }
}

export function appendCompetitiveMemory(entry: CompetitiveMemoryEntry, persist = true): void {
  if (!persist) return;
  const current = loadCompetitiveMemory();
  current.entries.push(entry);
  mkdirSync(join(COMPETITIVE_OUTPUT_ROOT, "memory"), { recursive: true });
  writeFileSync(COMPETITIVE_MEMORY_PATH, JSON.stringify(current, null, 2));
}
