/**
 * Canonical Operations Dashboard — Agent #219.
 * Read-only aggregation of operational reports. Never produces, plans, or calls OpenAI.
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
import {
  listCandidateManifests,
  type CandidateManifest,
} from "./CandidateStore.js";
import { countFounderReviewWaiting } from "../founder-review/FounderReviewProjection.js";
import {
  countDailyCandidates,
  countDailyExecutions,
} from "./ResourceBudgetGovernor.js";

const REPO = resolve(import.meta.dirname, "../../../..");
const CYCLE_LOG = join(REPO, "SOS/07_LOGS/saios/first-production-cycle");
export const DASHBOARD_LOG_ROOT = join(CYCLE_LOG, "operations-dashboard");
export const DASHBOARD_HISTORY_ROOT = join(DASHBOARD_LOG_ROOT, "history");
export const OPERATIONS_DASHBOARD_PATH = join(
  DASHBOARD_LOG_ROOT,
  "operations-dashboard.json",
);
export const OPERATIONS_DASHBOARD_FLAT = join(
  CYCLE_LOG,
  "operations-dashboard.json",
);

export const DASHBOARD_VERSION = 1 as const;

export type SourceStatus = {
  id: string;
  path: string;
  available: boolean;
  detail: string;
};

export type TrendPoint = {
  day: string;
  value: number;
};

export type OperationsTrends = {
  daily_production: TrendPoint[];
  daily_skipped_cycles: TrendPoint[];
  health_failures: TrendPoint[];
  budget_denials: TrendPoint[];
  candidate_growth: TrendPoint[];
  portfolio_score_trend: TrendPoint[];
  window_days: number;
};

export type OperationsDashboardReport = {
  schema_version: typeof DASHBOARD_VERSION;
  dashboard_version: typeof DASHBOARD_VERSION;
  generated_at: string;
  day_utc: string;
  system_health: {
    available: boolean;
    status: string | null;
    timestamp: string | null;
    failed_checks: string[];
    queue_waiting: number | null;
    queue_max: number | null;
  };
  autonomous_status: {
    available: boolean;
    state: string | null;
    session_id: string | null;
    running: boolean | null;
    busy: boolean | null;
    last_execution_id: string | null;
    detail: string | null;
  };
  today_cycles: number;
  today_candidates: number;
  budget_status: {
    available: boolean;
    decision: string | null;
    timestamp: string | null;
    violation_count: number;
    violation_codes: string[];
  };
  portfolio_score: number | null;
  strategy_version: number | null;
  founder_queue: {
    waiting: number;
    source: string;
  };
  candidate_totals: {
    total: number;
    by_status: Record<string, number>;
    waiting_founder: number;
    critic_blocked: number;
    failed: number;
  };
  last_execution: {
    available: boolean;
    execution_id: string | null;
    stop_reason: string | null;
    finished_at: string | null;
    health_status: string | null;
    budget_decision: string | null;
    candidate_count: number | null;
    report_path: string | null;
  };
  last_failure: {
    available: boolean;
    execution_id: string | null;
    stop_reason: string | null;
    finished_at: string | null;
    stop_detail: string | null;
  };
  active_policy_versions: {
    budget_governor: number | null;
    strategy_engine: number | null;
    portfolio_planner: number | null;
    health_gate: string | null;
    dashboard: typeof DASHBOARD_VERSION;
  };
  trends: OperationsTrends;
  sources: SourceStatus[];
  missing_sources: string[];
  publication_allowed: false;
  live: false;
  openai_called: false;
  production_triggered: false;
  read_only: true;
  report_path: string;
  history_path: string;
  duration_ms: number;
};

export type BuildOperationsDashboardOptions = {
  repoRoot?: string;
  cycleLog?: string;
  persist?: boolean;
  now?: Date;
  trend_window_days?: number;
};

function atomicWriteJson(path: string, data: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  const tmp = `${path}.${process.pid}.${Date.now()}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  renameSync(tmp, path);
}

function tryReadJson(path: string): {
  ok: boolean;
  data?: Record<string, unknown>;
  detail: string;
} {
  if (!existsSync(path)) {
    return { ok: false, detail: "missing" };
  }
  try {
    const data = JSON.parse(readFileSync(path, "utf8")) as Record<
      string,
      unknown
    >;
    return { ok: true, data, detail: "readable" };
  } catch (e) {
    return {
      ok: false,
      detail: e instanceof Error ? e.message : String(e),
    };
  }
}

function dayUtc(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addDaysUtc(day: string, delta: number): string {
  const [y, m, dd] = day.split("-").map(Number);
  const dt = new Date(Date.UTC(y!, m! - 1, dd! + delta));
  return dt.toISOString().slice(0, 10);
}

function summarizeCandidates(manifests: CandidateManifest[]): {
  total: number;
  by_status: Record<string, number>;
  waiting_founder: number;
  critic_blocked: number;
  failed: number;
} {
  const by_status: Record<string, number> = {};
  for (const m of manifests) {
    const s = (m.status ?? "UNKNOWN") as string;
    by_status[s] = (by_status[s] ?? 0) + 1;
  }
  return {
    total: manifests.length,
    by_status,
    waiting_founder: by_status["WAITING_FOUNDER"] ?? 0,
    critic_blocked: by_status["CRITIC_BLOCKED"] ?? 0,
    failed: by_status["FAILED"] ?? 0,
  };
}

type ExecLite = {
  execution_id: string;
  stop_reason: string | null;
  finished_at: string | null;
  started_at: string | null;
  health_status: string | null;
  budget_decision: string | null;
  candidate_count: number | null;
  report_path: string | null;
  stop_detail: string | null;
  failure: boolean;
};

function loadExecutions(cycleLog: string): ExecLite[] {
  const root = join(cycleLog, "executions");
  if (!existsSync(root)) return [];
  const out: ExecLite[] = [];
  for (const name of readdirSync(root).sort()) {
    if (!name.startsWith("exec-")) continue;
    const reportPath = join(root, name, "execution-report.json");
    const raw = tryReadJson(reportPath);
    if (!raw.ok || !raw.data) continue;
    const d = raw.data;
    const stop = typeof d.stop_reason === "string" ? d.stop_reason : null;
    const failure =
      stop !== null &&
      stop !== "completed" &&
      stop !== "batch_stopped";
    out.push({
      execution_id:
        typeof d.execution_id === "string" ? d.execution_id : name,
      stop_reason: stop,
      finished_at:
        typeof d.finished_at === "string" ? d.finished_at : null,
      started_at: typeof d.started_at === "string" ? d.started_at : null,
      health_status:
        typeof d.health === "object" &&
        d.health &&
        typeof (d.health as { status?: unknown }).status === "string"
          ? ((d.health as { status: string }).status)
          : typeof d.health_status === "string"
            ? d.health_status
            : null,
      budget_decision:
        typeof d.budget === "object" &&
        d.budget &&
        typeof (d.budget as { decision?: unknown }).decision === "string"
          ? ((d.budget as { decision: string }).decision)
          : typeof d.budget_decision === "string"
            ? d.budget_decision
            : null,
      candidate_count:
        typeof d.candidate_count === "number" ? d.candidate_count : null,
      report_path: relative(REPO, reportPath).replace(/\\/g, "/"),
      stop_detail:
        typeof d.stop_detail === "string" ? d.stop_detail : null,
      failure:
        failure ||
        stop === "health_unhealthy" ||
        stop === "budget_denied" ||
        stop === "fatal_error" ||
        stop === "live_refused",
    });
  }
  return out;
}

function countByDay(
  items: Array<{ day: string | null }>,
  windowDays: string[],
): TrendPoint[] {
  const map = new Map<string, number>();
  for (const d of windowDays) map.set(d, 0);
  for (const it of items) {
    if (!it.day || !map.has(it.day)) continue;
    map.set(it.day, (map.get(it.day) ?? 0) + 1);
  }
  return windowDays.map((day) => ({ day, value: map.get(day) ?? 0 }));
}

function buildTrends(opts: {
  windowDays: string[];
  executions: ExecLite[];
  manifests: CandidateManifest[];
  portfolioHistoryRoot: string;
  budgetHistoryRoot: string;
}): OperationsTrends {
  const { windowDays, executions, manifests } = opts;

  const production = executions
    .filter((e) => e.stop_reason === "completed")
    .map((e) => ({
      day: (e.finished_at ?? e.started_at)?.slice(0, 10) ?? null,
    }));

  const skipped = executions
    .filter(
      (e) =>
        e.stop_reason === "health_unhealthy" ||
        e.stop_reason === "budget_denied",
    )
    .map((e) => ({
      day: (e.finished_at ?? e.started_at)?.slice(0, 10) ?? null,
    }));

  const healthFails = executions
    .filter((e) => e.stop_reason === "health_unhealthy")
    .map((e) => ({
      day: (e.finished_at ?? e.started_at)?.slice(0, 10) ?? null,
    }));

  // Budget denials from execution stop reasons + budget history files
  const budgetDenyDays: Array<{ day: string | null }> = executions
    .filter((e) => e.stop_reason === "budget_denied")
    .map((e) => ({
      day: (e.finished_at ?? e.started_at)?.slice(0, 10) ?? null,
    }));
  if (existsSync(opts.budgetHistoryRoot)) {
    for (const name of readdirSync(opts.budgetHistoryRoot)) {
      if (!name.endsWith(".json")) continue;
      const raw = tryReadJson(join(opts.budgetHistoryRoot, name));
      if (!raw.ok || !raw.data) continue;
      if (raw.data.decision !== "DENY") continue;
      const ts =
        typeof raw.data.timestamp === "string" ? raw.data.timestamp : null;
      budgetDenyDays.push({ day: ts?.slice(0, 10) ?? null });
    }
  }

  const candidateDays = manifests.map((m) => ({
    day:
      typeof m.created_at === "string" ? m.created_at.slice(0, 10) : null,
  }));

  // Portfolio score: last score per day from history (or latest report)
  const scoreByDay = new Map<string, number>();
  if (existsSync(opts.portfolioHistoryRoot)) {
    const files = readdirSync(opts.portfolioHistoryRoot)
      .filter((f) => f.endsWith(".json"))
      .sort();
    for (const name of files) {
      const raw = tryReadJson(join(opts.portfolioHistoryRoot, name));
      if (!raw.ok || !raw.data) continue;
      const score =
        typeof raw.data.coverage_score === "number"
          ? raw.data.coverage_score
          : null;
      const ts =
        typeof raw.data.generated_at === "string"
          ? raw.data.generated_at
          : null;
      if (score === null || !ts) continue;
      const day = ts.slice(0, 10);
      if (windowDays.includes(day)) scoreByDay.set(day, score);
    }
  }

  return {
    daily_production: countByDay(production, windowDays),
    daily_skipped_cycles: countByDay(skipped, windowDays),
    health_failures: countByDay(healthFails, windowDays),
    budget_denials: countByDay(budgetDenyDays, windowDays),
    candidate_growth: countByDay(candidateDays, windowDays),
    portfolio_score_trend: windowDays.map((day) => ({
      day,
      value: scoreByDay.get(day) ?? 0,
    })),
    window_days: windowDays.length,
  };
}

/**
 * Build the canonical operations dashboard (read-only aggregation).
 */
export function buildOperationsDashboard(
  opts?: BuildOperationsDashboardOptions,
): OperationsDashboardReport {
  const t0 = performance.now();
  const now = opts?.now ?? new Date();
  const generated_at = now.toISOString();
  const day = dayUtc(now);
  const repoRoot = opts?.repoRoot ?? REPO;
  const cycleLog = opts?.cycleLog ?? CYCLE_LOG;
  const window = Math.max(1, Math.min(30, opts?.trend_window_days ?? 7));
  const windowDays: string[] = [];
  for (let i = window - 1; i >= 0; i--) {
    windowDays.push(addDaysUtc(day, -i));
  }

  const paths = {
    health: join(cycleLog, "health-report.json"),
    execution_latest: join(cycleLog, "latest-execution.json"),
    execution_report: join(cycleLog, "execution-report.json"),
    autonomous: join(cycleLog, "autonomous", "status.json"),
    autonomous_flat: join(cycleLog, "autonomous-status.json"),
    portfolio: join(cycleLog, "portfolio", "portfolio-report.json"),
    portfolio_flat: join(cycleLog, "portfolio-report.json"),
    strategy: join(cycleLog, "strategy", "production-strategy.json"),
    strategy_flat: join(cycleLog, "production-strategy.json"),
    budget: join(cycleLog, "budget", "budget-governor-report.json"),
    budget_flat: join(cycleLog, "budget-governor-report.json"),
  };

  const sources: SourceStatus[] = [];
  const mark = (
    id: string,
    path: string,
    result: { ok: boolean; detail: string },
  ): void => {
    sources.push({
      id,
      path: relative(repoRoot, path).replace(/\\/g, "/"),
      available: result.ok,
      detail: result.detail,
    });
  };

  const healthRaw = tryReadJson(paths.health);
  mark("health", paths.health, healthRaw);

  let autonomousRaw = tryReadJson(paths.autonomous);
  if (!autonomousRaw.ok) autonomousRaw = tryReadJson(paths.autonomous_flat);
  mark(
    "autonomous",
    autonomousRaw.ok ? paths.autonomous : paths.autonomous_flat,
    autonomousRaw,
  );

  let portfolioRaw = tryReadJson(paths.portfolio);
  if (!portfolioRaw.ok) portfolioRaw = tryReadJson(paths.portfolio_flat);
  mark(
    "portfolio",
    portfolioRaw.ok ? paths.portfolio : paths.portfolio_flat,
    portfolioRaw,
  );

  let strategyRaw = tryReadJson(paths.strategy);
  if (!strategyRaw.ok) strategyRaw = tryReadJson(paths.strategy_flat);
  mark(
    "strategy",
    strategyRaw.ok ? paths.strategy : paths.strategy_flat,
    strategyRaw,
  );

  let budgetRaw = tryReadJson(paths.budget);
  if (!budgetRaw.ok) budgetRaw = tryReadJson(paths.budget_flat);
  mark(
    "budget",
    budgetRaw.ok ? paths.budget : paths.budget_flat,
    budgetRaw,
  );

  const latestExecRaw = tryReadJson(paths.execution_latest);
  mark("latest_execution", paths.execution_latest, latestExecRaw);

  const manifests = existsSync(join(cycleLog, "candidates"))
    ? listCandidateManifests(cycleLog)
    : [];
  const candidate_totals = summarizeCandidates(manifests);
  const founder_waiting = existsSync(join(cycleLog, "candidates"))
    ? countFounderReviewWaiting(REPO)
    : 0;

  const execRoot = join(cycleLog, "executions");
  const today_cycles = countDailyExecutions(execRoot, day);
  const today_candidates = countDailyCandidates(cycleLog, day);

  const executions = loadExecutions(cycleLog);
  const last_execution_full =
    executions.length > 0 ? executions[executions.length - 1]! : null;
  // Prefer latest-execution pointer when present
  let last_execution = {
    available: false,
    execution_id: null as string | null,
    stop_reason: null as string | null,
    finished_at: null as string | null,
    health_status: null as string | null,
    budget_decision: null as string | null,
    candidate_count: null as number | null,
    report_path: null as string | null,
  };
  if (latestExecRaw.ok && latestExecRaw.data) {
    const d = latestExecRaw.data;
    last_execution = {
      available: true,
      execution_id:
        typeof d.execution_id === "string" ? d.execution_id : null,
      stop_reason:
        typeof d.stop_reason === "string" ? d.stop_reason : null,
      finished_at:
        typeof d.finished_at === "string" ? d.finished_at : null,
      health_status:
        typeof d.health_status === "string" ? d.health_status : null,
      budget_decision:
        typeof d.budget_decision === "string" ? d.budget_decision : null,
      candidate_count:
        typeof d.candidate_count === "number" ? d.candidate_count : null,
      report_path:
        typeof d.report_path === "string" ? d.report_path : null,
    };
  } else if (last_execution_full) {
    last_execution = {
      available: true,
      execution_id: last_execution_full.execution_id,
      stop_reason: last_execution_full.stop_reason,
      finished_at: last_execution_full.finished_at,
      health_status: last_execution_full.health_status,
      budget_decision: last_execution_full.budget_decision,
      candidate_count: last_execution_full.candidate_count,
      report_path: last_execution_full.report_path,
    };
  }

  const failures = executions.filter((e) => e.failure);
  const lastFail = failures.length ? failures[failures.length - 1]! : null;

  const health = healthRaw.data;
  const budget = budgetRaw.data;
  const portfolio = portfolioRaw.data;
  const strategy = strategyRaw.data;
  const autonomous = autonomousRaw.data;

  const portfolioHistoryRoot = join(cycleLog, "portfolio", "history");
  const budgetHistoryRoot = join(cycleLog, "budget", "history");

  const trends = buildTrends({
    windowDays,
    executions,
    manifests,
    portfolioHistoryRoot,
    budgetHistoryRoot,
  });

  // If portfolio history empty but live portfolio exists, seed today's trend
  if (
    portfolioRaw.ok &&
    typeof portfolio?.coverage_score === "number" &&
    trends.portfolio_score_trend.every((p) => p.value === 0)
  ) {
    const todayPoint = trends.portfolio_score_trend.find((p) => p.day === day);
    if (todayPoint) todayPoint.value = portfolio.coverage_score;
  }

  mkdirSync(join(cycleLog, "operations-dashboard", "history"), {
    recursive: true,
  });
  const stamp = generated_at.replace(/[:.]/g, "-");
  const history_path_abs = join(
    cycleLog,
    "operations-dashboard",
    "history",
    `dashboard-${stamp}.json`,
  );
  const report_path_abs = join(
    cycleLog,
    "operations-dashboard",
    "operations-dashboard.json",
  );
  const flat_path_abs = join(cycleLog, "operations-dashboard.json");

  const missing_sources = sources
    .filter((s) => !s.available)
    .map((s) => s.id);

  const report: OperationsDashboardReport = {
    schema_version: DASHBOARD_VERSION,
    dashboard_version: DASHBOARD_VERSION,
    generated_at,
    day_utc: day,
    system_health: {
      available: healthRaw.ok,
      status:
        typeof health?.status === "string" ? health.status : null,
      timestamp:
        typeof health?.timestamp === "string" ? health.timestamp : null,
      failed_checks: Array.isArray(health?.failed_checks)
        ? (health.failed_checks as string[])
        : [],
      queue_waiting:
        typeof health?.queue_waiting === "number"
          ? health.queue_waiting
          : null,
      queue_max:
        typeof health?.queue_max === "number" ? health.queue_max : null,
    },
    autonomous_status: {
      available: autonomousRaw.ok,
      state: typeof autonomous?.state === "string" ? autonomous.state : null,
      session_id:
        typeof autonomous?.session_id === "string"
          ? autonomous.session_id
          : null,
      running:
        typeof autonomous?.running === "boolean"
          ? autonomous.running
          : null,
      busy:
        typeof autonomous?.busy === "boolean" ? autonomous.busy : null,
      last_execution_id:
        typeof autonomous?.last_execution_id === "string"
          ? autonomous.last_execution_id
          : null,
      detail:
        typeof autonomous?.detail === "string" ? autonomous.detail : null,
    },
    today_cycles,
    today_candidates,
    budget_status: {
      available: budgetRaw.ok,
      decision:
        typeof budget?.decision === "string" ? budget.decision : null,
      timestamp:
        typeof budget?.timestamp === "string" ? budget.timestamp : null,
      violation_count: Array.isArray(budget?.violations)
        ? budget.violations.length
        : 0,
      violation_codes: Array.isArray(budget?.violations)
        ? (budget.violations as Array<{ code?: string }>)
            .map((v) => v.code)
            .filter((c): c is string => typeof c === "string")
        : [],
    },
    portfolio_score:
      typeof portfolio?.coverage_score === "number"
        ? portfolio.coverage_score
        : typeof strategy?.portfolio_score === "number"
          ? strategy.portfolio_score
          : null,
    strategy_version:
      typeof strategy?.strategy_version === "number"
        ? strategy.strategy_version
        : typeof strategy?.schema_version === "number"
          ? strategy.schema_version
          : null,
    founder_queue: {
      waiting: founder_waiting,
      source: "candidate_registry",
    },
    candidate_totals,
    last_execution,
    last_failure: {
      available: Boolean(lastFail),
      execution_id: lastFail?.execution_id ?? null,
      stop_reason: lastFail?.stop_reason ?? null,
      finished_at: lastFail?.finished_at ?? null,
      stop_detail: lastFail?.stop_detail ?? null,
    },
    active_policy_versions: {
      budget_governor:
        typeof budget?.governor_version === "number"
          ? budget.governor_version
          : typeof budget?.schema_version === "number"
            ? budget.schema_version
            : null,
      strategy_engine:
        typeof strategy?.strategy_version === "number"
          ? strategy.strategy_version
          : null,
      portfolio_planner:
        typeof portfolio?.planner_version === "number"
          ? portfolio.planner_version
          : typeof portfolio?.schema_version === "number"
            ? portfolio.schema_version
            : null,
      health_gate:
        typeof health?.agent === "string"
          ? health.agent
          : healthRaw.ok
            ? "212"
            : null,
      dashboard: DASHBOARD_VERSION,
    },
    trends,
    sources,
    missing_sources,
    publication_allowed: false,
    live: false,
    openai_called: false,
    production_triggered: false,
    read_only: true,
    report_path: relative(repoRoot, report_path_abs).replace(/\\/g, "/"),
    history_path: relative(repoRoot, history_path_abs).replace(/\\/g, "/"),
    duration_ms: Number((performance.now() - t0).toFixed(2)),
  };

  if (opts?.persist !== false) {
    // Only write dashboard artifacts — never mutate upstream reports.
    atomicWriteJson(report_path_abs, report);
    atomicWriteJson(flat_path_abs, report);
    atomicWriteJson(history_path_abs, report);
  }

  return report;
}

/** Strip volatile fields for deterministic comparison. */
export function dashboardFingerprint(
  report: OperationsDashboardReport,
): string {
  const { generated_at: _g, duration_ms: _d, history_path: _h, ...rest } =
    report;
  return JSON.stringify(rest);
}
