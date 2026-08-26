/**
 * Smart production — avoid saturation, prefer low-coverage categories.
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import type { ProductionCategory, ProductionGoal } from "./types.js";
import { loadJobHistory } from "./SchedulerMemory.js";

const SOS_ROOT = resolve(import.meta.dirname, "../../..");
const PUBLICATION_CATALOG = join(SOS_ROOT, "07_LOGS/saios/publication/catalog.json");
const UNIFIED_RUNS = join(SOS_ROOT, "07_LOGS/saios/unified-production/runs");
const PUBLICATION_PACKAGES = join(SOS_ROOT, "07_LOGS/saios/publication/packages");

export type CategoryCoverage = {
  category: ProductionCategory;
  catalog_count: number;
  draft_count: number;
  waiting_founder: number;
  recent_jobs: number;
  saturation_score: number;
  priority_boost: number;
};

export function analyzeCategoryCoverage(): CategoryCoverage[] {
  const categories: ProductionCategory[] = [
    "ats",
    "executive",
    "creative",
    "student",
    "healthcare",
    "marketing",
    "finance",
    "engineering",
    "resume_refresh",
    "seo_expansion",
  ];

  const catalog = loadCatalog();
  const drafts = countPublicationDrafts();
  const waiting = countWaitingFounder();
  const history = loadJobHistory();

  return categories.map((category) => {
    const catalog_count = catalog.filter((c) => c.includes(category)).length;
    const draft_count = drafts[category] ?? 0;
    const waiting_founder = waiting[category] ?? 0;
    const recent_jobs = history.entries.filter(
      (e) => e.category === category && hoursSince(e.recorded_at) < 24,
    ).length;

    const saturation_score = Math.min(
      1,
      (catalog_count * 0.1 + draft_count * 0.2 + waiting_founder * 0.3 + recent_jobs * 0.4) / 3,
    );
    const priority_boost = Math.round((1 - saturation_score) * 100);

    return {
      category,
      catalog_count,
      draft_count,
      waiting_founder,
      recent_jobs,
      saturation_score,
      priority_boost,
    };
  });
}

export function selectGoalsForTick(goals: ProductionGoal[]): ProductionGoal[] {
  const coverage = analyzeCategoryCoverage();
  const coverageMap = Object.fromEntries(coverage.map((c) => [c.category, c]));

  return goals
    .filter((g) => g.enabled)
    .sort((a, b) => {
      const boostA = coverageMap[a.category]?.priority_boost ?? 0;
      const boostB = coverageMap[b.category]?.priority_boost ?? 0;
      if (boostB !== boostA) return boostB - boostA;
      const prio = { P0: 0, P1: 1, P2: 2, P3: 3 };
      return prio[a.priority] - prio[b.priority];
    });
}

export function shouldSkipGoal(goal: ProductionGoal): { skip: boolean; reason?: string } {
  const coverage = analyzeCategoryCoverage().find((c) => c.category === goal.category);
  if (!coverage) return { skip: false };

  if (coverage.saturation_score > 0.85) {
    return { skip: true, reason: `Category ${goal.category} saturated (${coverage.saturation_score.toFixed(2)})` };
  }

  const history = loadJobHistory();
  const duplicate = history.entries.find(
    (e) =>
      e.category === goal.category &&
      e.status === "waiting_founder" &&
      hoursSince(e.recorded_at) < 1,
  );
  if (duplicate) {
    return { skip: true, reason: `Duplicate ${goal.category} job already waiting founder` };
  }

  return { skip: false };
}

function loadCatalog(): string[] {
  if (!existsSync(PUBLICATION_CATALOG)) return [];
  try {
    const data = JSON.parse(readFileSync(PUBLICATION_CATALOG, "utf8")) as {
      entries?: Array<{ catalog_id?: string; category?: string; tags?: string[] }>;
    };
    return (data.entries ?? []).flatMap((e) => [
      e.category ?? "",
      ...(e.tags ?? []),
      e.catalog_id ?? "",
    ]);
  } catch {
    return [];
  }
}

function countPublicationDrafts(): Record<string, number> {
  const counts: Record<string, number> = {};
  if (!existsSync(PUBLICATION_PACKAGES)) return counts;
  for (const dir of readdirSync(PUBLICATION_PACKAGES)) {
    const meta = join(PUBLICATION_PACKAGES, dir, "template-metadata.json");
    if (!existsSync(meta)) continue;
    try {
      const data = JSON.parse(readFileSync(meta, "utf8")) as { category?: string; tags?: string[] };
      const cat = data.category ?? "unknown";
      counts[cat] = (counts[cat] ?? 0) + 1;
      for (const tag of data.tags ?? []) {
        counts[tag] = (counts[tag] ?? 0) + 1;
      }
    } catch {
      /* ignore */
    }
  }
  return counts;
}

function countWaitingFounder(): Record<string, number> {
  const counts: Record<string, number> = {};
  if (!existsSync(UNIFIED_RUNS)) return counts;
  for (const runId of readdirSync(UNIFIED_RUNS)) {
    const statePath = join(UNIFIED_RUNS, runId, "run.json");
    if (!existsSync(statePath)) continue;
    try {
      const state = JSON.parse(readFileSync(statePath, "utf8")) as {
        status?: string;
        objective?: string;
      };
      if (state.status !== "waiting_founder") continue;
      const obj = (state.objective ?? "").toLowerCase();
      for (const cat of ["ats", "executive", "creative", "student", "healthcare", "marketing", "finance", "engineering"]) {
        if (obj.includes(cat)) counts[cat] = (counts[cat] ?? 0) + 1;
      }
    } catch {
      /* ignore */
    }
  }
  return counts;
}

function hoursSince(iso: string): number {
  return (Date.now() - new Date(iso).getTime()) / 3_600_000;
}
