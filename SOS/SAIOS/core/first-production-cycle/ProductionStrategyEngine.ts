/**
 * Canonical Production Strategy Engine — Agent #216.
 * Converts portfolio intelligence into deterministic production priorities.
 * No OpenAI. No production execution. No resume generation.
 */
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import type {
  PortfolioRecommendation,
  PortfolioReport,
} from "./PortfolioPlanner.js";
import type { ProductionTarget } from "./ProductionTarget.js";
import {
  buildTargetFromGoal,
  INTAKE_GOAL_SEEDS,
} from "./selectProductionTarget.js";
import type { ProductionCategory, ProductionSeniority } from "./ProductionTarget.js";

const REPO = resolve(import.meta.dirname, "../../../..");
const CYCLE_LOG = join(REPO, "SOS/07_LOGS/saios/first-production-cycle");
export const STRATEGY_LOG_ROOT = join(CYCLE_LOG, "strategy");
export const STRATEGY_HISTORY_ROOT = join(STRATEGY_LOG_ROOT, "history");
export const DEFAULT_PORTFOLIO_REPORT_PATH = join(
  CYCLE_LOG,
  "portfolio",
  "portfolio-report.json",
);

export const STRATEGY_ENGINE_VERSION = 1 as const;

export type StrategyBusinessPolicy = {
  prefer_missing_categories: boolean;
  prefer_entry_level: boolean;
  prefer_us_market: boolean;
  avoid_overrepresented: boolean;
  maximum_recommendations: number;
};

export const DEFAULT_STRATEGY_POLICY: StrategyBusinessPolicy = {
  prefer_missing_categories: true,
  prefer_entry_level: false,
  prefer_us_market: false,
  avoid_overrepresented: true,
  maximum_recommendations: 25,
};

export type StrategyRecommendation = {
  priority: number;
  goal_id: string;
  target: ProductionTarget | null;
  reason: string;
  confidence: number;
  source: string;
  estimated_coverage_gain: number;
  kind:
    | "missing_category"
    | "missing_seniority"
    | "missing_combination"
    | "underrepresented_industry"
    | "portfolio_balance"
    | "overrepresented";
};

export type ProductionStrategy = {
  schema_version: typeof STRATEGY_ENGINE_VERSION;
  strategy_version: typeof STRATEGY_ENGINE_VERSION;
  generated_at: string;
  portfolio_score: number;
  portfolio_generated_at: string | null;
  portfolio_report_path: string;
  policy: StrategyBusinessPolicy;
  recommendations: StrategyRecommendation[];
  recommendation_count: number;
  publication_allowed: false;
  live: false;
  openai_called: false;
  production_triggered: false;
  ranking_algorithm: string;
  report_path: string;
  history_path: string;
};

export type StrategyEngineOptions = {
  portfolioReportPath?: string;
  /** In-memory portfolio (verify). When set, file load is skipped. */
  portfolio?: PortfolioReport;
  policy?: Partial<StrategyBusinessPolicy>;
  persist?: boolean;
  now?: Date;
};

function atomicWriteJson(path: string, data: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  const tmp = `${path}.${process.pid}.${Date.now()}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  renameSync(tmp, path);
}

export function mergeStrategyPolicy(
  override?: Partial<StrategyBusinessPolicy>,
): StrategyBusinessPolicy {
  return {
    ...DEFAULT_STRATEGY_POLICY,
    ...(override ?? {}),
    maximum_recommendations: Math.max(
      1,
      Math.floor(
        override?.maximum_recommendations ??
          DEFAULT_STRATEGY_POLICY.maximum_recommendations,
      ),
    ),
  };
}

export function loadPortfolioReport(
  path: string = DEFAULT_PORTFOLIO_REPORT_PATH,
): PortfolioReport {
  if (!existsSync(path)) {
    throw new Error(`Portfolio report not found: ${path}`);
  }
  return JSON.parse(readFileSync(path, "utf8")) as PortfolioReport;
}

/**
 * Rank band (lower = higher priority):
 * 1 missing_category
 * 2 missing_seniority (underrepresented_seniority)
 * 3 missing_combination
 * 4 underrepresented_industry
 * 5 portfolio_balance (underrepresented_category)
 * 9 overrepresented (usually filtered)
 */
function rankBand(kind: StrategyRecommendation["kind"]): number {
  switch (kind) {
    case "missing_category":
      return 1;
    case "missing_seniority":
      return 2;
    case "missing_combination":
      return 3;
    case "underrepresented_industry":
      return 4;
    case "portfolio_balance":
      return 5;
    case "overrepresented":
      return 9;
    default:
      return 99;
  }
}

function mapPortfolioKind(
  kind: PortfolioRecommendation["kind"],
): StrategyRecommendation["kind"] {
  switch (kind) {
    case "missing_category":
      return "missing_category";
    case "underrepresented_seniority":
      return "missing_seniority";
    case "missing_combination":
      return "missing_combination";
    case "underrepresented_industry":
      return "underrepresented_industry";
    case "underrepresented_category":
      return "portfolio_balance";
    case "overrepresented":
      return "overrepresented";
    default:
      return "portfolio_balance";
  }
}

function confidenceFor(kind: StrategyRecommendation["kind"]): number {
  switch (kind) {
    case "missing_category":
      return 1.0;
    case "missing_seniority":
      return 0.85;
    case "missing_combination":
      return 0.8;
    case "underrepresented_industry":
      return 0.7;
    case "portfolio_balance":
      return 0.75;
    case "overrepresented":
      return 0.6;
    default:
      return 0.5;
  }
}

/**
 * Estimated coverage-score points if this gap were filled (deterministic weights
 * aligned with PortfolioPlanner score components: cat 40/10, sen 25/5, …).
 */
function estimatedGain(kind: StrategyRecommendation["kind"]): number {
  switch (kind) {
    case "missing_category":
      return 4; // 40/10
    case "missing_seniority":
      return 5; // 25/5
    case "missing_combination":
      return 2;
    case "underrepresented_industry":
      return 2.5;
    case "portfolio_balance":
      return 2;
    case "overrepresented":
      return 0;
    default:
      return 1;
  }
}

function stableGoalId(
  kind: StrategyRecommendation["kind"],
  target: ProductionTarget | null,
  evidence: Record<string, unknown>,
): string {
  const parts = [
    kind,
    String(evidence.category ?? target?.category ?? ""),
    String(evidence.seniority ?? target?.seniority ?? ""),
    String(evidence.industry ?? target?.industry ?? ""),
  ];
  return `goal-${parts.map((p) => p.replace(/[^a-z0-9]+/gi, "_").replace(/^_|_$/g, "") || "x").join("-")}`.toLowerCase();
}

function maybePreferEntry(
  target: ProductionTarget | null,
  policy: StrategyBusinessPolicy,
): ProductionTarget | null {
  if (!target || !policy.prefer_entry_level) return target;
  return { ...target, seniority: "entry" };
}

/**
 * prefer_us_market: no market field exists on ProductionTarget V1.
 * When true, prefer targets whose industry is already common US-leaning
 * registry labels (software/marketing) — deterministic tie-break only.
 * Does not invent geography.
 */
function usMarketBoost(target: ProductionTarget | null): number {
  if (!target) return 0;
  const ind = target.industry.toLowerCase();
  if (ind === "software" || ind === "marketing") return 1;
  return 0;
}

function fromGapsDirect(
  report: PortfolioReport,
  policy: StrategyBusinessPolicy,
): StrategyRecommendation[] {
  const out: StrategyRecommendation[] = [];

  if (policy.prefer_missing_categories) {
    for (const cat of report.gaps.missing_categories) {
      const seed = INTAKE_GOAL_SEEDS.find(
        (g) => g.category === cat && g.enabled,
      );
      let target = seed ? buildTargetFromGoal(seed) : null;
      target = maybePreferEntry(target, policy);
      const kind = "missing_category" as const;
      out.push({
        priority: 0,
        goal_id: stableGoalId(kind, target, { category: cat }),
        target,
        reason: `Missing canonical category "${cat}"`,
        confidence: confidenceFor(kind),
        source: "portfolio.gaps.missing_categories",
        estimated_coverage_gain: estimatedGain(kind),
        kind,
      });
    }
  }

  for (const sen of report.gaps.underrepresented_seniorities) {
    const host =
      report.gaps.missing_categories[0] ??
      report.gaps.underrepresented_categories[0] ??
      (Object.entries(report.category_matrix).find(([, n]) => n > 0)?.[0] as
        | ProductionCategory
        | undefined) ??
      "marketing";
    const seed = INTAKE_GOAL_SEEDS.find(
      (g) => g.category === host && g.enabled,
    );
    let target = seed ? buildTargetFromGoal(seed) : null;
    if (target) {
      target = {
        ...target,
        seniority: (policy.prefer_entry_level
          ? "entry"
          : sen) as ProductionSeniority,
      };
    }
    const kind = "missing_seniority" as const;
    out.push({
      priority: 0,
      goal_id: stableGoalId(kind, target, { category: host, seniority: sen }),
      target,
      reason: `Missing or underrepresented seniority "${sen}"`,
      confidence: confidenceFor(kind),
      source: "portfolio.gaps.underrepresented_seniorities",
      estimated_coverage_gain: estimatedGain(kind),
      kind,
    });
  }

  for (const combo of report.gaps.missing_combinations) {
    const seed = INTAKE_GOAL_SEEDS.find(
      (g) => g.category === combo.category && g.enabled,
    );
    let target = seed ? buildTargetFromGoal(seed) : null;
    if (target) {
      target = {
        ...target,
        seniority: (policy.prefer_entry_level
          ? "entry"
          : combo.seniority) as ProductionSeniority,
      };
    }
    const kind = "missing_combination" as const;
    out.push({
      priority: 0,
      goal_id: stableGoalId(kind, target, combo),
      target,
      reason: `Missing combination ${combo.category} × ${combo.seniority}`,
      confidence: confidenceFor(kind),
      source: "portfolio.gaps.missing_combinations",
      estimated_coverage_gain: estimatedGain(kind),
      kind,
    });
  }

  for (const ind of report.gaps.underrepresented_industries) {
    const kind = "underrepresented_industry" as const;
    out.push({
      priority: 0,
      goal_id: stableGoalId(kind, null, { industry: ind }),
      target: null,
      reason: `Underrepresented industry "${ind}"`,
      confidence: confidenceFor(kind),
      source: "portfolio.gaps.underrepresented_industries",
      estimated_coverage_gain: estimatedGain(kind),
      kind,
    });
  }

  for (const cat of report.gaps.underrepresented_categories) {
    const seed = INTAKE_GOAL_SEEDS.find(
      (g) => g.category === cat && g.enabled,
    );
    let target = seed ? buildTargetFromGoal(seed) : null;
    target = maybePreferEntry(target, policy);
    const kind = "portfolio_balance" as const;
    out.push({
      priority: 0,
      goal_id: stableGoalId(kind, target, { category: cat }),
      target,
      reason: `Portfolio balance: underrepresented category "${cat}"`,
      confidence: confidenceFor(kind),
      source: "portfolio.gaps.underrepresented_categories",
      estimated_coverage_gain: estimatedGain(kind),
      kind,
    });
  }

  if (!policy.avoid_overrepresented) {
    for (const cat of report.gaps.overrepresented_categories) {
      const kind = "overrepresented" as const;
      out.push({
        priority: 0,
        goal_id: stableGoalId(kind, null, { category: cat }),
        target: null,
        reason: `Overrepresented category "${cat}" (informational)`,
        confidence: confidenceFor(kind),
        source: "portfolio.gaps.overrepresented_categories",
        estimated_coverage_gain: 0,
        kind,
      });
    }
  }

  return out;
}

function fromPortfolioRecommendations(
  report: PortfolioReport,
  policy: StrategyBusinessPolicy,
): StrategyRecommendation[] {
  const out: StrategyRecommendation[] = [];
  for (const rec of report.recommendations) {
    const kind = mapPortfolioKind(rec.kind);
    if (kind === "overrepresented" && policy.avoid_overrepresented) continue;
    if (kind === "missing_category" && !policy.prefer_missing_categories) {
      continue;
    }
    let target = rec.recommended_target
      ? { ...rec.recommended_target }
      : null;
    target = maybePreferEntry(target, policy);
    out.push({
      priority: 0,
      goal_id: stableGoalId(kind, target, rec.evidence),
      target,
      reason: rec.reason,
      confidence: confidenceFor(kind),
      source: `portfolio.recommendations.${rec.kind}`,
      estimated_coverage_gain: estimatedGain(kind),
      kind,
    });
  }
  return out;
}

function dedupeByGoalId(
  items: StrategyRecommendation[],
): StrategyRecommendation[] {
  const seen = new Set<string>();
  const out: StrategyRecommendation[] = [];
  for (const item of items) {
    if (seen.has(item.goal_id)) continue;
    seen.add(item.goal_id);
    out.push(item);
  }
  return out;
}

/**
 * Exact ranking algorithm (deterministic):
 * 1. Sort by rankBand(kind) ascending (missing_category → … → portfolio_balance)
 * 2. Within band: prefer_entry_level → entry seniority first
 * 3. Within band: prefer_us_market → software/marketing industry boost
 * 4. Within band: higher estimated_coverage_gain first
 * 5. Within band: higher confidence first
 * 6. Within band: goal_id lexicographic
 * 7. Assign priority = 1..N
 * 8. Truncate to maximum_recommendations
 */
export function rankStrategyRecommendations(
  items: StrategyRecommendation[],
  policy: StrategyBusinessPolicy,
): StrategyRecommendation[] {
  const sorted = [...items].sort((a, b) => {
    const ba = rankBand(a.kind);
    const bb = rankBand(b.kind);
    if (ba !== bb) return ba - bb;

    if (policy.prefer_entry_level) {
      const ae = a.target?.seniority === "entry" ? 0 : 1;
      const be = b.target?.seniority === "entry" ? 0 : 1;
      if (ae !== be) return ae - be;
    }

    if (policy.prefer_us_market) {
      const au = usMarketBoost(a.target);
      const bu = usMarketBoost(b.target);
      if (bu !== au) return bu - au;
    }

    if (b.estimated_coverage_gain !== a.estimated_coverage_gain) {
      return b.estimated_coverage_gain - a.estimated_coverage_gain;
    }
    if (b.confidence !== a.confidence) return b.confidence - a.confidence;
    return a.goal_id.localeCompare(b.goal_id);
  });

  return sorted.slice(0, policy.maximum_recommendations).map((r, i) => ({
    ...r,
    priority: i + 1,
  }));
}

export const RANKING_ALGORITHM_DOC = [
  "1) Band order: missing_category, missing_seniority, missing_combination, underrepresented_industry, portfolio_balance [, overrepresented if allowed]",
  "2) prefer_entry_level: entry seniority before others within band",
  "3) prefer_us_market: software/marketing industry boost within band (no invented geography)",
  "4) Higher estimated_coverage_gain",
  "5) Higher confidence",
  "6) goal_id lexicographic",
  "7) priority := 1..N; truncate to maximum_recommendations",
].join(" | ");

/**
 * Build production strategy from portfolio intelligence.
 */
export function buildProductionStrategy(
  opts?: StrategyEngineOptions,
): ProductionStrategy {
  const generated_at = (opts?.now ?? new Date()).toISOString();
  const policy = mergeStrategyPolicy(opts?.policy);
  const portfolioPath =
    opts?.portfolioReportPath ?? DEFAULT_PORTFOLIO_REPORT_PATH;
  const report = opts?.portfolio ?? loadPortfolioReport(portfolioPath);

  const fromGaps = fromGapsDirect(report, policy);
  const fromRecs = fromPortfolioRecommendations(report, policy);
  // Gaps first in merge so they win dedupe for same goal_id
  const merged = dedupeByGoalId([...fromGaps, ...fromRecs]);
  const recommendations = rankStrategyRecommendations(merged, policy);

  const stamp = generated_at.replace(/[:.]/g, "-");
  const history_path = join(STRATEGY_HISTORY_ROOT, `strategy-${stamp}.json`);
  const report_path = join(STRATEGY_LOG_ROOT, "production-strategy.json");

  const strategy: ProductionStrategy = {
    schema_version: STRATEGY_ENGINE_VERSION,
    strategy_version: STRATEGY_ENGINE_VERSION,
    generated_at,
    portfolio_score: report.coverage_score,
    portfolio_generated_at: report.generated_at ?? null,
    portfolio_report_path: relative(REPO, portfolioPath).replace(/\\/g, "/"),
    policy,
    recommendations,
    recommendation_count: recommendations.length,
    publication_allowed: false,
    live: false,
    openai_called: false,
    production_triggered: false,
    ranking_algorithm: RANKING_ALGORITHM_DOC,
    report_path: relative(REPO, report_path).replace(/\\/g, "/"),
    history_path: relative(REPO, history_path).replace(/\\/g, "/"),
  };

  if (opts?.persist !== false) {
    mkdirSync(STRATEGY_HISTORY_ROOT, { recursive: true });
    atomicWriteJson(history_path, strategy);
    atomicWriteJson(report_path, strategy);
    atomicWriteJson(join(CYCLE_LOG, "production-strategy.json"), strategy);
    atomicWriteJson(join(STRATEGY_LOG_ROOT, "latest.json"), {
      generated_at,
      portfolio_score: strategy.portfolio_score,
      recommendation_count: strategy.recommendation_count,
      report_path: strategy.report_path,
      history_path: strategy.history_path,
      publication_allowed: false,
    });
  }

  return strategy;
}
