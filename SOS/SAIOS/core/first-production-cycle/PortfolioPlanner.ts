/**
 * Canonical Portfolio Intelligence & Coverage Planner — Agent #215.
 * Analyzes candidate registry only. No OpenAI. No production execution.
 */
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import {
  listCandidateManifests,
  type CandidateManifest,
} from "./CandidateStore.js";
import {
  buildTargetFromGoal,
  INTAKE_GOAL_SEEDS,
} from "./selectProductionTarget.js";
import type {
  ProductionCategory,
  ProductionSeniority,
  ProductionTarget,
} from "./ProductionTarget.js";

const REPO = resolve(import.meta.dirname, "../../../..");
const CYCLE_LOG = join(REPO, "SOS/07_LOGS/saios/first-production-cycle");
export const PORTFOLIO_LOG_ROOT = join(CYCLE_LOG, "portfolio");
export const PORTFOLIO_HISTORY_ROOT = join(PORTFOLIO_LOG_ROOT, "history");

export const CANONICAL_CATEGORIES: readonly ProductionCategory[] = [
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
] as const;

export const CANONICAL_SENIORITIES: readonly ProductionSeniority[] = [
  "entry",
  "mid",
  "senior",
  "executive",
  "student",
] as const;

export const PORTFOLIO_PLANNER_VERSION = 1 as const;

export type CountMap = Record<string, number>;

export type PortfolioRecommendation = {
  priority: number;
  reason: string;
  kind:
    | "missing_category"
    | "underrepresented_category"
    | "underrepresented_industry"
    | "underrepresented_seniority"
    | "missing_combination"
    | "overrepresented";
  recommended_target: ProductionTarget | null;
  evidence: Record<string, unknown>;
};

export type PortfolioReport = {
  schema_version: typeof PORTFOLIO_PLANNER_VERSION;
  generated_at: string;
  planner_version: typeof PORTFOLIO_PLANNER_VERSION;
  publication_allowed: false;
  live: false;
  openai_called: false;
  production_triggered: false;
  coverage_score: number;
  coverage_score_breakdown: {
    category_fill: number;
    seniority_fill: number;
    industry_diversity: number;
    status_health: number;
    formula: string;
  };
  candidate_totals: {
    total: number;
    by_status: CountMap;
    waiting_founder: number;
    critic_blocked: number;
    failed: number;
    running: number;
    approved: number;
    other: number;
  };
  category_matrix: CountMap;
  industry_matrix: CountMap;
  seniority_matrix: CountMap;
  objective_matrix: CountMap;
  status_matrix: CountMap;
  revision_outcome_matrix: CountMap;
  founder_queue: {
    waiting_founder: number;
    critic_blocked: number;
  };
  duplicate_skip_statistics: {
    available: boolean;
    batches_scanned: number;
    total_duplicate_skips: number;
    by_type: CountMap;
  };
  gaps: {
    missing_categories: string[];
    underrepresented_categories: string[];
    underrepresented_industries: string[];
    underrepresented_seniorities: string[];
    missing_combinations: Array<{ category: string; seniority: string }>;
    overrepresented_categories: string[];
  };
  recommendations: PortfolioRecommendation[];
  coverage_summary: string;
  report_path: string;
  history_path: string;
};

export type PortfolioPlannerOptions = {
  cycleLog?: string;
  /** Override manifests (verify fixtures). */
  manifests?: CandidateManifest[];
  persist?: boolean;
  now?: Date;
};

function atomicWriteJson(path: string, data: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  const tmp = `${path}.${process.pid}.${Date.now()}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  renameSync(tmp, path);
}

function bump(map: CountMap, key: string, n = 1): void {
  const k = key || "(empty)";
  map[k] = (map[k] ?? 0) + n;
}

function sortedEntries(map: CountMap): Array<[string, number]> {
  return Object.entries(map).sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1];
    return a[0].localeCompare(b[0]);
  });
}

function normalizeObjectiveKey(objective: string): string {
  return String(objective ?? "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
}

function readRevisionOutcome(candidateDir: string): string | null {
  const hist = join(candidateDir, "revision-history.json");
  if (existsSync(hist)) {
    try {
      const data = JSON.parse(readFileSync(hist, "utf8")) as {
        outcome?: string;
      };
      if (typeof data.outcome === "string") return data.outcome;
    } catch {
      /* ignore */
    }
  }
  const loop = join(candidateDir, "revision-loop.json");
  if (existsSync(loop)) {
    try {
      const data = JSON.parse(readFileSync(loop, "utf8")) as {
        outcome?: string;
      };
      if (typeof data.outcome === "string") return data.outcome;
    } catch {
      /* ignore */
    }
  }
  return null;
}

function scanDuplicateSkipStats(cycleLog: string): {
  available: boolean;
  batches_scanned: number;
  total_duplicate_skips: number;
  by_type: CountMap;
} {
  const batchesRoot = join(cycleLog, "batches");
  const by_type: CountMap = {};
  if (!existsSync(batchesRoot)) {
    return {
      available: false,
      batches_scanned: 0,
      total_duplicate_skips: 0,
      by_type,
    };
  }
  let batches_scanned = 0;
  let total = 0;
  for (const name of readdirSync(batchesRoot)) {
    const summaryPath = join(batchesRoot, name, "batch-summary.json");
    if (!existsSync(summaryPath)) continue;
    batches_scanned += 1;
    try {
      const summary = JSON.parse(readFileSync(summaryPath, "utf8")) as {
        duplicate_skip_count?: number;
        duplicate_skips?: Array<{ duplicate_type?: string | null }>;
      };
      const n = Number(summary.duplicate_skip_count ?? 0);
      if (Number.isFinite(n) && n > 0) total += n;
      for (const s of summary.duplicate_skips ?? []) {
        bump(by_type, s.duplicate_type ?? "UNKNOWN");
      }
    } catch {
      /* ignore corrupt batch summaries */
    }
  }
  return {
    available: batches_scanned > 0,
    batches_scanned,
    total_duplicate_skips: total,
    by_type,
  };
}

/**
 * Coverage score 0–100 (deterministic, no AI).
 *
 * formula:
 *   round(
 *     40 * (canonical_categories_present / 10) +
 *     25 * (canonical_seniorities_present / 5) +
 *     20 * min(1, unique_industries / 8) +
 *     15 * (1 - critic_blocked / max(total, 1))
 *   )
 *
 * Empty registry → 0.
 */
export function computeCoverageScore(input: {
  total: number;
  category_matrix: CountMap;
  seniority_matrix: CountMap;
  industry_matrix: CountMap;
  critic_blocked: number;
}): {
  score: number;
  breakdown: PortfolioReport["coverage_score_breakdown"];
} {
  if (input.total <= 0) {
    return {
      score: 0,
      breakdown: {
        category_fill: 0,
        seniority_fill: 0,
        industry_diversity: 0,
        status_health: 0,
        formula:
          "round(40*cat/10 + 25*sen/5 + 20*min(1,ind/8) + 15*(1-blocked/total)); empty=0",
      },
    };
  }
  const catsPresent = CANONICAL_CATEGORIES.filter(
    (c) => (input.category_matrix[c] ?? 0) > 0,
  ).length;
  const senPresent = CANONICAL_SENIORITIES.filter(
    (s) => (input.seniority_matrix[s] ?? 0) > 0,
  ).length;
  const uniqueIndustries = Object.keys(input.industry_matrix).filter(
    (k) => (input.industry_matrix[k] ?? 0) > 0,
  ).length;
  const category_fill = catsPresent / CANONICAL_CATEGORIES.length;
  const seniority_fill = senPresent / CANONICAL_SENIORITIES.length;
  const industry_diversity = Math.min(1, uniqueIndustries / 8);
  const status_health = 1 - input.critic_blocked / Math.max(input.total, 1);
  const score = Math.max(
    0,
    Math.min(
      100,
      Math.round(
        40 * category_fill +
          25 * seniority_fill +
          20 * industry_diversity +
          15 * status_health,
      ),
    ),
  );
  return {
    score,
    breakdown: {
      category_fill: Number(category_fill.toFixed(4)),
      seniority_fill: Number(seniority_fill.toFixed(4)),
      industry_diversity: Number(industry_diversity.toFixed(4)),
      status_health: Number(status_health.toFixed(4)),
      formula:
        "round(40*cat/10 + 25*sen/5 + 20*min(1,ind/8) + 15*(1-blocked/total)); empty=0",
    },
  };
}

function buildRecommendations(
  manifests: CandidateManifest[],
  category_matrix: CountMap,
  industry_matrix: CountMap,
  seniority_matrix: CountMap,
): { gaps: PortfolioReport["gaps"]; recommendations: PortfolioRecommendation[] } {
  const presentCats = new Set(
    manifests.map((m) => m.target.category).filter(Boolean),
  );
  const missing_categories = CANONICAL_CATEGORIES.filter(
    (c) => !presentCats.has(c),
  );

  const catCounts = CANONICAL_CATEGORIES.map(
    (c) => category_matrix[c] ?? 0,
  );
  const presentCounts = catCounts.filter((n) => n > 0);
  const median =
    presentCounts.length === 0
      ? 0
      : [...presentCounts].sort((a, b) => a - b)[
          Math.floor((presentCounts.length - 1) / 2)
        ]!;
  const underrepresented_categories = CANONICAL_CATEGORIES.filter((c) => {
    const n = category_matrix[c] ?? 0;
    return n > 0 && n < median;
  });
  const overrepresented_categories = CANONICAL_CATEGORIES.filter((c) => {
    const n = category_matrix[c] ?? 0;
    return median > 0 && n > median * 2;
  });

  const indEntries = sortedEntries(industry_matrix);
  const indMedian =
    indEntries.length === 0
      ? 0
      : indEntries.map(([, n]) => n).sort((a, b) => a - b)[
          Math.floor((indEntries.length - 1) / 2)
        ]!;
  const underrepresented_industries = indEntries
    .filter(([, n]) => n > 0 && n < indMedian)
    .map(([k]) => k);

  const presentSen = new Set(
    manifests.map((m) => m.target.seniority).filter(Boolean),
  );
  const underrepresented_seniorities = CANONICAL_SENIORITIES.filter((s) => {
    const n = seniority_matrix[s] ?? 0;
    return n === 0 || (presentSen.size > 0 && n < Math.max(1, median / 2));
  }).map(String);

  const comboSet = new Set(
    manifests.map((m) => `${m.target.category}::${m.target.seniority}`),
  );
  const missing_combinations: Array<{ category: string; seniority: string }> =
    [];
  for (const c of CANONICAL_CATEGORIES) {
    if ((category_matrix[c] ?? 0) === 0) continue;
    for (const s of CANONICAL_SENIORITIES) {
      if (!comboSet.has(`${c}::${s}`)) {
        // Only flag mid/senior gaps for categories that already exist — keep list bounded
        if (s === "mid" || s === "senior") {
          missing_combinations.push({ category: c, seniority: s });
        }
      }
    }
  }

  const recommendations: PortfolioRecommendation[] = [];
  let priority = 1;

  for (const cat of missing_categories) {
    const seed = INTAKE_GOAL_SEEDS.find((g) => g.category === cat && g.enabled);
    const recommended_target = seed ? buildTargetFromGoal(seed) : null;
    recommendations.push({
      priority: priority++,
      kind: "missing_category",
      reason: `Canonical category "${cat}" has zero candidates in the registry`,
      recommended_target,
      evidence: { category: cat, count: 0 },
    });
  }

  for (const cat of underrepresented_categories) {
    if (recommendations.some((r) => r.evidence.category === cat)) continue;
    const seed = INTAKE_GOAL_SEEDS.find((g) => g.category === cat && g.enabled);
    recommendations.push({
      priority: priority++,
      kind: "underrepresented_category",
      reason: `Category "${cat}" count ${category_matrix[cat] ?? 0} is below median ${median}`,
      recommended_target: seed ? buildTargetFromGoal(seed) : null,
      evidence: {
        category: cat,
        count: category_matrix[cat] ?? 0,
        median,
      },
    });
  }

  for (const sen of underrepresented_seniorities.slice(0, 5)) {
    const hostCat =
      missing_categories[0] ??
      underrepresented_categories[0] ??
      CANONICAL_CATEGORIES.find((c) => (category_matrix[c] ?? 0) > 0) ??
      "marketing";
    const seed = INTAKE_GOAL_SEEDS.find(
      (g) => g.category === hostCat && g.enabled,
    );
    let recommended_target = seed ? buildTargetFromGoal(seed) : null;
    if (recommended_target) {
      recommended_target = {
        ...recommended_target,
        seniority: sen as ProductionSeniority,
      };
    }
    recommendations.push({
      priority: priority++,
      kind: "underrepresented_seniority",
      reason: `Seniority "${sen}" is missing or below coverage threshold`,
      recommended_target,
      evidence: { seniority: sen, count: seniority_matrix[sen] ?? 0 },
    });
  }

  for (const combo of missing_combinations.slice(0, 5)) {
    const seed = INTAKE_GOAL_SEEDS.find(
      (g) => g.category === combo.category && g.enabled,
    );
    let recommended_target = seed ? buildTargetFromGoal(seed) : null;
    if (recommended_target) {
      recommended_target = {
        ...recommended_target,
        seniority: combo.seniority as ProductionSeniority,
      };
    }
    recommendations.push({
      priority: priority++,
      kind: "missing_combination",
      reason: `No candidate for combination ${combo.category} × ${combo.seniority}`,
      recommended_target,
      evidence: combo,
    });
  }

  for (const ind of underrepresented_industries.slice(0, 3)) {
    recommendations.push({
      priority: priority++,
      kind: "underrepresented_industry",
      reason: `Industry "${ind}" count ${industry_matrix[ind] ?? 0} is below industry median ${indMedian}`,
      recommended_target: null,
      evidence: { industry: ind, count: industry_matrix[ind] ?? 0, median: indMedian },
    });
  }

  for (const cat of overrepresented_categories) {
    recommendations.push({
      priority: priority++,
      kind: "overrepresented",
      reason: `Category "${cat}" is overrepresented (${category_matrix[cat]} > 2× median ${median}); deprioritize further production`,
      recommended_target: null,
      evidence: { category: cat, count: category_matrix[cat] ?? 0, median },
    });
  }

  // Stable sort: priority asc, then kind, then reason
  recommendations.sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority;
    if (a.kind !== b.kind) return a.kind.localeCompare(b.kind);
    return a.reason.localeCompare(b.reason);
  });
  // Re-number priorities after sort for clean 1..N
  recommendations.forEach((r, i) => {
    r.priority = i + 1;
  });

  return {
    gaps: {
      missing_categories: [...missing_categories],
      underrepresented_categories: [...underrepresented_categories],
      underrepresented_industries,
      underrepresented_seniorities,
      missing_combinations,
      overrepresented_categories: [...overrepresented_categories],
    },
    recommendations,
  };
}

/**
 * Analyze canonical candidate registry and persist portfolio report + history.
 */
export function planPortfolio(
  opts?: PortfolioPlannerOptions,
): PortfolioReport {
  const cycleLog = opts?.cycleLog ?? CYCLE_LOG;
  const generated_at = (opts?.now ?? new Date()).toISOString();
  const manifests = opts?.manifests ?? listCandidateManifests(cycleLog);

  const category_matrix: CountMap = {};
  const industry_matrix: CountMap = {};
  const seniority_matrix: CountMap = {};
  const objective_matrix: CountMap = {};
  const status_matrix: CountMap = {};
  const revision_outcome_matrix: CountMap = {};
  const by_status: CountMap = {};

  let waiting_founder = 0;
  let critic_blocked = 0;
  let failed = 0;
  let running = 0;
  let approved = 0;
  let other = 0;

  for (const m of manifests) {
    bump(category_matrix, m.target.category);
    bump(industry_matrix, m.target.industry);
    bump(seniority_matrix, m.target.seniority);
    bump(objective_matrix, normalizeObjectiveKey(m.target.objective));
    bump(status_matrix, m.status);
    bump(by_status, m.status);

    if (m.status === "WAITING_FOUNDER") waiting_founder += 1;
    else if (m.status === "CRITIC_BLOCKED") critic_blocked += 1;
    else if (m.status === "FAILED") failed += 1;
    else if (m.status === "RUNNING") running += 1;
    else if (String(m.status) === "APPROVED") approved += 1;
    else other += 1;

    const candDir = join(cycleLog, "candidates", m.candidate_id);
    const rev = readRevisionOutcome(candDir);
    if (rev) bump(revision_outcome_matrix, rev);
  }

  // Ensure all canonical categories appear in matrix (0 if absent)
  for (const c of CANONICAL_CATEGORIES) {
    if (category_matrix[c] == null) category_matrix[c] = 0;
  }
  for (const s of CANONICAL_SENIORITIES) {
    if (seniority_matrix[s] == null) seniority_matrix[s] = 0;
  }

  const total = manifests.length;
  const { score, breakdown } = computeCoverageScore({
    total,
    category_matrix,
    seniority_matrix,
    industry_matrix,
    critic_blocked,
  });

  const { gaps, recommendations } = buildRecommendations(
    manifests,
    category_matrix,
    industry_matrix,
    seniority_matrix,
  );

  const duplicate_skip_statistics = scanDuplicateSkipStats(cycleLog);

  const catsFilled = CANONICAL_CATEGORIES.filter(
    (c) => (category_matrix[c] ?? 0) > 0,
  ).length;
  const coverage_summary = `Portfolio: ${total} candidates · coverage_score=${score}/100 · categories ${catsFilled}/${CANONICAL_CATEGORIES.length} · waiting_founder=${waiting_founder} · critic_blocked=${critic_blocked} · recommendations=${recommendations.length}`;

  const stamp = generated_at.replace(/[:.]/g, "-");
  const history_path = join(
    PORTFOLIO_HISTORY_ROOT,
    `portfolio-${stamp}.json`,
  );
  const report_path = join(PORTFOLIO_LOG_ROOT, "portfolio-report.json");

  const report: PortfolioReport = {
    schema_version: PORTFOLIO_PLANNER_VERSION,
    generated_at,
    planner_version: PORTFOLIO_PLANNER_VERSION,
    publication_allowed: false,
    live: false,
    openai_called: false,
    production_triggered: false,
    coverage_score: score,
    coverage_score_breakdown: breakdown,
    candidate_totals: {
      total,
      by_status,
      waiting_founder,
      critic_blocked,
      failed,
      running,
      approved,
      other,
    },
    category_matrix,
    industry_matrix,
    seniority_matrix,
    objective_matrix,
    status_matrix,
    revision_outcome_matrix,
    founder_queue: {
      waiting_founder,
      critic_blocked,
    },
    duplicate_skip_statistics,
    gaps,
    recommendations,
    coverage_summary,
    report_path: relative(REPO, report_path).replace(/\\/g, "/"),
    history_path: relative(REPO, history_path).replace(/\\/g, "/"),
  };

  if (opts?.persist !== false) {
    mkdirSync(PORTFOLIO_HISTORY_ROOT, { recursive: true });
    atomicWriteJson(history_path, report);
    atomicWriteJson(report_path, report);
    atomicWriteJson(join(CYCLE_LOG, "portfolio-report.json"), report);
    atomicWriteJson(join(PORTFOLIO_LOG_ROOT, "latest.json"), {
      generated_at,
      coverage_score: score,
      report_path: report.report_path,
      history_path: report.history_path,
      publication_allowed: false,
    });
  }

  return report;
}
