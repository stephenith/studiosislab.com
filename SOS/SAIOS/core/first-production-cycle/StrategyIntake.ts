/**
 * Strategy-driven Production Intake bridge — Agent #217.
 * Loads production-strategy.json and converts recommendations → ProductionTargets.
 * Does not redesign ProductionStrategyEngine. No OpenAI. No publication.
 */
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import {
  type ProductionCategory,
  type ProductionSeniority,
  type ProductionTarget,
} from "./ProductionTarget.js";
import { fingerprintProductionTarget } from "./DuplicateDetector.js";
import { countFounderReviewWaitingByCategory } from "../founder-review/FounderReviewProjection.js";

const REPO = resolve(import.meta.dirname, "../../../..");
const CYCLE_LOG = join(REPO, "SOS/07_LOGS/saios/first-production-cycle");
export const STRATEGY_INTAKE_REPORT_PATH = join(
  CYCLE_LOG,
  "strategy-intake-report.json",
);
export const DEFAULT_STRATEGY_PATHS = [
  join(CYCLE_LOG, "strategy", "production-strategy.json"),
  join(CYCLE_LOG, "production-strategy.json"),
] as const;

export const EXPECTED_STRATEGY_VERSION = 1 as const;

const CATEGORIES = new Set<ProductionCategory>([
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
]);

const SENIORITIES = new Set<ProductionSeniority>([
  "entry",
  "mid",
  "senior",
  "executive",
  "student",
]);

export type LoadedStrategyRecommendation = {
  priority: number;
  goal_id: string;
  target: ProductionTarget | null;
  reason: string;
  confidence: number;
  source: string;
  estimated_coverage_gain?: number;
  kind?: string;
};

export type LoadedProductionStrategy = {
  schema_version: number;
  strategy_version: number;
  generated_at: string;
  recommendations: LoadedStrategyRecommendation[];
  recommendation_count: number;
  portfolio_score?: number;
};

export type StrategyLoadResult =
  | {
      ok: true;
      strategy: LoadedProductionStrategy;
      path: string;
    }
  | {
      ok: false;
      reason: string;
      path: string | null;
    };

export type StrategyIntakeReport = {
  generated_at: string;
  strategy_consumed: boolean;
  strategy_path: string | null;
  strategy_version: number | null;
  strategy_generated_at: string | null;
  recommendations_total: number;
  recommendations_used: number;
  recommendations_skipped: number;
  skip_reasons: string[];
  fallback_used: boolean;
  fallback_reason: string | null;
  selected_goal_id: string | null;
  selected_category: string | null;
  publication_allowed: false;
  openai_called: false;
};

function atomicWriteJson(path: string, data: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  const tmp = `${path}.${process.pid}.${Date.now()}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  renameSync(tmp, path);
}

export function isValidProductionTargetShape(
  value: unknown,
): value is ProductionTarget {
  if (!value || typeof value !== "object") return false;
  const o = value as Record<string, unknown>;
  return (
    typeof o.category === "string" &&
    CATEGORIES.has(o.category as ProductionCategory) &&
    typeof o.title === "string" &&
    o.title.trim().length > 0 &&
    typeof o.industry === "string" &&
    o.industry.trim().length > 0 &&
    typeof o.seniority === "string" &&
    SENIORITIES.has(o.seniority as ProductionSeniority) &&
    typeof o.objective === "string" &&
    o.objective.trim().length > 0 &&
    typeof o.role_family === "string" &&
    o.role_family.trim().length > 0
  );
}

function parseRecommendation(
  raw: unknown,
): LoadedStrategyRecommendation | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.goal_id !== "string" || !o.goal_id.trim()) return null;
  if (typeof o.priority !== "number" || !Number.isFinite(o.priority)) return null;
  if (typeof o.reason !== "string") return null;
  if (typeof o.source !== "string") return null;
  if (typeof o.confidence !== "number" || !Number.isFinite(o.confidence)) {
    return null;
  }

  let target: ProductionTarget | null = null;
  if (o.target === null || o.target === undefined) {
    target = null;
  } else if (isValidProductionTargetShape(o.target)) {
    target = {
      category: o.target.category,
      title: o.target.title,
      industry: o.target.industry,
      seniority: o.target.seniority,
      objective: o.target.objective,
      role_family: o.target.role_family,
    };
  } else {
    // Malformed target on an otherwise structured rec → treat as skip later
    target = null;
    return {
      priority: o.priority,
      goal_id: o.goal_id,
      target: null,
      reason: o.reason,
      confidence: o.confidence,
      source: o.source,
      estimated_coverage_gain:
        typeof o.estimated_coverage_gain === "number"
          ? o.estimated_coverage_gain
          : undefined,
      kind: typeof o.kind === "string" ? o.kind : undefined,
      // marker via kind for skip reason
    };
  }

  return {
    priority: o.priority,
    goal_id: o.goal_id,
    target,
    reason: o.reason,
    confidence: o.confidence,
    source: o.source,
    estimated_coverage_gain:
      typeof o.estimated_coverage_gain === "number"
        ? o.estimated_coverage_gain
        : undefined,
    kind: typeof o.kind === "string" ? o.kind : undefined,
  };
}

/**
 * Validate strategy document: version, timestamp, recommendation structure.
 */
export function validateProductionStrategy(
  raw: unknown,
): { ok: true; strategy: LoadedProductionStrategy } | { ok: false; reason: string } {
  if (!raw || typeof raw !== "object") {
    return { ok: false, reason: "strategy_not_object" };
  }
  const o = raw as Record<string, unknown>;
  const strategy_version =
    typeof o.strategy_version === "number"
      ? o.strategy_version
      : typeof o.schema_version === "number"
        ? o.schema_version
        : null;
  if (strategy_version !== EXPECTED_STRATEGY_VERSION) {
    return { ok: false, reason: "invalid_strategy_version" };
  }
  if (typeof o.generated_at !== "string" || !o.generated_at.trim()) {
    return { ok: false, reason: "missing_timestamp" };
  }
  if (!Array.isArray(o.recommendations)) {
    return { ok: false, reason: "recommendations_not_array" };
  }

  const recommendations: LoadedStrategyRecommendation[] = [];
  for (let i = 0; i < o.recommendations.length; i++) {
    const rec = parseRecommendation(o.recommendations[i]);
    if (!rec) {
      return { ok: false, reason: `malformed_recommendation_${i}` };
    }
    recommendations.push(rec);
  }

  const recommendation_count =
    typeof o.recommendation_count === "number"
      ? o.recommendation_count
      : recommendations.length;

  return {
    ok: true,
    strategy: {
      schema_version: strategy_version,
      strategy_version,
      generated_at: o.generated_at,
      recommendations,
      recommendation_count,
      portfolio_score:
        typeof o.portfolio_score === "number" ? o.portfolio_score : undefined,
    },
  };
}

export function loadProductionStrategyFile(
  strategyPath?: string,
): StrategyLoadResult {
  const candidates = strategyPath
    ? [strategyPath]
    : [...DEFAULT_STRATEGY_PATHS];

  let lastPath: string | null = null;
  for (const path of candidates) {
    lastPath = path;
    if (!existsSync(path)) continue;
    try {
      const raw = JSON.parse(readFileSync(path, "utf8")) as unknown;
      const validated = validateProductionStrategy(raw);
      if (!validated.ok) {
        return { ok: false, reason: validated.reason, path };
      }
      return { ok: true, strategy: validated.strategy, path };
    } catch {
      return { ok: false, reason: "strategy_unreadable", path };
    }
  }
  return { ok: false, reason: "strategy_missing", path: lastPath };
}

export function attachStrategyMetadata(
  target: ProductionTarget,
  rec: LoadedStrategyRecommendation,
  strategyVersion: number,
): ProductionTarget {
  return {
    category: target.category,
    title: target.title,
    industry: target.industry,
    seniority: target.seniority,
    objective: target.objective,
    role_family: target.role_family,
    goal_id: rec.goal_id,
    strategy_version: strategyVersion,
    priority: rec.priority,
    strategy_reason: rec.reason,
    strategy_source: rec.source,
  };
}

export function persistStrategyIntakeReport(
  report: StrategyIntakeReport,
  reportPath: string = STRATEGY_INTAKE_REPORT_PATH,
): void {
  atomicWriteJson(reportPath, report);
}

export type ConsumeStrategyOptions = {
  strategyPath?: string;
  excludeFingerprints?: Set<string> | string[];
  /** When false, skip WAITING_FOUNDER category reservation (verify only). */
  respectWaitingFounder?: boolean;
  persist?: boolean;
  reportPath?: string;
  now?: Date;
};

/**
 * Consume strategy recommendations in priority order → first usable ProductionTarget.
 * Returns null when intake should fall back to coverage-based selection.
 */
export function consumeStrategyRecommendation(
  opts?: ConsumeStrategyOptions,
): { target: ProductionTarget; report: StrategyIntakeReport } | null {
  const now = (opts?.now ?? new Date()).toISOString();
  const loaded = loadProductionStrategyFile(opts?.strategyPath);

  const baseReport = (): StrategyIntakeReport => ({
    generated_at: now,
    strategy_consumed: false,
    strategy_path: loaded.path,
    strategy_version: null,
    strategy_generated_at: null,
    recommendations_total: 0,
    recommendations_used: 0,
    recommendations_skipped: 0,
    skip_reasons: [],
    fallback_used: true,
    fallback_reason: loaded.ok ? null : loaded.reason,
    selected_goal_id: null,
    selected_category: null,
    publication_allowed: false,
    openai_called: false,
  });

  if (!loaded.ok) {
    const report = baseReport();
    report.fallback_reason = loaded.reason;
    if (opts?.persist !== false) {
      persistStrategyIntakeReport(report, opts?.reportPath);
    }
    return null;
  }

  const strategy = loaded.strategy;
  if (strategy.recommendations.length === 0) {
    const report: StrategyIntakeReport = {
      ...baseReport(),
      strategy_version: strategy.strategy_version,
      strategy_generated_at: strategy.generated_at,
      recommendations_total: 0,
      fallback_reason: "strategy_empty",
    };
    if (opts?.persist !== false) {
      persistStrategyIntakeReport(report, opts?.reportPath);
    }
    return null;
  }

  const exclude = new Set(
    opts?.excludeFingerprints ? [...opts.excludeFingerprints] : [],
  );
  const respectWaiting = opts?.respectWaitingFounder !== false;
  const waitingByCategory = respectWaiting
    ? countFounderReviewWaitingByCategory(REPO)
    : ({} as Record<string, number>);

  const ranked = [...strategy.recommendations].sort(
    (a, b) => a.priority - b.priority || a.goal_id.localeCompare(b.goal_id),
  );

  const skip_reasons: string[] = [];
  let skipped = 0;

  for (const rec of ranked) {
    if (!rec.target || !isValidProductionTargetShape(rec.target)) {
      skipped += 1;
      skip_reasons.push(`${rec.goal_id}:null_or_invalid_target`);
      continue;
    }
    if (respectWaiting) {
      const waiting = waitingByCategory[rec.target.category] ?? 0;
      if (waiting > 0) {
        skipped += 1;
        skip_reasons.push(`${rec.goal_id}:waiting_founder_reserved`);
        continue;
      }
    }
    const fp = fingerprintProductionTarget(rec.target);
    if (exclude.has(fp)) {
      skipped += 1;
      skip_reasons.push(`${rec.goal_id}:exclude_fingerprint`);
      continue;
    }

    const target = attachStrategyMetadata(
      rec.target,
      rec,
      strategy.strategy_version,
    );
    const report: StrategyIntakeReport = {
      generated_at: now,
      strategy_consumed: true,
      strategy_path: loaded.path,
      strategy_version: strategy.strategy_version,
      strategy_generated_at: strategy.generated_at,
      recommendations_total: strategy.recommendations.length,
      recommendations_used: 1,
      recommendations_skipped: skipped,
      skip_reasons,
      fallback_used: false,
      fallback_reason: null,
      selected_goal_id: rec.goal_id,
      selected_category: target.category,
      publication_allowed: false,
      openai_called: false,
    };
    if (opts?.persist !== false) {
      persistStrategyIntakeReport(report, opts?.reportPath);
    }
    return { target, report };
  }

  // All recommendations skipped → fall back
  const report: StrategyIntakeReport = {
    generated_at: now,
    strategy_consumed: false,
    strategy_path: loaded.path,
    strategy_version: strategy.strategy_version,
    strategy_generated_at: strategy.generated_at,
    recommendations_total: strategy.recommendations.length,
    recommendations_used: 0,
    recommendations_skipped: skipped,
    skip_reasons,
    fallback_used: true,
    fallback_reason: "all_recommendations_skipped",
    selected_goal_id: null,
    selected_category: null,
    publication_allowed: false,
    openai_called: false,
  };
  if (opts?.persist !== false) {
    persistStrategyIntakeReport(report, opts?.reportPath);
  }
  return null;
}
