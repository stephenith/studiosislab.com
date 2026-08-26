/**
 * Canonical Operational Policy Advisor — Agent #221.
 * Read-only historical analysis → deterministic policy recommendations.
 * Never modifies policies, scheduling, budgets, strategy, or production.
 */
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

const REPO = resolve(import.meta.dirname, "../../../..");
const CYCLE_LOG = join(REPO, "SOS/07_LOGS/saios/first-production-cycle");

export const ADVISOR_LOG_ROOT = join(CYCLE_LOG, "advisor");
export const ADVISOR_HISTORY_ROOT = join(ADVISOR_LOG_ROOT, "history");
export const OPERATIONAL_POLICY_ADVICE_PATH = join(
  ADVISOR_LOG_ROOT,
  "operational-policy-advice.json",
);
export const OPERATIONAL_POLICY_ADVICE_FLAT = join(
  CYCLE_LOG,
  "operational-policy-advice.json",
);

export const ADVISOR_VERSION = "1.0.0" as const;

export type AdviceSeverity = "info" | "low" | "medium" | "high";

export type PolicyAdviceRecommendation = {
  recommendation_id: string;
  severity: AdviceSeverity;
  confidence: number;
  supporting_metrics: Record<string, number | string | boolean | null>;
  expected_effect: string;
  affected_policy:
    | "adaptive_scheduling"
    | "resource_budget"
    | "production_strategy"
    | "portfolio"
    | "batch_runner"
    | "founder_queue"
    | "general_operations";
  reason: string;
};

export type OperationalAnalysisMetrics = {
  average_production_per_day: number;
  average_skipped_cycles_per_day: number;
  budget_denial_frequency: number;
  health_failure_frequency: number;
  queue_saturation_ratio: number | null;
  candidate_throughput_total: number;
  portfolio_growth_delta: number | null;
  portfolio_score_latest: number | null;
  portfolio_score_trend_delta: number | null;
  schedule_efficiency_run_soon_ratio: number | null;
  schedule_pause_ratio: number | null;
  controller_success_rate: number | null;
  execution_count: number;
  completed_executions: number;
  skipped_or_failed_executions: number;
  budget_history_count: number;
  health_unhealthy_count: number;
  schedule_history_count: number;
  dashboard_history_count: number;
  autonomous_history_events: number;
  window_days_observed: number;
};

export type HistorySourceStatus = {
  id: string;
  path: string;
  available: boolean;
  records: number;
  detail: string;
};

export type OperationalPolicyAdviceReport = {
  schema_version: 1;
  advisor_version: typeof ADVISOR_VERSION;
  generated_at: string;
  analysis: OperationalAnalysisMetrics;
  recommendations: PolicyAdviceRecommendation[];
  recommendation_count: number;
  sources: HistorySourceStatus[];
  missing_sources: string[];
  advisory_only: true;
  policies_modified: false;
  scheduling_modified: false;
  budget_modified: false;
  strategy_modified: false;
  production_triggered: false;
  publication_allowed: false;
  live: false;
  openai_called: false;
  report_path: string;
  history_path: string;
  duration_ms: number;
};

export type BuildOperationalAdviceOptions = {
  repoRoot?: string;
  cycleLog?: string;
  persist?: boolean;
  now?: Date;
};

function atomicWriteJson(path: string, data: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  const tmp = `${path}.${process.pid}.${Date.now()}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  renameSync(tmp, path);
}

function tryReadJson(path: string): Record<string, unknown> | null {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function listJsonFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map((f) => join(dir, f));
}

function loadJsonRecords(dir: string): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  for (const p of listJsonFiles(dir)) {
    const raw = tryReadJson(p);
    if (raw) out.push(raw);
  }
  return out;
}

function avg(nums: number[]): number {
  if (nums.length === 0) return 0;
  return Number(
    (nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(4),
  );
}

function ratio(num: number, den: number): number | null {
  if (den <= 0) return null;
  return Number((num / den).toFixed(4));
}

type ExecLite = {
  stop_reason: string | null;
  finished_at: string | null;
  candidate_count: number;
};

function loadExecutions(cycleLog: string): ExecLite[] {
  const root = join(cycleLog, "executions");
  if (!existsSync(root)) return [];
  const out: ExecLite[] = [];
  for (const name of readdirSync(root).sort()) {
    if (!name.startsWith("exec-")) continue;
    const raw = tryReadJson(join(root, name, "execution-report.json"));
    if (!raw) continue;
    out.push({
      stop_reason:
        typeof raw.stop_reason === "string" ? raw.stop_reason : null,
      finished_at:
        typeof raw.finished_at === "string" ? raw.finished_at : null,
      candidate_count:
        typeof raw.candidate_count === "number" ? raw.candidate_count : 0,
    });
  }
  return out;
}

function countAutonomousHistoryEvents(cycleLog: string): number {
  const sessions = join(cycleLog, "autonomous", "sessions");
  if (!existsSync(sessions)) return 0;
  let n = 0;
  for (const name of readdirSync(sessions)) {
    const hist = join(sessions, name, "history.jsonl");
    if (!existsSync(hist)) continue;
    n += readFileSync(hist, "utf8").split("\n").filter(Boolean).length;
  }
  return n;
}

function dayKey(iso: string | null | undefined): string | null {
  if (!iso || typeof iso !== "string") return null;
  return iso.slice(0, 10);
}

function groupCountByDay(
  items: Array<{ day: string | null }>,
): Map<string, number> {
  const m = new Map<string, number>();
  for (const it of items) {
    if (!it.day) continue;
    m.set(it.day, (m.get(it.day) ?? 0) + 1);
  }
  return m;
}

function buildRecommendations(
  m: OperationalAnalysisMetrics,
): PolicyAdviceRecommendation[] {
  const recs: PolicyAdviceRecommendation[] = [];

  if (
    m.budget_denial_frequency >= 0.25 &&
    m.budget_history_count + m.execution_count >= 2
  ) {
    recs.push({
      recommendation_id: "rec-increase-daily-cycle-limit",
      severity: m.budget_denial_frequency >= 0.5 ? "high" : "medium",
      confidence: Math.min(0.95, 0.55 + m.budget_denial_frequency),
      supporting_metrics: {
        budget_denial_frequency: m.budget_denial_frequency,
        execution_count: m.execution_count,
      },
      expected_effect:
        "Fewer budget DENY aborts; more controller cycles may complete under load",
      affected_policy: "resource_budget",
      reason:
        "Budget denials are frequent relative to observed evaluations/executions",
    });
  }

  if (
    m.health_failure_frequency >= 0.2 &&
    m.execution_count + m.health_unhealthy_count >= 2
  ) {
    recs.push({
      recommendation_id: "rec-increase-minimum-interval",
      severity: m.health_failure_frequency >= 0.4 ? "high" : "medium",
      confidence: Math.min(0.9, 0.5 + m.health_failure_frequency),
      supporting_metrics: {
        health_failure_frequency: m.health_failure_frequency,
        average_skipped_cycles_per_day: m.average_skipped_cycles_per_day,
      },
      expected_effect:
        "Slower evaluation cadence may reduce repeated unhealthy probes",
      affected_policy: "adaptive_scheduling",
      reason: "Health failures / unhealthy stops appear frequently",
    });
  }

  if (
    m.queue_saturation_ratio !== null &&
    m.queue_saturation_ratio >= 0.8
  ) {
    recs.push({
      recommendation_id: "rec-increase-founder-queue-capacity",
      severity: m.queue_saturation_ratio >= 1 ? "high" : "medium",
      confidence: 0.85,
      supporting_metrics: {
        queue_saturation_ratio: m.queue_saturation_ratio,
      },
      expected_effect:
        "More WAITING_FOUNDER headroom before PAUSE / capacity skips",
      affected_policy: "founder_queue",
      reason: "Founder queue saturation is at or above 80% of capacity",
    });
  }

  if (
    m.schedule_pause_ratio !== null &&
    m.schedule_pause_ratio >= 0.3 &&
    m.schedule_history_count >= 2
  ) {
    recs.push({
      recommendation_id: "rec-decrease-failure-cooldown",
      severity: "low",
      confidence: 0.65,
      supporting_metrics: {
        schedule_pause_ratio: m.schedule_pause_ratio,
        schedule_history_count: m.schedule_history_count,
      },
      expected_effect:
        "Shorter cooldowns may recover faster after transient failure streaks",
      affected_policy: "adaptive_scheduling",
      reason: "Scheduling PAUSE decisions are a large share of recent history",
    });
  }

  if (
    m.controller_success_rate !== null &&
    m.controller_success_rate < 0.5 &&
    m.execution_count >= 3
  ) {
    recs.push({
      recommendation_id: "rec-reduce-maximum-batch-size",
      severity: "medium",
      confidence: 0.7,
      supporting_metrics: {
        controller_success_rate: m.controller_success_rate,
        execution_count: m.execution_count,
      },
      expected_effect:
        "Smaller batches may improve completion rate under pressure",
      affected_policy: "batch_runner",
      reason: "Controller completion rate is below 50% in observed executions",
    });
  }

  if (
    m.portfolio_score_latest !== null &&
    m.portfolio_score_latest < 70
  ) {
    recs.push({
      recommendation_id: "rec-improve-portfolio-balance",
      severity: m.portfolio_score_latest < 50 ? "high" : "medium",
      confidence: 0.8,
      supporting_metrics: {
        portfolio_score_latest: m.portfolio_score_latest,
        portfolio_score_trend_delta: m.portfolio_score_trend_delta,
      },
      expected_effect:
        "Strategy/intake focus on missing coverage may raise portfolio score",
      affected_policy: "portfolio",
      reason: "Latest portfolio coverage score is below 70",
    });
  }

  if (
    m.schedule_efficiency_run_soon_ratio !== null &&
    m.schedule_efficiency_run_soon_ratio >= 0.75 &&
    m.schedule_history_count >= 4
  ) {
    recs.push({
      recommendation_id: "rec-raise-minimum-interval-fast-cycle",
      severity: "info",
      confidence: 0.6,
      supporting_metrics: {
        schedule_efficiency_run_soon_ratio:
          m.schedule_efficiency_run_soon_ratio,
      },
      expected_effect:
        "Slightly less aggressive RUN_SOON cadence under sustained idle accel",
      affected_policy: "adaptive_scheduling",
      reason: "RUN_SOON dominates recent scheduling history",
    });
  }

  if (
    m.average_production_per_day >= 20 &&
    m.candidate_throughput_total >= 20
  ) {
    recs.push({
      recommendation_id: "rec-review-daily-candidate-budget",
      severity: "info",
      confidence: 0.55,
      supporting_metrics: {
        average_production_per_day: m.average_production_per_day,
        candidate_throughput_total: m.candidate_throughput_total,
      },
      expected_effect:
        "Align daily candidate limits with observed throughput",
      affected_policy: "resource_budget",
      reason: "High sustained production/candidate throughput observed",
    });
  }

  // Stable ordering by severity then id
  const sevRank: Record<AdviceSeverity, number> = {
    high: 0,
    medium: 1,
    low: 2,
    info: 3,
  };
  recs.sort(
    (a, b) =>
      sevRank[a.severity] - sevRank[b.severity] ||
      a.recommendation_id.localeCompare(b.recommendation_id),
  );
  return recs;
}

/**
 * Build operational policy advice (read-only). Never mutates upstream policies.
 */
export function buildOperationalPolicyAdvice(
  opts?: BuildOperationalAdviceOptions,
): OperationalPolicyAdviceReport {
  const t0 = performance.now();
  const now = opts?.now ?? new Date();
  const generated_at = now.toISOString();
  const repoRoot = opts?.repoRoot ?? REPO;
  const cycleLog = opts?.cycleLog ?? CYCLE_LOG;

  const paths = {
    dashboard_history: join(
      cycleLog,
      "operations-dashboard",
      "history",
    ),
    scheduling_history: join(cycleLog, "scheduling", "history"),
    budget_history: join(cycleLog, "budget", "history"),
    portfolio_history: join(cycleLog, "portfolio", "history"),
    executions: join(cycleLog, "executions"),
    health_report: join(cycleLog, "health-report.json"),
    autonomous_sessions: join(cycleLog, "autonomous", "sessions"),
    dashboard_latest: join(
      cycleLog,
      "operations-dashboard",
      "operations-dashboard.json",
    ),
  };

  const sources: HistorySourceStatus[] = [];
  const mark = (
    id: string,
    path: string,
    records: number,
    available: boolean,
    detail: string,
  ): void => {
    sources.push({
      id,
      path: relative(repoRoot, path).replace(/\\/g, "/"),
      available,
      records,
      detail,
    });
  };

  const dashHist = loadJsonRecords(paths.dashboard_history);
  mark(
    "dashboard_history",
    paths.dashboard_history,
    dashHist.length,
    dashHist.length > 0 || existsSync(paths.dashboard_history),
    dashHist.length > 0 ? "loaded" : "empty_or_missing",
  );

  const schedHist = loadJsonRecords(paths.scheduling_history);
  mark(
    "scheduling_history",
    paths.scheduling_history,
    schedHist.length,
    schedHist.length > 0 || existsSync(paths.scheduling_history),
    schedHist.length > 0 ? "loaded" : "empty_or_missing",
  );

  const budgetHist = loadJsonRecords(paths.budget_history);
  mark(
    "budget_history",
    paths.budget_history,
    budgetHist.length,
    budgetHist.length > 0 || existsSync(paths.budget_history),
    budgetHist.length > 0 ? "loaded" : "empty_or_missing",
  );

  const portfolioHist = loadJsonRecords(paths.portfolio_history);
  mark(
    "portfolio_history",
    paths.portfolio_history,
    portfolioHist.length,
    portfolioHist.length > 0 || existsSync(paths.portfolio_history),
    portfolioHist.length > 0 ? "loaded" : "empty_or_missing",
  );

  const executions = loadExecutions(cycleLog);
  mark(
    "controller_executions",
    paths.executions,
    executions.length,
    executions.length > 0 || existsSync(paths.executions),
    executions.length > 0 ? "loaded" : "empty_or_missing",
  );

  const healthLatest = tryReadJson(paths.health_report);
  mark(
    "health_report",
    paths.health_report,
    healthLatest ? 1 : 0,
    Boolean(healthLatest),
    healthLatest ? "loaded" : "missing",
  );

  const autoEvents = countAutonomousHistoryEvents(cycleLog);
  mark(
    "autonomous_history",
    paths.autonomous_sessions,
    autoEvents,
    autoEvents > 0 || existsSync(paths.autonomous_sessions),
    autoEvents > 0 ? "loaded" : "empty_or_missing",
  );

  const dashLatest =
    tryReadJson(paths.dashboard_latest) ??
    tryReadJson(join(cycleLog, "operations-dashboard.json"));

  // --- Metrics ---
  const completed = executions.filter((e) => e.stop_reason === "completed");
  const skippedOrFailed = executions.filter(
    (e) =>
      e.stop_reason === "health_unhealthy" ||
      e.stop_reason === "budget_denied" ||
      e.stop_reason === "fatal_error" ||
      e.stop_reason === "live_refused",
  );
  const healthFails = executions.filter(
    (e) => e.stop_reason === "health_unhealthy",
  );
  const budgetDeniesExec = executions.filter(
    (e) => e.stop_reason === "budget_denied",
  );
  const budgetDeniesHist = budgetHist.filter((b) => b.decision === "DENY");

  const prodByDay = groupCountByDay(
    completed.map((e) => ({ day: dayKey(e.finished_at) })),
  );
  const skipByDay = groupCountByDay(
    skippedOrFailed.map((e) => ({ day: dayKey(e.finished_at) })),
  );
  const daysObserved = new Set<string>([
    ...prodByDay.keys(),
    ...skipByDay.keys(),
  ]);
  // Also count dashboard trend days if present
  const trend = dashLatest?.trends as
    | {
        daily_production?: Array<{ day: string; value: number }>;
        daily_skipped_cycles?: Array<{ day: string; value: number }>;
      }
    | undefined;
  if (trend?.daily_production) {
    for (const p of trend.daily_production) {
      if (p.value > 0) daysObserved.add(p.day);
    }
  }

  const windowDays = Math.max(1, daysObserved.size);
  const average_production_per_day = avg([...prodByDay.values()]);
  const average_skipped_cycles_per_day = avg([...skipByDay.values()]);

  // Prefer dashboard trends when executions sparse
  let avgProd = average_production_per_day;
  let avgSkip = average_skipped_cycles_per_day;
  if (prodByDay.size === 0 && trend?.daily_production?.length) {
    avgProd = avg(trend.daily_production.map((p) => p.value));
  }
  if (skipByDay.size === 0 && trend?.daily_skipped_cycles?.length) {
    avgSkip = avg(trend.daily_skipped_cycles.map((p) => p.value));
  }

  const budgetDenyTotal = budgetDeniesHist.length + budgetDeniesExec.length;
  const budget_denial_frequency = Number(
    (
      budgetDenyTotal /
      Math.max(budgetHist.length + executions.length, 1)
    ).toFixed(4),
  );

  const dashUnhealthy = dashHist.filter((d) => {
    const h = d.system_health as { status?: string } | undefined;
    return h?.status === "UNHEALTHY";
  }).length;

  const health_failure_frequency =
    ratio(healthFails.length + dashUnhealthy, Math.max(executions.length + dashHist.length, 1)) ??
    0;

  let queue_saturation_ratio: number | null = null;
  const fq = dashLatest?.founder_queue as { waiting?: number } | undefined;
  const sh = dashLatest?.system_health as
    | { queue_waiting?: number; queue_max?: number }
    | undefined;
  const waiting =
    typeof fq?.waiting === "number"
      ? fq.waiting
      : typeof sh?.queue_waiting === "number"
        ? sh.queue_waiting
        : typeof healthLatest?.queue_waiting === "number"
          ? healthLatest.queue_waiting
          : null;
  const qmax =
    typeof sh?.queue_max === "number"
      ? sh.queue_max
      : typeof healthLatest?.queue_max === "number"
        ? healthLatest.queue_max
        : null;
  if (waiting !== null && qmax !== null && qmax > 0) {
    queue_saturation_ratio = Number((waiting / qmax).toFixed(4));
  }

  const candidate_throughput_total = executions.reduce(
    (s, e) => s + e.candidate_count,
    0,
  );

  const portfolioScores = portfolioHist
    .map((p) =>
      typeof p.coverage_score === "number" ? p.coverage_score : null,
    )
    .filter((n): n is number => n !== null);
  const portfolio_score_latest =
    portfolioScores.length > 0
      ? portfolioScores[portfolioScores.length - 1]!
      : typeof dashLatest?.portfolio_score === "number"
        ? dashLatest.portfolio_score
        : null;
  const portfolio_score_trend_delta =
    portfolioScores.length >= 2
      ? Number(
          (
            portfolioScores[portfolioScores.length - 1]! -
            portfolioScores[0]!
          ).toFixed(4),
        )
      : null;
  const portfolio_growth_delta = portfolio_score_trend_delta;

  const schedDecisions = schedHist.map((s) =>
    typeof s.decision === "string" ? s.decision : null,
  );
  const runSoon = schedDecisions.filter((d) => d === "RUN_SOON").length;
  const pause = schedDecisions.filter((d) => d === "PAUSE").length;
  const schedule_efficiency_run_soon_ratio = ratio(
    runSoon,
    schedDecisions.length,
  );
  const schedule_pause_ratio = ratio(pause, schedDecisions.length);

  const controller_success_rate = ratio(
    completed.length,
    executions.length,
  );

  const analysis: OperationalAnalysisMetrics = {
    average_production_per_day: avgProd,
    average_skipped_cycles_per_day: avgSkip,
    budget_denial_frequency,
    health_failure_frequency,
    queue_saturation_ratio,
    candidate_throughput_total,
    portfolio_growth_delta,
    portfolio_score_latest,
    portfolio_score_trend_delta,
    schedule_efficiency_run_soon_ratio,
    schedule_pause_ratio,
    controller_success_rate,
    execution_count: executions.length,
    completed_executions: completed.length,
    skipped_or_failed_executions: skippedOrFailed.length,
    budget_history_count: budgetHist.length,
    health_unhealthy_count: healthFails.length + dashUnhealthy,
    schedule_history_count: schedHist.length,
    dashboard_history_count: dashHist.length,
    autonomous_history_events: autoEvents,
    window_days_observed: windowDays,
  };

  const recommendations = buildRecommendations(analysis);
  const missing_sources = sources
    .filter((s) => !s.available || s.records === 0)
    .map((s) => s.id);

  mkdirSync(join(cycleLog, "advisor", "history"), { recursive: true });
  const stamp = generated_at.replace(/[:.]/g, "-");
  const history_path_abs = join(
    cycleLog,
    "advisor",
    "history",
    `advice-${stamp}.json`,
  );
  const report_path_abs = join(
    cycleLog,
    "advisor",
    "operational-policy-advice.json",
  );
  const flat_path_abs = join(cycleLog, "operational-policy-advice.json");

  const report: OperationalPolicyAdviceReport = {
    schema_version: 1,
    advisor_version: ADVISOR_VERSION,
    generated_at,
    analysis,
    recommendations,
    recommendation_count: recommendations.length,
    sources,
    missing_sources,
    advisory_only: true,
    policies_modified: false,
    scheduling_modified: false,
    budget_modified: false,
    strategy_modified: false,
    production_triggered: false,
    publication_allowed: false,
    live: false,
    openai_called: false,
    report_path: relative(repoRoot, report_path_abs).replace(/\\/g, "/"),
    history_path: relative(repoRoot, history_path_abs).replace(/\\/g, "/"),
    duration_ms: Number((performance.now() - t0).toFixed(2)),
  };

  if (opts?.persist !== false) {
    // Only write advisor artifacts — never mutate upstream policies/reports.
    atomicWriteJson(report_path_abs, report);
    atomicWriteJson(flat_path_abs, report);
    atomicWriteJson(history_path_abs, report);
  }

  return report;
}

export function adviceFingerprint(
  report: OperationalPolicyAdviceReport,
): string {
  const {
    generated_at: _g,
    duration_ms: _d,
    history_path: _h,
    report_path: _r,
    ...rest
  } = report;
  return JSON.stringify(rest);
}
