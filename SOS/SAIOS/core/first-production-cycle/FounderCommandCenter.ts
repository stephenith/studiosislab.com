/**
 * Canonical Founder Command Center snapshot — Agent #222A.
 * Read-only aggregation of spine reports. Never generates, evaluates, executes, or mutates.
 */
import { existsSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { listCandidateManifests } from "./CandidateStore.js";
import { summarizeFounderReviewProjection } from "../founder-review/FounderReviewProjection.js";

const REPO = resolve(import.meta.dirname, "../../../..");

/** Freshness window for CURRENT vs STALE (minutes). */
export const FCC_STALE_MINUTES = 60;

export type FreshnessStatus =
  | "current"
  | "stale"
  | "missing"
  | "unavailable";

export type FreshnessMeta = {
  status: FreshnessStatus;
  source_path: string | null;
  generated_at: string | null;
  age_minutes: number | null;
  detail: string;
};

export type FccSection<T> = {
  freshness: FreshnessMeta;
  data: T | null;
};

export type FounderCommandCenterSnapshot = {
  schema_version: 1;
  agent: "222A";
  generated_at: string;
  read_only: true;
  advisory_only: true;
  mutations: false;
  production_triggered: false;
  openai_called: false;
  safety: {
    live: false;
    live_label: "LIVE OFF";
    publication_allowed: false;
    publication_label: "Publication Disabled";
    founder_approval_required: true;
    production_entry: "ProductionController";
    runtime_guard_present: boolean;
    runtime_guard_detail: string;
  };
  factory: FccSection<{
    autonomous_state: string | null;
    autonomous_running: boolean | null;
    session_id: string | null;
  }>;
  autonomous: FccSection<{
    state: string | null;
    running: boolean | null;
    busy: boolean | null;
    iterations: number | null;
    interval_ms: number | null;
    adaptive_scheduling_enabled: boolean | null;
    scheduling_decision: string | null;
    next_interval_ms: number | null;
    next_evaluation_at: string | null;
    last_execution_id: string | null;
  }>;
  health: FccSection<{
    status: string | null;
    failed_checks: string[];
    queue_waiting: number | null;
    queue_max: number | null;
  }>;
  budget: FccSection<{
    decision: string | null;
    violation_codes: string[];
    daily_cycles: number | null;
    daily_candidates: number | null;
  }>;
  scheduling: FccSection<{
    decision: string | null;
    next_interval_ms: number | null;
    reason_codes: string[];
    cooldown_active: boolean | null;
  }>;
  operations: FccSection<{
    today_cycles: number | null;
    today_candidates: number | null;
    portfolio_score: number | null;
    strategy_version: number | null;
    founder_queue_waiting: number | null;
  }>;
  founder_queue: FccSection<{
    waiting_founder: number;
    total_candidates: number;
    by_status: Record<string, number>;
  }>;
  portfolio: FccSection<{
    coverage_score: number | null;
    candidate_total: number | null;
    recommendation_count: number | null;
  }>;
  strategy: FccSection<{
    strategy_version: number | null;
    recommendation_count: number | null;
    portfolio_score: number | null;
  }>;
  advisor: FccSection<{
    recommendation_count: number | null;
    top_ids: string[];
  }>;
  engineering: FccSection<{
    overall: number | null;
    scores: Record<string, number> | null;
    open_count: number | null;
    severity_summary: {
      critical: number;
      high: number;
      medium: number;
      low: number;
    } | null;
    generated_at: string | null;
  }>;
  last_execution: FccSection<{
    execution_id: string | null;
    stop_reason: string | null;
    finished_at: string | null;
    health_status: string | null;
    budget_decision: string | null;
    candidate_count: number | null;
  }>;
  last_failure: FccSection<{
    execution_id: string | null;
    stop_reason: string | null;
    finished_at: string | null;
    stop_detail: string | null;
  }>;
  reports_index: Array<{
    id: string;
    label: string;
    path: string;
    available: boolean;
  }>;
  legacy: {
    founder_control_center: "Legacy (Non-Canonical)";
    founder_dashboard_runtime: "Legacy (Non-Canonical)";
    react_founder_review: "Canonical";
  };
  duration_ms: number;
};

/** Explicit allowlist — navigation only, no filesystem explorer. */
export const FCC_REPORT_ALLOWLIST: Array<{
  id: string;
  label: string;
  path: string;
}> = [
  {
    id: "operations-dashboard",
    label: "Operations Dashboard",
    path: "SOS/07_LOGS/saios/first-production-cycle/operations-dashboard/operations-dashboard.json",
  },
  {
    id: "health-report",
    label: "Health Report",
    path: "SOS/07_LOGS/saios/first-production-cycle/health-report.json",
  },
  {
    id: "budget-report",
    label: "Budget Governor Report",
    path: "SOS/07_LOGS/saios/first-production-cycle/budget/budget-governor-report.json",
  },
  {
    id: "schedule-report",
    label: "Adaptive Schedule Report",
    path: "SOS/07_LOGS/saios/first-production-cycle/scheduling/adaptive-schedule-report.json",
  },
  {
    id: "portfolio-report",
    label: "Portfolio Report",
    path: "SOS/07_LOGS/saios/first-production-cycle/portfolio/portfolio-report.json",
  },
  {
    id: "strategy-report",
    label: "Production Strategy",
    path: "SOS/07_LOGS/saios/first-production-cycle/strategy/production-strategy.json",
  },
  {
    id: "advisor-report",
    label: "Operational Policy Advice",
    path: "SOS/07_LOGS/saios/first-production-cycle/advisor/operational-policy-advice.json",
  },
  {
    id: "engineering-intelligence",
    label: "Engineering Intelligence",
    path: "SOS/07_LOGS/saios/engineering-intelligence/engineering-intelligence-report.json",
  },
  {
    id: "execution-report",
    label: "Latest Execution Report",
    path: "SOS/07_LOGS/saios/first-production-cycle/execution-report.json",
  },
  {
    id: "autonomous-status",
    label: "Autonomous Status",
    path: "SOS/07_LOGS/saios/first-production-cycle/autonomous/status.json",
  },
  {
    id: "fcc-audit",
    label: "Command Center Architecture Audit",
    path: "SOS/09_REPORTS/AIOS_FOUNDER_COMMAND_CENTER_ARCHITECTURE_AUDIT.md",
  },
];

function tryReadJson(
  absPath: string,
): { ok: true; data: Record<string, unknown> } | { ok: false; detail: string } {
  if (!existsSync(absPath)) return { ok: false, detail: "missing" };
  try {
    const data = JSON.parse(readFileSync(absPath, "utf8")) as Record<
      string,
      unknown
    >;
    return { ok: true, data };
  } catch (e) {
    return {
      ok: false,
      detail: e instanceof Error ? e.message : String(e),
    };
  }
}

function pickTimestamp(data: Record<string, unknown> | null): string | null {
  if (!data) return null;
  for (const k of [
    "generated_at",
    "timestamp",
    "evaluated_at",
    "updated_at",
    "finished_at",
  ]) {
    if (typeof data[k] === "string") return data[k] as string;
  }
  return null;
}

function freshnessFor(
  absPath: string | null,
  data: Record<string, unknown> | null,
  readOk: boolean,
  readDetail: string,
  now: Date,
  repoRoot: string,
): FreshnessMeta {
  const rel = absPath
    ? relative(repoRoot, absPath).replace(/\\/g, "/")
    : null;
  if (!absPath || readDetail === "missing") {
    return {
      status: "missing",
      source_path: rel,
      generated_at: null,
      age_minutes: null,
      detail: "Report not found — do not treat values as zero",
    };
  }
  if (!readOk || !data) {
    return {
      status: "unavailable",
      source_path: rel,
      generated_at: null,
      age_minutes: null,
      detail: readDetail || "unreadable",
    };
  }
  const generated_at = pickTimestamp(data);
  let age_minutes: number | null = null;
  if (generated_at) {
    const t = Date.parse(generated_at);
    if (Number.isFinite(t)) {
      age_minutes = Number(((now.getTime() - t) / 60000).toFixed(2));
    }
  } else {
    try {
      const mtime = statSync(absPath).mtimeMs;
      age_minutes = Number(((now.getTime() - mtime) / 60000).toFixed(2));
    } catch {
      /* ignore */
    }
  }
  if (age_minutes !== null && age_minutes > FCC_STALE_MINUTES) {
    return {
      status: "stale",
      source_path: rel,
      generated_at,
      age_minutes,
      detail: `Older than ${FCC_STALE_MINUTES}m`,
    };
  }
  return {
    status: "current",
    source_path: rel,
    generated_at,
    age_minutes,
    detail: "Fresh within window",
  };
}

function loadFirst(
  candidates: string[],
): {
  path: string | null;
  data: Record<string, unknown> | null;
  detail: string;
  ok: boolean;
} {
  for (const p of candidates) {
    const r = tryReadJson(p);
    if (r.ok) return { path: p, data: r.data, detail: "ok", ok: true };
    if (r.detail !== "missing") {
      return { path: p, data: null, detail: r.detail, ok: false };
    }
  }
  return {
    path: candidates[0] ?? null,
    data: null,
    detail: "missing",
    ok: false,
  };
}

function sectionFrom<T>(
  loaded: ReturnType<typeof loadFirst>,
  now: Date,
  repoRoot: string,
  map: (data: Record<string, unknown>) => T,
): FccSection<T> {
  const freshness = freshnessFor(
    loaded.path,
    loaded.data,
    loaded.ok,
    loaded.detail,
    now,
    repoRoot,
  );
  if (!loaded.ok || !loaded.data) {
    return { freshness, data: null };
  }
  return { freshness, data: map(loaded.data) };
}

/**
 * Build Founder Command Center snapshot. Read-only. No side effects.
 */
export function buildFounderCommandCenterSnapshot(opts?: {
  repoRoot?: string;
  cycleLog?: string;
  now?: Date;
}): FounderCommandCenterSnapshot {
  const t0 = performance.now();
  const now = opts?.now ?? new Date();
  const repoRoot = opts?.repoRoot ?? REPO;
  const cycleLog = opts?.cycleLog ?? join(repoRoot, "SOS/07_LOGS/saios/first-production-cycle");

  const guardPath = join(repoRoot, "SOS/SAIOS/architecture/runtime-guard.ts");
  let runtime_guard_present = false;
  let runtime_guard_detail = "missing";
  if (existsSync(guardPath)) {
    try {
      const src = readFileSync(guardPath, "utf8");
      runtime_guard_present = src.includes("ENGINES");
      runtime_guard_detail = runtime_guard_present
        ? "Runtime Guard present (ENGINES)"
        : "file present but ENGINES marker missing";
    } catch (e) {
      runtime_guard_detail = e instanceof Error ? e.message : String(e);
    }
  }

  const ops = loadFirst([
    join(cycleLog, "operations-dashboard", "operations-dashboard.json"),
    join(cycleLog, "operations-dashboard.json"),
  ]);
  const auto = loadFirst([
    join(cycleLog, "autonomous", "status.json"),
    join(cycleLog, "autonomous-status.json"),
  ]);
  const health = loadFirst([join(cycleLog, "health-report.json")]);
  const budget = loadFirst([
    join(cycleLog, "budget", "budget-governor-report.json"),
    join(cycleLog, "budget-governor-report.json"),
  ]);
  const schedule = loadFirst([
    join(cycleLog, "scheduling", "adaptive-schedule-report.json"),
    join(cycleLog, "adaptive-schedule-report.json"),
  ]);
  const portfolio = loadFirst([
    join(cycleLog, "portfolio", "portfolio-report.json"),
    join(cycleLog, "portfolio-report.json"),
  ]);
  const strategy = loadFirst([
    join(cycleLog, "strategy", "production-strategy.json"),
    join(cycleLog, "production-strategy.json"),
  ]);
  const advisor = loadFirst([
    join(cycleLog, "advisor", "operational-policy-advice.json"),
    join(cycleLog, "operational-policy-advice.json"),
  ]);
  const engineering = loadFirst([
    join(
      repoRoot,
      "SOS/07_LOGS/saios/engineering-intelligence/engineering-intelligence-report.json",
    ),
  ]);
  const latestExec = loadFirst([
    join(cycleLog, "latest-execution.json"),
    join(cycleLog, "execution-report.json"),
  ]);

  // Candidate registry summary (read-only)
  let founderQueueData: FounderCommandCenterSnapshot["founder_queue"]["data"] =
    null;
  let founderFresh: FreshnessMeta;
  const candRoot = join(cycleLog, "candidates");
  if (!existsSync(candRoot)) {
    founderFresh = {
      status: "missing",
      source_path: relative(repoRoot, candRoot).replace(/\\/g, "/"),
      generated_at: null,
      age_minutes: null,
      detail: "Resume template registry root missing",
    };
  } else {
    try {
      const manifests = listCandidateManifests(cycleLog);
      const projection = summarizeFounderReviewProjection(repoRoot);
      const by_status: Record<string, number> = {};
      // Registry inventory statuses (storage) — not Ready-for-Review.
      for (const m of manifests) {
        const s = String(m.status ?? "UNKNOWN");
        by_status[s] = (by_status[s] ?? 0) + 1;
      }
      // Canonical Founder Review projection statuses (actionable).
      by_status.waiting_founder = projection.waiting;
      by_status.approved = projection.approved;
      by_status.rejected = projection.rejected;
      by_status.changes_requested = projection.changes_requested;
      by_status.revision_failed = projection.revision_failed;
      by_status.APPROVED = projection.approved;
      by_status.REJECTED = projection.rejected;
      founderQueueData = {
        waiting_founder: projection.waiting,
        // Registry inventory total (manifests on disk). Ready-for-Review is waiting_founder.
        total_candidates: manifests.length,
        by_status,
      };
      founderFresh = {
        status: "current",
        source_path: relative(repoRoot, candRoot).replace(/\\/g, "/"),
        generated_at: now.toISOString(),
        age_minutes: 0,
        detail: "Canonical Founder Review projection",
      };
    } catch (e) {
      founderFresh = {
        status: "unavailable",
        source_path: relative(repoRoot, candRoot).replace(/\\/g, "/"),
        generated_at: null,
        age_minutes: null,
        detail: e instanceof Error ? e.message : String(e),
      };
    }
  }

  // Last failure from ops dashboard if present
  const opsFail =
    ops.data?.last_failure && typeof ops.data.last_failure === "object"
      ? (ops.data.last_failure as Record<string, unknown>)
      : null;

  const reports_index = FCC_REPORT_ALLOWLIST.map((r) => ({
    id: r.id,
    label: r.label,
    path: r.path,
    available: existsSync(join(repoRoot, r.path)),
  }));

  const snap: FounderCommandCenterSnapshot = {
    schema_version: 1,
    agent: "222A",
    generated_at: now.toISOString(),
    read_only: true,
    advisory_only: true,
    mutations: false,
    production_triggered: false,
    openai_called: false,
    safety: {
      live: false,
      live_label: "LIVE OFF",
      publication_allowed: false,
      publication_label: "Publication Disabled",
      founder_approval_required: true,
      production_entry: "ProductionController",
      runtime_guard_present,
      runtime_guard_detail,
    },
    factory: sectionFrom(auto, now, repoRoot, (d) => ({
      autonomous_state: typeof d.state === "string" ? d.state : null,
      autonomous_running: typeof d.running === "boolean" ? d.running : null,
      session_id: typeof d.session_id === "string" ? d.session_id : null,
    })),
    autonomous: sectionFrom(auto, now, repoRoot, (d) => {
      const sch =
        d.scheduling && typeof d.scheduling === "object"
          ? (d.scheduling as Record<string, unknown>)
          : null;
      return {
        state: typeof d.state === "string" ? d.state : null,
        running: typeof d.running === "boolean" ? d.running : null,
        busy: typeof d.busy === "boolean" ? d.busy : null,
        iterations: typeof d.iterations === "number" ? d.iterations : null,
        interval_ms: typeof d.interval_ms === "number" ? d.interval_ms : null,
        adaptive_scheduling_enabled:
          typeof d.adaptive_scheduling_enabled === "boolean"
            ? d.adaptive_scheduling_enabled
            : null,
        scheduling_decision:
          typeof sch?.decision === "string" ? sch.decision : null,
        next_interval_ms:
          typeof sch?.next_interval_ms === "number"
            ? sch.next_interval_ms
            : null,
        next_evaluation_at:
          typeof sch?.next_evaluation_at === "string"
            ? sch.next_evaluation_at
            : null,
        last_execution_id:
          typeof d.last_execution_id === "string" ? d.last_execution_id : null,
      };
    }),
    health: sectionFrom(health, now, repoRoot, (d) => ({
      status: typeof d.status === "string" ? d.status : null,
      failed_checks: Array.isArray(d.failed_checks)
        ? (d.failed_checks as string[])
        : [],
      queue_waiting:
        typeof d.queue_waiting === "number" ? d.queue_waiting : null,
      queue_max: typeof d.queue_max === "number" ? d.queue_max : null,
    })),
    budget: sectionFrom(budget, now, repoRoot, (d) => {
      const res =
        d.resources && typeof d.resources === "object"
          ? (d.resources as Record<string, unknown>)
          : null;
      return {
        decision: typeof d.decision === "string" ? d.decision : null,
        violation_codes: Array.isArray(d.violations)
          ? (d.violations as Array<{ code?: string }>)
              .map((v) => v.code)
              .filter((c): c is string => typeof c === "string")
          : [],
        daily_cycles:
          typeof res?.daily_cycles === "number" ? res.daily_cycles : null,
        daily_candidates:
          typeof res?.daily_candidates === "number"
            ? res.daily_candidates
            : null,
      };
    }),
    scheduling: sectionFrom(schedule, now, repoRoot, (d) => {
      const cool =
        d.cooldown_state && typeof d.cooldown_state === "object"
          ? (d.cooldown_state as Record<string, unknown>)
          : null;
      return {
        decision: typeof d.decision === "string" ? d.decision : null,
        next_interval_ms:
          typeof d.next_interval_ms === "number" ? d.next_interval_ms : null,
        reason_codes: Array.isArray(d.reason_codes)
          ? (d.reason_codes as string[])
          : [],
        cooldown_active:
          typeof cool?.active === "boolean" ? cool.active : null,
      };
    }),
    operations: sectionFrom(ops, now, repoRoot, (d) => {
      const fq =
        d.founder_queue && typeof d.founder_queue === "object"
          ? (d.founder_queue as Record<string, unknown>)
          : null;
      return {
        today_cycles: typeof d.today_cycles === "number" ? d.today_cycles : null,
        today_candidates:
          typeof d.today_candidates === "number" ? d.today_candidates : null,
        portfolio_score:
          typeof d.portfolio_score === "number" ? d.portfolio_score : null,
        strategy_version:
          typeof d.strategy_version === "number" ? d.strategy_version : null,
        founder_queue_waiting:
          typeof fq?.waiting === "number" ? fq.waiting : null,
      };
    }),
    founder_queue: { freshness: founderFresh, data: founderQueueData },
    portfolio: sectionFrom(portfolio, now, repoRoot, (d) => {
      const totals =
        d.candidate_totals && typeof d.candidate_totals === "object"
          ? (d.candidate_totals as Record<string, unknown>)
          : null;
      return {
        coverage_score:
          typeof d.coverage_score === "number" ? d.coverage_score : null,
        candidate_total:
          typeof totals?.total === "number" ? totals.total : null,
        recommendation_count: Array.isArray(d.recommendations)
          ? d.recommendations.length
          : typeof d.recommendation_count === "number"
            ? d.recommendation_count
            : null,
      };
    }),
    strategy: sectionFrom(strategy, now, repoRoot, (d) => ({
      strategy_version:
        typeof d.strategy_version === "number" ? d.strategy_version : null,
      recommendation_count:
        typeof d.recommendation_count === "number"
          ? d.recommendation_count
          : Array.isArray(d.recommendations)
            ? d.recommendations.length
            : null,
      portfolio_score:
        typeof d.portfolio_score === "number" ? d.portfolio_score : null,
    })),
    advisor: sectionFrom(advisor, now, repoRoot, (d) => {
      const recs = Array.isArray(d.recommendations)
        ? (d.recommendations as Array<{ recommendation_id?: string }>)
        : [];
      return {
        recommendation_count:
          typeof d.recommendation_count === "number"
            ? d.recommendation_count
            : recs.length,
        top_ids: recs
          .slice(0, 5)
          .map((r) => r.recommendation_id)
          .filter((x): x is string => typeof x === "string"),
      };
    }),
    engineering: sectionFrom(engineering, now, repoRoot, (d) => {
      const scores =
        d.scores && typeof d.scores === "object"
          ? (d.scores as Record<string, number>)
          : null;
      const sev =
        d.severity_summary && typeof d.severity_summary === "object"
          ? (d.severity_summary as Record<string, number>)
          : null;
      return {
        overall: typeof scores?.overall === "number" ? scores.overall : null,
        scores,
        open_count: typeof d.open_count === "number" ? d.open_count : null,
        severity_summary: sev
          ? {
              critical: typeof sev.critical === "number" ? sev.critical : 0,
              high: typeof sev.high === "number" ? sev.high : 0,
              medium: typeof sev.medium === "number" ? sev.medium : 0,
              low: typeof sev.low === "number" ? sev.low : 0,
            }
          : null,
        generated_at:
          typeof d.generated_at === "string" ? d.generated_at : null,
      };
    }),
    last_execution: sectionFrom(latestExec, now, repoRoot, (d) => ({
      execution_id:
        typeof d.execution_id === "string" ? d.execution_id : null,
      stop_reason: typeof d.stop_reason === "string" ? d.stop_reason : null,
      finished_at: typeof d.finished_at === "string" ? d.finished_at : null,
      health_status:
        typeof d.health_status === "string"
          ? d.health_status
          : d.health &&
              typeof d.health === "object" &&
              typeof (d.health as { status?: unknown }).status === "string"
            ? ((d.health as { status: string }).status)
            : null,
      budget_decision:
        typeof d.budget_decision === "string"
          ? d.budget_decision
          : d.budget &&
              typeof d.budget === "object" &&
              typeof (d.budget as { decision?: unknown }).decision === "string"
            ? ((d.budget as { decision: string }).decision)
            : null,
      candidate_count:
        typeof d.candidate_count === "number" ? d.candidate_count : null,
    })),
    last_failure: {
      freshness: ops.ok
        ? freshnessFor(ops.path, ops.data, ops.ok, ops.detail, now, repoRoot)
        : {
            status: "missing" as const,
            source_path: null,
            generated_at: null,
            age_minutes: null,
            detail: "No operations dashboard failure projection",
          },
      data:
        opsFail && opsFail.available === true
          ? {
              execution_id:
                typeof opsFail.execution_id === "string"
                  ? opsFail.execution_id
                  : null,
              stop_reason:
                typeof opsFail.stop_reason === "string"
                  ? opsFail.stop_reason
                  : null,
              finished_at:
                typeof opsFail.finished_at === "string"
                  ? opsFail.finished_at
                  : null,
              stop_detail:
                typeof opsFail.stop_detail === "string"
                  ? opsFail.stop_detail
                  : null,
            }
          : null,
    },
    reports_index,
    legacy: {
      founder_control_center: "Legacy (Non-Canonical)",
      founder_dashboard_runtime: "Legacy (Non-Canonical)",
      react_founder_review: "Canonical",
    },
    duration_ms: Number((performance.now() - t0).toFixed(2)),
  };

  return snap;
}
