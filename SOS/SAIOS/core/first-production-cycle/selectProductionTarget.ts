/**
 * Deterministic production-target selector — Agent #205.
 * Donor logic lifted from SmartProduction / SchedulerConfig / categoryToIndustry.
 * Does NOT import or activate legacy scheduler engines.
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  DEFAULT_PRODUCTION_TARGET,
  type CategoryCoverage,
  type ProductionCategory,
  type ProductionGoalSeed,
  type ProductionSeniority,
  type ProductionTarget,
} from "./ProductionTarget.js";
import { countFounderReviewWaitingByCategory } from "../founder-review/FounderReviewProjection.js";
import { fingerprintProductionTarget } from "./DuplicateDetector.js";
import {
  consumeStrategyRecommendation,
  persistStrategyIntakeReport,
  type StrategyIntakeReport,
} from "./StrategyIntake.js";

const SOS_ROOT = resolve(import.meta.dirname, "../../..");
const REPO = resolve(import.meta.dirname, "../../../..");
const PUBLICATION_CATALOG = join(SOS_ROOT, "07_LOGS/saios/publication/catalog.json");
const PUBLICATION_PACKAGES = join(SOS_ROOT, "07_LOGS/saios/publication/packages");
const CYCLE_LOG = join(SOS_ROOT, "07_LOGS/saios/first-production-cycle");
const CYCLE_HISTORY = join(CYCLE_LOG, "production-target.json");

/** Donor: SchedulerConfig.DEFAULT_GOALS (templates only). */
export const INTAKE_GOAL_SEEDS: ProductionGoalSeed[] = [
  {
    id: "daily-ats",
    category: "ats",
    enabled: true,
    priority: "P1",
    objective_template:
      "Premium ATS-optimized {category} resume for {industry} professional",
  },
  {
    id: "daily-executive",
    category: "executive",
    enabled: true,
    priority: "P1",
    objective_template:
      "Executive {category} resume with premium hierarchy for senior leader",
  },
  {
    id: "daily-creative",
    category: "creative",
    enabled: true,
    priority: "P2",
    objective_template:
      "Creative {category} resume with modern visual hierarchy",
  },
  {
    id: "daily-student",
    category: "student",
    enabled: true,
    priority: "P2",
    objective_template:
      "Student {category} resume optimized for entry-level hiring",
  },
  {
    id: "daily-healthcare",
    category: "healthcare",
    enabled: true,
    priority: "P2",
    objective_template:
      "Healthcare {category} resume with ATS compliance",
  },
  {
    id: "daily-marketing",
    category: "marketing",
    enabled: true,
    priority: "P2",
    objective_template:
      "Marketing {category} resume with campaign metrics focus",
  },
  {
    id: "daily-finance",
    category: "finance",
    enabled: true,
    priority: "P2",
    objective_template:
      "Finance {category} resume with conservative premium layout",
  },
  {
    id: "daily-engineering",
    category: "engineering",
    enabled: true,
    priority: "P1",
    objective_template:
      "Engineering {category} resume with technical project emphasis",
  },
  {
    id: "daily-refresh",
    category: "resume_refresh",
    enabled: true,
    priority: "P3",
    objective_template:
      "Refresh premium {category} resume with updated composition blocks",
  },
  {
    id: "daily-seo",
    category: "seo_expansion",
    enabled: true,
    priority: "P3",
    objective_template:
      "SEO-optimized {category} resume landing metadata expansion",
  },
];

const TITLE_BY_CATEGORY: Record<ProductionCategory, string> = {
  ats: "Operations Analyst",
  executive: "Chief Operating Officer",
  creative: "Creative Director",
  student: "Recent Graduate",
  healthcare: "Clinical Nurse Manager",
  marketing: "Marketing Manager",
  finance: "Financial Analyst",
  engineering: "Software Engineer",
  resume_refresh: "Product Manager",
  seo_expansion: "SEO Specialist",
};

const SENIORITY_BY_CATEGORY: Record<ProductionCategory, ProductionSeniority> = {
  ats: "mid",
  executive: "executive",
  creative: "senior",
  student: "student",
  healthcare: "senior",
  marketing: "mid",
  finance: "mid",
  engineering: "mid",
  resume_refresh: "mid",
  seo_expansion: "mid",
};

/** Donor: ProductionExecutor.categoryToIndustry */
export function categoryToIndustry(category: ProductionCategory): string {
  const map: Partial<Record<ProductionCategory, string>> = {
    ats: "software",
    executive: "executive",
    creative: "creative",
    student: "student",
    healthcare: "healthcare",
    marketing: "marketing",
    finance: "finance",
    engineering: "engineering",
    resume_refresh: "software",
    seo_expansion: "marketing",
  };
  return map[category] ?? "software";
}

/** Donor: SchedulerConfig.buildObjective */
export function buildObjective(
  template: string,
  category: ProductionCategory,
  industry: string,
): string {
  return template
    .replace(/\{category\}/g, category)
    .replace(/\{industry\}/g, industry);
}

export function titleToRoleFamily(title: string): string {
  return title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

/**
 * Coverage analysis — donor algorithm from SmartProduction.analyzeCategoryCoverage.
 * Reads catalog/drafts/waiting artifacts only; no scheduler activation.
 */
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
  const waiting = countFounderReviewWaitingByCategory(REPO);
  const recentCycleCategory = readRecentCycleCategory();

  return categories.map((category) => {
    const catalog_count = catalog.filter((c) => c.includes(category)).length;
    const draft_count = drafts[category] ?? 0;
    const waiting_founder = waiting[category] ?? 0;
    const recent_jobs = recentCycleCategory === category ? 1 : 0;

    const saturation_score = Math.min(
      1,
      (catalog_count * 0.1 +
        draft_count * 0.2 +
        waiting_founder * 0.35 +
        recent_jobs * 0.35) /
        3,
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

/**
 * Coverage-based deterministic intake (Agent #205).
 * Used as safe fallback when strategy is missing/invalid/empty/exhausted.
 */
export function selectNextProductionTargetFromCoverage(
  goals: ProductionGoalSeed[] = INTAKE_GOAL_SEEDS,
  opts?: {
    excludeFingerprints?: Set<string> | string[];
  },
): ProductionTarget {
  const coverage = analyzeCategoryCoverage();
  const coverageMap = Object.fromEntries(
    coverage.map((c) => [c.category, c]),
  ) as Record<ProductionCategory, CategoryCoverage>;

  const exclude = new Set(
    opts?.excludeFingerprints
      ? [...opts.excludeFingerprints]
      : [],
  );

  const ranked = goals
    .filter((g) => g.enabled)
    .filter((g) => {
      const cov = coverageMap[g.category];
      // Canonical WAITING_FOUNDER candidates reserve their category.
      if ((cov?.waiting_founder ?? 0) > 0) return false;
      const sat = cov?.saturation_score ?? 0;
      if (sat > 0.85) return false;
      if (exclude.size > 0) {
        const t = buildTargetFromGoal(g);
        if (exclude.has(fingerprintProductionTarget(t))) return false;
      }
      return true;
    })
    .sort((a, b) => {
      const boostA = coverageMap[a.category]?.priority_boost ?? 0;
      const boostB = coverageMap[b.category]?.priority_boost ?? 0;
      if (boostB !== boostA) return boostB - boostA;
      const prio = { P0: 0, P1: 1, P2: 2, P3: 3 };
      return prio[a.priority] - prio[b.priority];
    });

  const chosen =
    ranked[0] ??
    goals.find((g) => {
      if (!g.enabled) return false;
      if ((coverageMap[g.category]?.waiting_founder ?? 0) > 0) return false;
      if (exclude.size > 0) {
        const t = buildTargetFromGoal(g);
        if (exclude.has(fingerprintProductionTarget(t))) return false;
      }
      return true;
    }) ??
    null;
  if (!chosen) {
    return { ...DEFAULT_PRODUCTION_TARGET };
  }
  return buildTargetFromGoal(chosen);
}

/**
 * Select next production target.
 * Prefers Production Strategy Engine recommendations (#217);
 * falls back to coverage-based intake (#205) when strategy unavailable.
 */
export function selectNextProductionTarget(
  goals: ProductionGoalSeed[] = INTAKE_GOAL_SEEDS,
  opts?: {
    /** Fingerprints already accepted/skipped this batch (Agent #210). */
    excludeFingerprints?: Set<string> | string[];
    /** Skip strategy consumption (tests / explicit coverage path). */
    disable_strategy?: boolean;
    strategyPath?: string;
    persist_intake_report?: boolean;
    respectWaitingFounder?: boolean;
  },
): ProductionTarget {
  const persist = opts?.persist_intake_report !== false;

  if (!opts?.disable_strategy) {
    const consumed = consumeStrategyRecommendation({
      strategyPath: opts?.strategyPath,
      excludeFingerprints: opts?.excludeFingerprints,
      respectWaitingFounder: opts?.respectWaitingFounder,
      persist,
    });
    if (consumed) {
      return consumed.target;
    }
    // Fallback report already written by consumeStrategyRecommendation (missing/
    // invalid/empty/all-skipped). Annotate selected category from coverage path.
    const target = selectNextProductionTargetFromCoverage(goals, {
      excludeFingerprints: opts?.excludeFingerprints,
    });
    if (persist) {
      annotateFallbackSelection(target);
    }
    return target;
  }

  const target = selectNextProductionTargetFromCoverage(goals, {
    excludeFingerprints: opts?.excludeFingerprints,
  });
  if (persist) {
    persistStrategyIntakeReport({
      generated_at: new Date().toISOString(),
      strategy_consumed: false,
      strategy_path: opts?.strategyPath ?? null,
      strategy_version: null,
      strategy_generated_at: null,
      recommendations_total: 0,
      recommendations_used: 0,
      recommendations_skipped: 0,
      skip_reasons: [],
      fallback_used: true,
      fallback_reason: "strategy_disabled",
      selected_goal_id: null,
      selected_category: target.category,
      publication_allowed: false,
      openai_called: false,
    });
  }
  return target;
}

function annotateFallbackSelection(target: ProductionTarget): void {
  try {
    const path = join(CYCLE_LOG, "strategy-intake-report.json");
    if (!existsSync(path)) return;
    const prior = JSON.parse(
      readFileSync(path, "utf8"),
    ) as StrategyIntakeReport;
    prior.selected_category = target.category;
    prior.fallback_used = true;
    persistStrategyIntakeReport(prior);
  } catch {
    /* non-fatal */
  }
}

export function buildTargetFromGoal(goal: ProductionGoalSeed): ProductionTarget {
  const category = goal.category;
  const industry = categoryToIndustry(category);
  const title = TITLE_BY_CATEGORY[category];
  const seniority = SENIORITY_BY_CATEGORY[category];
  const objective = buildObjective(goal.objective_template, category, industry);
  return {
    category,
    title,
    industry,
    seniority,
    objective,
    role_family: titleToRoleFamily(title),
  };
}

export function resolveProductionTarget(opts?: {
  target?: ProductionTarget;
  /** When true and target omitted, run strategy-then-coverage selection. */
  select_target?: boolean;
  excludeFingerprints?: Set<string> | string[];
  disable_strategy?: boolean;
  strategyPath?: string;
}): ProductionTarget {
  if (opts?.target) return opts.target;
  if (opts?.select_target) {
    return selectNextProductionTarget(undefined, {
      excludeFingerprints: opts.excludeFingerprints,
      disable_strategy: opts.disable_strategy,
      strategyPath: opts.strategyPath,
    });
  }
  return { ...DEFAULT_PRODUCTION_TARGET };
}

export function stableIdsForTarget(target: ProductionTarget): {
  task_id: string;
  cycle_id: string;
  candidate_id: string;
  candidate_title: string;
  review_id: string;
} {
  if (
    target.category === DEFAULT_PRODUCTION_TARGET.category &&
    target.title === DEFAULT_PRODUCTION_TARGET.title &&
    target.objective === DEFAULT_PRODUCTION_TARGET.objective
  ) {
    return {
      task_id: "cycle-ats-marketing-manager-001",
      cycle_id: "cycle-resume-dept-001",
      candidate_id: "cand-ats-mm-001",
      candidate_title: "ATS Marketing Manager Resume",
      review_id: "founder-review-cycle-ats-marketing-manager-001",
    };
  }
  const slug = `${target.category}-${titleToRoleFamily(target.title)}`
    .replace(/_+/g, "-")
    .slice(0, 48);
  const task_id = `cycle-${slug}-001`;
  return {
    task_id,
    cycle_id: "cycle-resume-dept-001",
    candidate_id: `cand-${slug}`,
    candidate_title: `${target.title} Resume`,
    review_id: `founder-review-${task_id}`,
  };
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
      const data = JSON.parse(readFileSync(meta, "utf8")) as {
        category?: string;
        tags?: string[];
      };
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

function readRecentCycleCategory(): ProductionCategory | null {
  if (!existsSync(CYCLE_HISTORY)) return null;
  try {
    const data = JSON.parse(readFileSync(CYCLE_HISTORY, "utf8")) as {
      category?: string;
    };
    const cat = data.category;
    if (
      cat === "ats" ||
      cat === "executive" ||
      cat === "creative" ||
      cat === "student" ||
      cat === "healthcare" ||
      cat === "marketing" ||
      cat === "finance" ||
      cat === "engineering" ||
      cat === "resume_refresh" ||
      cat === "seo_expansion"
    ) {
      return cat;
    }
  } catch {
    /* ignore */
  }
  return null;
}
