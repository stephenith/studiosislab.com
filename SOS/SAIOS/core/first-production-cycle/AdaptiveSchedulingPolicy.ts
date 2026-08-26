/**
 * Canonical Adaptive Scheduling Policy — Agent #220.
 * Selects the next AutonomousProductionService sleep interval.
 * Never executes production, selects targets, modifies budgets, or calls OpenAI.
 *
 * Precedence (highest first):
 * 1. PAUSE — queue full, cooldown active, critical state unavailable, operational pause
 * 2. SLOW_DOWN — unhealthy, budget deny, near capacity, stale dashboard, daily pressure, skip patterns
 * 3. RUN_SOON — all safety healthy + idle + capacity + recommendations + fast-cycle budget
 * 4. NORMAL — default / fast-cycle protection forced normal
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
export const SCHEDULING_LOG_ROOT = join(CYCLE_LOG, "scheduling");
export const SCHEDULING_HISTORY_ROOT = join(SCHEDULING_LOG_ROOT, "history");
export const ADAPTIVE_SCHEDULE_REPORT_PATH = join(
  SCHEDULING_LOG_ROOT,
  "adaptive-schedule-report.json",
);
export const ADAPTIVE_SCHEDULE_REPORT_FLAT = join(
  CYCLE_LOG,
  "adaptive-schedule-report.json",
);
export const SCHEDULE_STATE_PATH = join(
  SCHEDULING_LOG_ROOT,
  "schedule-state.json",
);

export const ADAPTIVE_SCHEDULE_POLICY_VERSION = "1.0.0" as const;

export type ScheduleDecision =
  | "RUN_SOON"
  | "NORMAL"
  | "SLOW_DOWN"
  | "PAUSE";

export type AdaptiveSchedulePolicy = {
  minimum_interval_minutes: number;
  normal_interval_minutes: number;
  slow_interval_minutes: number;
  maximum_interval_minutes: number;
  unhealthy_interval_minutes: number;
  budget_denied_interval_minutes: number;
  founder_queue_near_capacity_percent: number;
  founder_queue_full_interval_minutes: number;
  idle_acceleration_enabled: boolean;
  idle_acceleration_interval_minutes: number;
  consecutive_failure_threshold: number;
  failure_cooldown_minutes: number;
  maximum_consecutive_fast_cycles: number;
  stale_dashboard_minutes: number;
  /** Daily cycle soft pressure (% of a soft daily cycle budget). */
  daily_cycle_soft_limit: number;
  daily_candidate_soft_limit: number;
};

export const DEFAULT_ADAPTIVE_SCHEDULE_POLICY: AdaptiveSchedulePolicy = {
  minimum_interval_minutes: 15,
  normal_interval_minutes: 30,
  slow_interval_minutes: 60,
  maximum_interval_minutes: 180,
  unhealthy_interval_minutes: 60,
  budget_denied_interval_minutes: 120,
  founder_queue_near_capacity_percent: 80,
  founder_queue_full_interval_minutes: 180,
  idle_acceleration_enabled: true,
  idle_acceleration_interval_minutes: 15,
  consecutive_failure_threshold: 3,
  failure_cooldown_minutes: 90,
  maximum_consecutive_fast_cycles: 4,
  stale_dashboard_minutes: 60,
  daily_cycle_soft_limit: 80,
  daily_candidate_soft_limit: 400,
};

export type ScheduleState = {
  schema_version: 1;
  consecutive_fast_cycles: number;
  consecutive_failures: number;
  failure_cooldown_until: string | null;
  cooldown_started_at: string | null;
  triggering_executions: string[];
  last_decision: ScheduleDecision | null;
  last_interval_ms: number | null;
  updated_at: string;
};

export type ScheduleSignals = {
  system_health_status: string | null;
  system_health_available: boolean;
  budget_decision: string | null;
  budget_available: boolean;
  founder_queue_waiting: number | null;
  founder_queue_capacity: number | null;
  today_cycles: number | null;
  today_candidates: number | null;
  last_execution_stop_reason: string | null;
  last_execution_available: boolean;
  last_failure_available: boolean;
  last_failure_stop_reason: string | null;
  consecutive_recent_failures: number;
  recent_failure_execution_ids: string[];
  autonomous_skip_reason: string | null;
  portfolio_score: number | null;
  strategy_version: number | null;
  strategy_recommendation_count: number | null;
  dashboard_available: boolean;
  dashboard_generated_at: string | null;
  dashboard_age_minutes: number | null;
  dashboard_stale: boolean;
  configured_interval_ms: number | null;
  operational_pause: boolean;
  missing_signals: string[];
};

export type AdaptiveScheduleResult = {
  schema_version: 1;
  policy_version: typeof ADAPTIVE_SCHEDULE_POLICY_VERSION;
  evaluated_at: string;
  decision: ScheduleDecision;
  next_interval_ms: number;
  next_interval_minutes: number;
  reason_codes: string[];
  signals: ScheduleSignals;
  policy: AdaptiveSchedulePolicy;
  fast_cycle_state: {
    consecutive_fast_cycles: number;
    maximum_consecutive_fast_cycles: number;
    fast_cycle_protection_applied: boolean;
  };
  cooldown_state: {
    active: boolean;
    consecutive_failures: number;
    threshold: number;
    started_at: string | null;
    expires_at: string | null;
    triggering_executions: string[];
  };
  safety: {
    live: false;
    publication_allowed: false;
    openai_called: false;
    production_triggered: false;
    bounds_enforced: true;
  };
  report_path: string;
  history_path: string;
  state_path: string;
  duration_ms: number;
};

export type EvaluateAdaptiveScheduleOptions = {
  repoRoot?: string;
  cycleLog?: string;
  policy?: Partial<AdaptiveSchedulePolicy>;
  /** Partial signal overrides (fixtures / tests). */
  signal_overrides?: Partial<ScheduleSignals>;
  configured_interval_ms?: number;
  persist?: boolean;
  persist_state?: boolean;
  now?: Date;
  /** Injected schedule state (verify). */
  state?: ScheduleState;
  state_path?: string;
  dashboard_path?: string;
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

export function minutesToMs(minutes: number): number {
  return Math.round(minutes * 60 * 1000);
}

export function mergeAdaptiveSchedulePolicy(
  partial?: Partial<AdaptiveSchedulePolicy>,
): AdaptiveSchedulePolicy {
  const p: AdaptiveSchedulePolicy = {
    ...DEFAULT_ADAPTIVE_SCHEDULE_POLICY,
    ...partial,
  };
  const clamp = (n: number, lo: number, hi: number) =>
    Math.max(lo, Math.min(hi, n));
  p.minimum_interval_minutes = Math.max(1, Math.floor(p.minimum_interval_minutes));
  p.maximum_interval_minutes = Math.max(
    p.minimum_interval_minutes,
    Math.floor(p.maximum_interval_minutes),
  );
  p.normal_interval_minutes = clamp(
    Math.floor(p.normal_interval_minutes),
    p.minimum_interval_minutes,
    p.maximum_interval_minutes,
  );
  p.slow_interval_minutes = clamp(
    Math.floor(p.slow_interval_minutes),
    p.minimum_interval_minutes,
    p.maximum_interval_minutes,
  );
  p.unhealthy_interval_minutes = clamp(
    Math.floor(p.unhealthy_interval_minutes),
    p.minimum_interval_minutes,
    p.maximum_interval_minutes,
  );
  p.budget_denied_interval_minutes = clamp(
    Math.floor(p.budget_denied_interval_minutes),
    p.minimum_interval_minutes,
    p.maximum_interval_minutes,
  );
  p.founder_queue_full_interval_minutes = clamp(
    Math.floor(p.founder_queue_full_interval_minutes),
    p.minimum_interval_minutes,
    p.maximum_interval_minutes,
  );
  p.idle_acceleration_interval_minutes = clamp(
    Math.floor(p.idle_acceleration_interval_minutes),
    p.minimum_interval_minutes,
    p.maximum_interval_minutes,
  );
  p.failure_cooldown_minutes = Math.max(1, Math.floor(p.failure_cooldown_minutes));
  p.consecutive_failure_threshold = Math.max(
    1,
    Math.floor(p.consecutive_failure_threshold),
  );
  p.maximum_consecutive_fast_cycles = Math.max(
    1,
    Math.floor(p.maximum_consecutive_fast_cycles),
  );
  p.founder_queue_near_capacity_percent = clamp(
    Math.floor(p.founder_queue_near_capacity_percent),
    1,
    100,
  );
  p.stale_dashboard_minutes = Math.max(1, Math.floor(p.stale_dashboard_minutes));
  p.daily_cycle_soft_limit = Math.max(1, Math.floor(p.daily_cycle_soft_limit));
  p.daily_candidate_soft_limit = Math.max(
    1,
    Math.floor(p.daily_candidate_soft_limit),
  );
  return p;
}

export function boundIntervalMs(
  ms: number,
  policy: AdaptiveSchedulePolicy,
): number {
  const lo = minutesToMs(policy.minimum_interval_minutes);
  const hi = minutesToMs(policy.maximum_interval_minutes);
  return Math.max(lo, Math.min(hi, Math.floor(ms)));
}

export function defaultScheduleState(now: Date = new Date()): ScheduleState {
  return {
    schema_version: 1,
    consecutive_fast_cycles: 0,
    consecutive_failures: 0,
    failure_cooldown_until: null,
    cooldown_started_at: null,
    triggering_executions: [],
    last_decision: null,
    last_interval_ms: null,
    updated_at: now.toISOString(),
  };
}

export function loadScheduleState(path: string = SCHEDULE_STATE_PATH): ScheduleState {
  const raw = tryReadJson(path);
  if (!raw) return defaultScheduleState();
  return {
    schema_version: 1,
    consecutive_fast_cycles:
      typeof raw.consecutive_fast_cycles === "number"
        ? raw.consecutive_fast_cycles
        : 0,
    consecutive_failures:
      typeof raw.consecutive_failures === "number"
        ? raw.consecutive_failures
        : 0,
    failure_cooldown_until:
      typeof raw.failure_cooldown_until === "string"
        ? raw.failure_cooldown_until
        : null,
    cooldown_started_at:
      typeof raw.cooldown_started_at === "string"
        ? raw.cooldown_started_at
        : null,
    triggering_executions: Array.isArray(raw.triggering_executions)
      ? (raw.triggering_executions as string[])
      : [],
    last_decision:
      raw.last_decision === "RUN_SOON" ||
      raw.last_decision === "NORMAL" ||
      raw.last_decision === "SLOW_DOWN" ||
      raw.last_decision === "PAUSE"
        ? raw.last_decision
        : null,
    last_interval_ms:
      typeof raw.last_interval_ms === "number" ? raw.last_interval_ms : null,
    updated_at:
      typeof raw.updated_at === "string"
        ? raw.updated_at
        : new Date().toISOString(),
  };
}

function isFailureStop(reason: string | null | undefined): boolean {
  if (!reason) return false;
  return (
    reason === "health_unhealthy" ||
    reason === "budget_denied" ||
    reason === "fatal_error" ||
    reason === "live_refused"
  );
}

function countConsecutiveRecentFailures(cycleLog: string): {
  count: number;
  ids: string[];
} {
  const root = join(cycleLog, "executions");
  if (!existsSync(root)) return { count: 0, ids: [] };
  const names = readdirSync(root)
    .filter((n) => n.startsWith("exec-"))
    .sort();
  const ids: string[] = [];
  for (let i = names.length - 1; i >= 0; i--) {
    const report = tryReadJson(join(root, names[i]!, "execution-report.json"));
    if (!report) break;
    const stop =
      typeof report.stop_reason === "string" ? report.stop_reason : null;
    if (!isFailureStop(stop)) break;
    ids.push(
      typeof report.execution_id === "string" ? report.execution_id : names[i]!,
    );
  }
  return { count: ids.length, ids: ids.reverse() };
}

function loadStrategyRecommendationCount(cycleLog: string): number | null {
  for (const p of [
    join(cycleLog, "strategy", "production-strategy.json"),
    join(cycleLog, "production-strategy.json"),
  ]) {
    const raw = tryReadJson(p);
    if (!raw) continue;
    if (typeof raw.recommendation_count === "number") {
      return raw.recommendation_count;
    }
    if (Array.isArray(raw.recommendations)) return raw.recommendations.length;
  }
  return null;
}

function collectSignals(
  cycleLog: string,
  policy: AdaptiveSchedulePolicy,
  now: Date,
  configured_interval_ms: number | null,
  overrides?: Partial<ScheduleSignals>,
  dashboardPath?: string,
): ScheduleSignals {
  const missing: string[] = [];
  const dashPaths = [
    dashboardPath,
    join(cycleLog, "operations-dashboard", "operations-dashboard.json"),
    join(cycleLog, "operations-dashboard.json"),
  ].filter(Boolean) as string[];

  let dash: Record<string, unknown> | null = null;
  let dashPathUsed: string | null = null;
  for (const p of dashPaths) {
    dash = tryReadJson(p);
    if (dash) {
      dashPathUsed = p;
      break;
    }
  }
  if (!dash) missing.push("operations_dashboard");

  const health = (dash?.system_health as Record<string, unknown> | undefined) ?? null;
  const budget = (dash?.budget_status as Record<string, unknown> | undefined) ?? null;
  const lastExec =
    (dash?.last_execution as Record<string, unknown> | undefined) ?? null;
  const lastFail =
    (dash?.last_failure as Record<string, unknown> | undefined) ?? null;
  const founder =
    (dash?.founder_queue as Record<string, unknown> | undefined) ?? null;
  const auto =
    (dash?.autonomous_status as Record<string, unknown> | undefined) ?? null;

  // Fallbacks when dashboard missing — read individual reports
  const healthFile = tryReadJson(join(cycleLog, "health-report.json"));
  const budgetFile =
    tryReadJson(join(cycleLog, "budget", "budget-governor-report.json")) ??
    tryReadJson(join(cycleLog, "budget-governor-report.json"));
  const latestExec = tryReadJson(join(cycleLog, "latest-execution.json"));

  const system_health_available = Boolean(
    (health && health.available !== false) || healthFile,
  );
  if (!system_health_available) missing.push("system_health");

  const system_health_status =
    (typeof health?.status === "string" ? health.status : null) ??
    (typeof healthFile?.status === "string" ? healthFile.status : null);

  const budget_available = Boolean(
    (budget && budget.available !== false) || budgetFile,
  );
  if (!budget_available) missing.push("budget_status");

  const budget_decision =
    (typeof budget?.decision === "string" ? budget.decision : null) ??
    (typeof budgetFile?.decision === "string" ? budgetFile.decision : null);

  let founder_queue_waiting: number | null =
    typeof founder?.waiting === "number"
      ? founder.waiting
      : typeof health?.queue_waiting === "number"
        ? health.queue_waiting
        : typeof healthFile?.queue_waiting === "number"
          ? healthFile.queue_waiting
          : null;
  let founder_queue_capacity: number | null =
    typeof health?.queue_max === "number"
      ? health.queue_max
      : typeof healthFile?.queue_max === "number"
        ? healthFile.queue_max
        : null;
  if (founder_queue_waiting === null) missing.push("founder_queue_waiting");
  if (founder_queue_capacity === null) missing.push("founder_queue_capacity");

  const today_cycles =
    typeof dash?.today_cycles === "number" ? dash.today_cycles : null;
  const today_candidates =
    typeof dash?.today_candidates === "number" ? dash.today_candidates : null;
  if (today_cycles === null) missing.push("today_cycles");
  if (today_candidates === null) missing.push("today_candidates");

  const last_execution_available = Boolean(
    lastExec?.available === true || latestExec,
  );
  const last_execution_stop_reason =
    (typeof lastExec?.stop_reason === "string" ? lastExec.stop_reason : null) ??
    (typeof latestExec?.stop_reason === "string"
      ? latestExec.stop_reason
      : null);

  const last_failure_available = lastFail?.available === true;
  const last_failure_stop_reason =
    typeof lastFail?.stop_reason === "string" ? lastFail.stop_reason : null;

  const failScan = countConsecutiveRecentFailures(cycleLog);

  const dashboard_generated_at =
    typeof dash?.generated_at === "string" ? dash.generated_at : null;
  let dashboard_age_minutes: number | null = null;
  let dashboard_stale = false;
  if (dashboard_generated_at) {
    const ageMs = now.getTime() - Date.parse(dashboard_generated_at);
    if (Number.isFinite(ageMs)) {
      dashboard_age_minutes = Number((ageMs / 60000).toFixed(2));
      dashboard_stale =
        dashboard_age_minutes > policy.stale_dashboard_minutes;
    }
  } else if (dashPathUsed) {
    missing.push("dashboard_timestamp");
  }

  const strategy_recommendation_count =
    loadStrategyRecommendationCount(cycleLog);

  const base: ScheduleSignals = {
    system_health_status,
    system_health_available,
    budget_decision,
    budget_available,
    founder_queue_waiting,
    founder_queue_capacity,
    today_cycles,
    today_candidates,
    last_execution_stop_reason,
    last_execution_available,
    last_failure_available,
    last_failure_stop_reason,
    consecutive_recent_failures: failScan.count,
    recent_failure_execution_ids: failScan.ids,
    autonomous_skip_reason:
      typeof auto?.detail === "string" && /skip/i.test(auto.detail)
        ? auto.detail
        : null,
    portfolio_score:
      typeof dash?.portfolio_score === "number" ? dash.portfolio_score : null,
    strategy_version:
      typeof dash?.strategy_version === "number" ? dash.strategy_version : null,
    strategy_recommendation_count,
    dashboard_available: Boolean(dash),
    dashboard_generated_at,
    dashboard_age_minutes,
    dashboard_stale,
    configured_interval_ms,
    operational_pause: false,
    missing_signals: [...new Set(missing)],
  };

  return { ...base, ...overrides, missing_signals: [
    ...new Set([
      ...base.missing_signals,
      ...(overrides?.missing_signals ?? []),
    ]),
  ] };
}

/**
 * Evaluate adaptive scheduling decision. Deterministic. No production.
 */
export function evaluateAdaptiveSchedule(
  opts?: EvaluateAdaptiveScheduleOptions,
): AdaptiveScheduleResult {
  const t0 = performance.now();
  const now = opts?.now ?? new Date();
  const evaluated_at = now.toISOString();
  const repoRoot = opts?.repoRoot ?? REPO;
  const cycleLog = opts?.cycleLog ?? CYCLE_LOG;
  const policy = mergeAdaptiveSchedulePolicy(opts?.policy);
  const statePath = opts?.state_path ?? join(cycleLog, "scheduling", "schedule-state.json");
  let state = opts?.state
    ? { ...opts.state }
    : loadScheduleState(
        existsSync(statePath) ? statePath : SCHEDULE_STATE_PATH,
      );

  const signals = collectSignals(
    cycleLog,
    policy,
    now,
    opts?.configured_interval_ms ?? null,
    opts?.signal_overrides,
    opts?.dashboard_path,
  );

  const reason_codes: string[] = [];
  let decision: ScheduleDecision = "NORMAL";
  let interval_minutes = policy.normal_interval_minutes;
  let fast_cycle_protection_applied = false;

  // --- Cooldown expiry ---
  if (state.failure_cooldown_until) {
    const until = Date.parse(state.failure_cooldown_until);
    if (Number.isFinite(until) && now.getTime() >= until) {
      reason_codes.push("cooldown_expired");
      state = {
        ...state,
        consecutive_failures: 0,
        failure_cooldown_until: null,
        cooldown_started_at: null,
        triggering_executions: [],
      };
    }
  }

  const cooldownActive = Boolean(
    state.failure_cooldown_until &&
      Date.parse(state.failure_cooldown_until) > now.getTime(),
  );

  // Update failure tracking from signals (do not mutate execution reports)
  const consecFails = Math.max(
    state.consecutive_failures,
    signals.consecutive_recent_failures,
  );
  if (
    !cooldownActive &&
    consecFails >= policy.consecutive_failure_threshold
  ) {
    const started = evaluated_at;
    const expires = new Date(
      now.getTime() + minutesToMs(policy.failure_cooldown_minutes),
    ).toISOString();
    state = {
      ...state,
      consecutive_failures: consecFails,
      failure_cooldown_until: expires,
      cooldown_started_at: started,
      triggering_executions: [
        ...signals.recent_failure_execution_ids,
      ].slice(-policy.consecutive_failure_threshold),
    };
    reason_codes.push("failure_cooldown_triggered");
  }

  const cooldownNow = Boolean(
    state.failure_cooldown_until &&
      Date.parse(state.failure_cooldown_until) > now.getTime(),
  );

  const queueWaiting = signals.founder_queue_waiting;
  const queueCap = signals.founder_queue_capacity;
  const queueFull =
    queueWaiting !== null &&
    queueCap !== null &&
    queueCap > 0 &&
    queueWaiting >= queueCap;
  const queueNear =
    queueWaiting !== null &&
    queueCap !== null &&
    queueCap > 0 &&
    (queueWaiting / queueCap) * 100 >=
      policy.founder_queue_near_capacity_percent &&
    !queueFull;

  const criticalUnavailable =
    !signals.system_health_available && !signals.dashboard_available;

  // ========== 1. PAUSE ==========
  if (signals.operational_pause) {
    decision = "PAUSE";
    interval_minutes = policy.maximum_interval_minutes;
    reason_codes.push("operational_pause");
  } else if (cooldownNow) {
    decision = "PAUSE";
    interval_minutes = policy.failure_cooldown_minutes;
    reason_codes.push("failure_cooldown_active");
  } else if (queueFull) {
    decision = "PAUSE";
    interval_minutes = policy.founder_queue_full_interval_minutes;
    reason_codes.push("founder_queue_full");
  } else if (criticalUnavailable) {
    decision = "PAUSE";
    interval_minutes = policy.maximum_interval_minutes;
    reason_codes.push("critical_state_unavailable");
  }
  // ========== 2. SLOW_DOWN ==========
  else if (signals.system_health_status === "UNHEALTHY") {
    decision = "SLOW_DOWN";
    interval_minutes = policy.unhealthy_interval_minutes;
    reason_codes.push("system_unhealthy");
  } else if (signals.budget_decision === "DENY") {
    decision = "SLOW_DOWN";
    interval_minutes = policy.budget_denied_interval_minutes;
    reason_codes.push("budget_denied");
  } else if (queueNear) {
    decision = "SLOW_DOWN";
    interval_minutes = policy.slow_interval_minutes;
    reason_codes.push("founder_queue_near_capacity");
  } else if (signals.dashboard_stale) {
    decision = "SLOW_DOWN";
    interval_minutes = policy.slow_interval_minutes;
    reason_codes.push("dashboard_stale");
  } else if (
    signals.today_cycles !== null &&
    signals.today_cycles >= policy.daily_cycle_soft_limit
  ) {
    decision = "SLOW_DOWN";
    interval_minutes = policy.slow_interval_minutes;
    reason_codes.push("daily_cycles_pressure");
  } else if (
    signals.today_candidates !== null &&
    signals.today_candidates >= policy.daily_candidate_soft_limit
  ) {
    decision = "SLOW_DOWN";
    interval_minutes = policy.slow_interval_minutes;
    reason_codes.push("daily_candidates_pressure");
  } else if (
    signals.autonomous_skip_reason &&
    /health_unhealthy|queue_capacity|live_refused/i.test(
      signals.autonomous_skip_reason,
    )
  ) {
    decision = "SLOW_DOWN";
    interval_minutes = policy.slow_interval_minutes;
    reason_codes.push("autonomous_skip_pattern");
  } else if (
    signals.consecutive_recent_failures >= 2 &&
    signals.consecutive_recent_failures < policy.consecutive_failure_threshold
  ) {
    decision = "SLOW_DOWN";
    interval_minutes = policy.slow_interval_minutes;
    reason_codes.push("repeated_failures_pattern");
  }
  // ========== 3. RUN_SOON / 4. NORMAL ==========
  else {
    const healthOk = signals.system_health_status === "HEALTHY";
    const budgetOk = signals.budget_decision === "ALLOW";
    const capacityOk =
      queueWaiting !== null &&
      queueCap !== null &&
      queueCap > 0 &&
      (queueWaiting / queueCap) * 100 <
        policy.founder_queue_near_capacity_percent;
    const recsOk =
      (signals.strategy_recommendation_count ?? 0) > 0 ||
      (signals.portfolio_score !== null && signals.portfolio_score >= 0);
    const noRecentFailure = signals.consecutive_recent_failures === 0;
    const accelerateEligible =
      policy.idle_acceleration_enabled &&
      healthOk &&
      budgetOk &&
      capacityOk &&
      recsOk &&
      noRecentFailure &&
      !signals.dashboard_stale;

    if (accelerateEligible) {
      if (
        state.consecutive_fast_cycles >=
        policy.maximum_consecutive_fast_cycles
      ) {
        decision = "NORMAL";
        interval_minutes = policy.normal_interval_minutes;
        reason_codes.push("fast_cycle_protection");
        fast_cycle_protection_applied = true;
      } else {
        decision = "RUN_SOON";
        interval_minutes = policy.idle_acceleration_interval_minutes;
        reason_codes.push(
          "idle_acceleration",
          "queue_has_capacity",
          "recommendations_available",
        );
      }
    } else {
      decision = "NORMAL";
      interval_minutes = policy.normal_interval_minutes;
      reason_codes.push("default_normal");
    }
  }

  // Deduplicate reason codes (stable order)
  const uniqueReasons = [...new Set(reason_codes)];

  let next_interval_ms = boundIntervalMs(
    minutesToMs(interval_minutes),
    policy,
  );

  // Update persisted fast-cycle / last decision state
  if (decision === "RUN_SOON") {
    state.consecutive_fast_cycles += 1;
  } else if (decision === "NORMAL" || decision === "SLOW_DOWN" || decision === "PAUSE") {
    if (decision !== "NORMAL" || fast_cycle_protection_applied) {
      state.consecutive_fast_cycles = 0;
    } else {
      state.consecutive_fast_cycles = 0;
    }
  }
  state.last_decision = decision;
  state.last_interval_ms = next_interval_ms;
  state.updated_at = evaluated_at;
  if (!cooldownNow && signals.consecutive_recent_failures === 0) {
    state.consecutive_failures = 0;
  } else {
    state.consecutive_failures = Math.max(
      state.consecutive_failures,
      signals.consecutive_recent_failures,
    );
  }

  mkdirSync(join(cycleLog, "scheduling", "history"), { recursive: true });
  const stamp = evaluated_at.replace(/[:.]/g, "-");
  const history_path_abs = join(
    cycleLog,
    "scheduling",
    "history",
    `schedule-${stamp}.json`,
  );
  const report_path_abs = join(
    cycleLog,
    "scheduling",
    "adaptive-schedule-report.json",
  );
  const flat_path_abs = join(cycleLog, "adaptive-schedule-report.json");

  const result: AdaptiveScheduleResult = {
    schema_version: 1,
    policy_version: ADAPTIVE_SCHEDULE_POLICY_VERSION,
    evaluated_at,
    decision,
    next_interval_ms,
    next_interval_minutes: Number((next_interval_ms / 60000).toFixed(2)),
    reason_codes: uniqueReasons,
    signals,
    policy,
    fast_cycle_state: {
      consecutive_fast_cycles: state.consecutive_fast_cycles,
      maximum_consecutive_fast_cycles: policy.maximum_consecutive_fast_cycles,
      fast_cycle_protection_applied,
    },
    cooldown_state: {
      active: Boolean(
        state.failure_cooldown_until &&
          Date.parse(state.failure_cooldown_until) > now.getTime(),
      ),
      consecutive_failures: state.consecutive_failures,
      threshold: policy.consecutive_failure_threshold,
      started_at: state.cooldown_started_at,
      expires_at: state.failure_cooldown_until,
      triggering_executions: state.triggering_executions,
    },
    safety: {
      live: false,
      publication_allowed: false,
      openai_called: false,
      production_triggered: false,
      bounds_enforced: true,
    },
    report_path: relative(repoRoot, report_path_abs).replace(/\\/g, "/"),
    history_path: relative(repoRoot, history_path_abs).replace(/\\/g, "/"),
    state_path: relative(repoRoot, statePath).replace(/\\/g, "/"),
    duration_ms: Number((performance.now() - t0).toFixed(2)),
  };

  if (opts?.persist !== false) {
    atomicWriteJson(report_path_abs, result);
    atomicWriteJson(flat_path_abs, result);
    atomicWriteJson(history_path_abs, result);
  }
  if (opts?.persist_state !== false) {
    atomicWriteJson(statePath, state);
    // Mirror canonical default state path when using default cycle log
    if (cycleLog === CYCLE_LOG) {
      atomicWriteJson(SCHEDULE_STATE_PATH, state);
    }
  }

  return result;
}

/** Fingerprint for deterministic verify (exclude volatile timing fields). */
export function scheduleDecisionFingerprint(
  result: AdaptiveScheduleResult,
): string {
  return JSON.stringify({
    decision: result.decision,
    next_interval_ms: result.next_interval_ms,
    reason_codes: result.reason_codes,
    policy_version: result.policy_version,
    fast: result.fast_cycle_state,
    cooldown_active: result.cooldown_state.active,
  });
}
