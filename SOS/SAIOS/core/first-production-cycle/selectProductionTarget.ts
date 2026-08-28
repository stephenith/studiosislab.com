/**
 * Deterministic production-target selector — Agent #205 / Phase 5F.
 * Strategy preferences + expanded coverage taxonomy. No DEFAULT fallback when
 * exhausted. Does NOT import or activate legacy scheduler engines.
 */
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import {
  DEFAULT_PRODUCTION_TARGET,
  type CategoryCoverage,
  type ProductionCategory,
  type ProductionGoalSeed,
  type ProductionSeniority,
  type ProductionTarget,
} from "./ProductionTarget.js";
import { summarizeFounderReviewProjection } from "../founder-review/FounderReviewProjection.js";
import {
  evaluateDuplicate,
  fingerprintProductionTarget,
  targetClusterKey,
  type BatchLocalDuplicateState,
} from "./DuplicateDetector.js";
import {
  attachStrategyMetadata,
  loadProductionStrategyFile,
  persistStrategyIntakeReport,
  type LoadedStrategyRecommendation,
  type StrategyIntakeReport,
} from "./StrategyIntake.js";
import {
  PRIMARY_TITLE_BY_CATEGORY,
  PRODUCTION_ROLE_TAXONOMY,
  buildTargetFromRoleEntry,
  type RoleTaxonomyEntry,
} from "./ProductionRoleTaxonomy.js";
import {
  listCandidateManifests,
  type CandidateRegistryKind,
} from "./CandidateStore.js";

const SOS_ROOT = resolve(import.meta.dirname, "../../..");
const REPO = resolve(import.meta.dirname, "../../../..");
const PUBLICATION_CATALOG = join(SOS_ROOT, "07_LOGS/saios/publication/catalog.json");
const PUBLICATION_PACKAGES = join(SOS_ROOT, "07_LOGS/saios/publication/packages");
const CYCLE_LOG = join(SOS_ROOT, "07_LOGS/saios/first-production-cycle");
const CYCLE_HISTORY = join(CYCLE_LOG, "production-target.json");
export const TARGET_SELECTION_CURSOR_PATH = join(
  CYCLE_LOG,
  "target-selection-cursor.json",
);

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
      "Student {category} resume optimized for early-career hiring",
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

/** @deprecated use PRIMARY_TITLE_BY_CATEGORY — kept as alias for callers. */
export const TITLE_BY_CATEGORY = PRIMARY_TITLE_BY_CATEGORY;

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

export type TargetSelectionTelemetry = {
  eligible_targets_scanned: number;
  eligible_targets_remaining: number;
  duplicate_cluster_skips: number;
  strategy_targets_scanned: number;
  coverage_targets_scanned: number;
  exhaustion_reason: string | null;
  selected_source: "strategy" | "coverage" | null;
  selected_cluster: string | null;
};

export type SelectProductionTargetResult = {
  target: ProductionTarget | null;
  exhausted: boolean;
  telemetry: TargetSelectionTelemetry;
};

export type TargetSelectionCursor = {
  schema_version: 1;
  /** Index into stable PRODUCTION_ROLE_TAXONOMY order. */
  taxonomy_index: number;
  updated_at: string;
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
  const waiting = summarizeFounderReviewProjection(REPO).waiting_by_category;
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

export function readTargetSelectionCursor(
  cursorPath: string = TARGET_SELECTION_CURSOR_PATH,
): TargetSelectionCursor {
  if (!existsSync(cursorPath)) {
    return {
      schema_version: 1,
      taxonomy_index: 0,
      updated_at: new Date(0).toISOString(),
    };
  }
  try {
    const raw = JSON.parse(readFileSync(cursorPath, "utf8")) as TargetSelectionCursor;
    if (
      raw?.schema_version === 1 &&
      typeof raw.taxonomy_index === "number" &&
      Number.isFinite(raw.taxonomy_index)
    ) {
      return raw;
    }
  } catch {
    /* fall through */
  }
  return {
    schema_version: 1,
    taxonomy_index: 0,
    updated_at: new Date(0).toISOString(),
  };
}

export function writeTargetSelectionCursor(
  cursor: TargetSelectionCursor,
  cursorPath: string = TARGET_SELECTION_CURSOR_PATH,
): void {
  mkdirSync(dirname(cursorPath), { recursive: true });
  const tmp = `${cursorPath}.${process.pid}.${Date.now()}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(cursor, null, 2)}\n`, "utf8");
  renameSync(tmp, cursorPath);
}

/**
 * Waiting projection + reserving manifests → reserved title clusters
 * (category|title), NOT whole categories.
 */
export function collectReservedTargetClusters(opts?: {
  repoRoot?: string;
  cycleLog?: string;
  registry_kind?: CandidateRegistryKind;
  manifests?: ReturnType<typeof listCandidateManifests>;
}): Set<string> {
  const repoRoot = opts?.repoRoot ?? REPO;
  const cycleLog = opts?.cycleLog ?? CYCLE_LOG;
  const reserved = new Set<string>();

  const projection = summarizeFounderReviewProjection(repoRoot);
  for (const item of projection.items) {
    if (item.status !== "waiting_founder") continue;
    const title = item.production_target?.title;
    const category = item.production_target?.category;
    if (typeof title === "string" && typeof category === "string") {
      reserved.add(targetClusterKey({ category, title }));
    }
  }

  const manifests =
    opts?.manifests ??
    listCandidateManifests(cycleLog, opts?.registry_kind ?? "production");
  for (const m of manifests) {
    if (
      m.status !== "RUNNING" &&
      m.status !== "WAITING_FOUNDER" &&
      m.status !== "CRITIC_BLOCKED" &&
      m.status !== "APPROVED" &&
      m.status !== "COMPLETED"
    ) {
      continue;
    }
    if (m.target?.category && m.target?.title) {
      reserved.add(
        targetClusterKey({
          category: m.target.category,
          title: m.target.title,
        }),
      );
    }
  }
  return reserved;
}

type RankedCandidate = {
  target: ProductionTarget;
  source: "strategy" | "coverage";
  /** Lower = preferred. Strategy priorities first, then taxonomy rotation. */
  sort_key: number;
  taxonomy_index: number | null;
  strategy_priority: number | null;
};

function emptyTelemetry(): TargetSelectionTelemetry {
  return {
    eligible_targets_scanned: 0,
    eligible_targets_remaining: 0,
    duplicate_cluster_skips: 0,
    strategy_targets_scanned: 0,
    coverage_targets_scanned: 0,
    exhaustion_reason: null,
    selected_source: null,
    selected_cluster: null,
  };
}

/**
 * Enumerate strategy + coverage taxonomy, filter duplicates/clusters, pick next
 * by deterministic rotation. Returns null when genuinely exhausted.
 */
export function selectEligibleProductionTarget(opts?: {
  excludeFingerprints?: Set<string> | string[];
  batchLocal?: BatchLocalDuplicateState | null;
  disable_strategy?: boolean;
  strategyPath?: string;
  commitCursor?: boolean;
  cursorPath?: string;
  repoRoot?: string;
  cycleLog?: string;
  registry_kind?: CandidateRegistryKind;
  manifests?: ReturnType<typeof listCandidateManifests>;
  /** Injected taxonomy (tests). */
  taxonomy?: RoleTaxonomyEntry[];
  persist_intake_report?: boolean;
}): SelectProductionTargetResult {
  const telemetry = emptyTelemetry();
  const exclude = new Set(
    opts?.excludeFingerprints ? [...opts.excludeFingerprints] : [],
  );
  const taxonomy = opts?.taxonomy ?? PRODUCTION_ROLE_TAXONOMY;
  const cursorPath = opts?.cursorPath ?? TARGET_SELECTION_CURSOR_PATH;
  const cursor = readTargetSelectionCursor(cursorPath);
  const reservedClusters = collectReservedTargetClusters({
    repoRoot: opts?.repoRoot,
    cycleLog: opts?.cycleLog,
    registry_kind: opts?.registry_kind,
    manifests: opts?.manifests,
  });

  const ranked: RankedCandidate[] = [];
  let duplicate_cluster_skips = 0;

  // Strategy recommendations (preference / ranking — not a blocking finite pool)
  if (!opts?.disable_strategy) {
    const loaded = loadProductionStrategyFile(opts?.strategyPath);
    if (loaded.ok) {
      const recs = [...loaded.strategy.recommendations].sort(
        (a, b) => a.priority - b.priority || a.goal_id.localeCompare(b.goal_id),
      );
      for (const rec of recs) {
        if (!rec.target) continue;
        telemetry.strategy_targets_scanned += 1;
        const target = attachStrategyMetadata(
          rec.target,
          rec,
          loaded.strategy.strategy_version,
        );
        ranked.push({
          target,
          source: "strategy",
          sort_key: rec.priority,
          taxonomy_index: null,
          strategy_priority: rec.priority,
        });
      }
      if (opts?.persist_intake_report !== false) {
        const report: StrategyIntakeReport = {
          generated_at: new Date().toISOString(),
          strategy_consumed: false,
          strategy_path: loaded.path,
          strategy_version: loaded.strategy.strategy_version,
          strategy_generated_at: loaded.strategy.generated_at,
          recommendations_total: loaded.strategy.recommendations.length,
          recommendations_used: 0,
          recommendations_skipped: 0,
          skip_reasons: [],
          fallback_used: true,
          fallback_reason: "pending_eligible_scan",
          selected_goal_id: null,
          selected_category: null,
          publication_allowed: false,
          openai_called: false,
        };
        persistStrategyIntakeReport(report);
      }
    }
  }

  // Coverage taxonomy (full scan)
  const nTax = taxonomy.length;
  const start = ((cursor.taxonomy_index % Math.max(1, nTax)) + nTax) % Math.max(1, nTax);
  for (let offset = 0; offset < nTax; offset++) {
    const idx = (start + offset) % nTax;
    const role = taxonomy[idx]!;
    telemetry.coverage_targets_scanned += 1;
    ranked.push({
      target: buildTargetFromRoleEntry(role),
      source: "coverage",
      // After all strategy priorities (strategy uses small ints); rotate by offset
      sort_key: 10_000 + offset,
      taxonomy_index: idx,
      strategy_priority: null,
    });
  }

  const eligible: RankedCandidate[] = [];
  for (const cand of ranked) {
    const fp = fingerprintProductionTarget(cand.target);
    const cluster = targetClusterKey(cand.target);
    if (exclude.has(fp)) {
      duplicate_cluster_skips += 1;
      continue;
    }
    if (opts?.batchLocal?.excluded_clusters?.has(cluster)) {
      duplicate_cluster_skips += 1;
      continue;
    }
    if (reservedClusters.has(cluster)) {
      duplicate_cluster_skips += 1;
      continue;
    }
    const dup = evaluateDuplicate({
      target: cand.target,
      cycleLog: opts?.cycleLog ?? CYCLE_LOG,
      batchLocal: opts?.batchLocal ?? null,
      manifests: opts?.manifests,
      registry_kind: opts?.registry_kind,
    });
    if (dup.decision === "SKIP_DUPLICATE") {
      duplicate_cluster_skips += 1;
      continue;
    }
    eligible.push(cand);
  }

  telemetry.duplicate_cluster_skips = duplicate_cluster_skips;
  telemetry.eligible_targets_scanned = ranked.length;
  telemetry.eligible_targets_remaining = eligible.length;

  eligible.sort((a, b) => {
    if (a.sort_key !== b.sort_key) return a.sort_key - b.sort_key;
    return fingerprintProductionTarget(a.target).localeCompare(
      fingerprintProductionTarget(b.target),
    );
  });

  const chosen = eligible[0] ?? null;
  if (!chosen) {
    telemetry.exhaustion_reason =
      "no_eligible_targets_after_full_strategy_and_coverage_scan";
    if (opts?.persist_intake_report !== false) {
      try {
        const path = join(CYCLE_LOG, "strategy-intake-report.json");
        if (existsSync(path)) {
          const prior = JSON.parse(
            readFileSync(path, "utf8"),
          ) as StrategyIntakeReport;
          prior.fallback_used = true;
          prior.fallback_reason = telemetry.exhaustion_reason;
          prior.strategy_consumed = false;
          persistStrategyIntakeReport(prior);
        }
      } catch {
        /* non-fatal */
      }
    }
    return { target: null, exhausted: true, telemetry };
  }

  telemetry.selected_source = chosen.source;
  telemetry.selected_cluster = targetClusterKey(chosen.target);
  telemetry.exhaustion_reason = null;

  if (opts?.commitCursor) {
    const nextIndex =
      chosen.taxonomy_index != null
        ? (chosen.taxonomy_index + 1) % Math.max(1, nTax)
        : (start + 1) % Math.max(1, nTax);
    writeTargetSelectionCursor(
      {
        schema_version: 1,
        taxonomy_index: nextIndex,
        updated_at: new Date().toISOString(),
      },
      cursorPath,
    );
  }

  if (opts?.persist_intake_report !== false && chosen.source === "strategy") {
    const report: StrategyIntakeReport = {
      generated_at: new Date().toISOString(),
      strategy_consumed: true,
      strategy_path: opts?.strategyPath ?? null,
      strategy_version: chosen.target.strategy_version ?? null,
      strategy_generated_at: null,
      recommendations_total: telemetry.strategy_targets_scanned,
      recommendations_used: 1,
      recommendations_skipped: 0,
      skip_reasons: [],
      fallback_used: false,
      fallback_reason: null,
      selected_goal_id: chosen.target.goal_id ?? null,
      selected_category: chosen.target.category,
      publication_allowed: false,
      openai_called: false,
    };
    persistStrategyIntakeReport(report);
  } else if (opts?.persist_intake_report !== false) {
    try {
      const path = join(CYCLE_LOG, "strategy-intake-report.json");
      if (existsSync(path)) {
        const prior = JSON.parse(
          readFileSync(path, "utf8"),
        ) as StrategyIntakeReport;
        prior.fallback_used = true;
        prior.fallback_reason = "coverage_taxonomy_selected";
        prior.selected_category = chosen.target.category;
        prior.strategy_consumed = false;
        persistStrategyIntakeReport(prior);
      }
    } catch {
      /* non-fatal */
    }
  }

  return { target: chosen.target, exhausted: false, telemetry };
}

/**
 * Coverage-based deterministic intake (Agent #205).
 * Phase 5F: returns null when exhausted (no DEFAULT synthesis).
 */
export function selectNextProductionTargetFromCoverage(
  goals: ProductionGoalSeed[] = INTAKE_GOAL_SEEDS,
  opts?: {
    excludeFingerprints?: Set<string> | string[];
    batchLocal?: BatchLocalDuplicateState | null;
    commitCursor?: boolean;
    cursorPath?: string;
    manifests?: ReturnType<typeof listCandidateManifests>;
    taxonomy?: RoleTaxonomyEntry[];
  },
): ProductionTarget | null {
  void goals;
  const result = selectEligibleProductionTarget({
    ...opts,
    disable_strategy: true,
    persist_intake_report: false,
  });
  return result.target;
}

/**
 * Select next production target.
 * Prefers strategy recommendations when eligible; otherwise coverage taxonomy.
 * Returns null when no genuine eligible target remains (Phase 5F).
 */
export function selectNextProductionTarget(
  goals: ProductionGoalSeed[] = INTAKE_GOAL_SEEDS,
  opts?: {
    excludeFingerprints?: Set<string> | string[];
    batchLocal?: BatchLocalDuplicateState | null;
    disable_strategy?: boolean;
    strategyPath?: string;
    persist_intake_report?: boolean;
    respectWaitingFounder?: boolean;
    commitCursor?: boolean;
    cursorPath?: string;
    manifests?: ReturnType<typeof listCandidateManifests>;
    taxonomy?: RoleTaxonomyEntry[];
    registry_kind?: CandidateRegistryKind;
  },
): ProductionTarget | null {
  void goals;
  void opts?.respectWaitingFounder; // title-cluster reservation replaces category gate
  const result = selectEligibleProductionTarget({
    excludeFingerprints: opts?.excludeFingerprints,
    batchLocal: opts?.batchLocal,
    disable_strategy: opts?.disable_strategy,
    strategyPath: opts?.strategyPath,
    persist_intake_report: opts?.persist_intake_report,
    commitCursor: opts?.commitCursor,
    cursorPath: opts?.cursorPath,
    manifests: opts?.manifests,
    taxonomy: opts?.taxonomy,
    registry_kind: opts?.registry_kind,
  });
  return result.target;
}

export function buildTargetFromGoal(goal: ProductionGoalSeed): ProductionTarget {
  const category = goal.category;
  const industry = categoryToIndustry(category);
  const title = PRIMARY_TITLE_BY_CATEGORY[category];
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
  select_target?: boolean;
  excludeFingerprints?: Set<string> | string[];
  disable_strategy?: boolean;
  strategyPath?: string;
}): ProductionTarget {
  if (opts?.target) return opts.target;
  if (opts?.select_target) {
    const selected = selectNextProductionTarget(undefined, {
      excludeFingerprints: opts.excludeFingerprints,
      disable_strategy: opts.disable_strategy,
      strategyPath: opts.strategyPath,
    });
    if (selected) return selected;
  }
  // Explicit caller path when selection not requested — keep DEFAULT for
  // backward-compat dry-run cycles (duplicate_preflight often disabled).
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

// Silence unused type import in some TS builds
export type { LoadedStrategyRecommendation };
