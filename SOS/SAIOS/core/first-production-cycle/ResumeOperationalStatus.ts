/**
 * Resume Template department — truthful GUARDED_ACTIVE operational status.
 * Read-only aggregation for Founder Dashboard. Never mutates factory state.
 * SOS_AIOS_LIVE=0 is intentional guarded spine (not "department off").
 */
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  evaluateSpendAgainstBudget,
  readCostLedgerEntries,
} from "../ai-brain/CostLedger.js";
import { readBudgetFromEnv } from "../ai-brain/BudgetPolicy.js";
import { isFounderOpenAIBoundedEnabled } from "../resume-integration/FounderOpenAIOneTest.js";
import { summarizeFounderReviewProjection } from "../founder-review/FounderReviewProjection.js";

const DEFAULT_REPO = resolve(import.meta.dirname, "../../../..");
const DEFAULT_QUEUE_MAX = 20;

export type ResumeHealthStatus =
  | "HEALTHY"
  | "BACKPRESSURED"
  | "DEGRADED"
  | "ATTENTION"
  | "UNAVAILABLE";

export type ResumeGenerationStatus =
  | "SCHEDULED"
  | "BACKPRESSURED"
  | "RUNNING"
  | "UNAVAILABLE";

export type SystemdTimerStatus = {
  unit: string;
  enabled: boolean | null;
  active: boolean | null;
  next_run: string | null;
  last_run: string | null;
  available: boolean;
  detail: string;
};

export type ResumeOperationalStatus = {
  schema_version: "resume-operational-status-1.0.0";
  generated_at: string;
  operating_mode: "GUARDED_ACTIVE";
  department_active: boolean;
  department_status: "ACTIVE" | "INACTIVE";
  /** Internal env — must remain 0 for current production spine. */
  sos_aios_live: "0" | "1";
  live_env_guarded: boolean;
  human_status_label: string;
  mode_label: string;
  publication_mode: "MANUAL_GUARDED";
  publication_auto_apply: boolean;
  provider_label: string;
  provider_generation: "OPENAI_BOUNDED" | "MOCK" | "UNAVAILABLE";
  provider_revision: "OPENAI_BOUNDED" | "MOCK" | "UNAVAILABLE";
  openai_bounded_enabled: boolean;
  generation_status: ResumeGenerationStatus;
  revision_dispatcher_enabled: boolean;
  revision_dispatcher_active: boolean;
  revision_pending: number;
  revision_running: number;
  queue: {
    waiting_founder: number;
    queue_max: number;
    queue_free: number;
    revision_failed: number;
    approved: number;
    rejected: number;
    changes_requested: number;
  };
  cost: {
    today_usd: number;
    month_usd: number;
    daily_limit_usd: number | null;
    monthly_limit_usd: number | null;
    auto_pause_threshold_pct: number | null;
    budget_ok: boolean;
    budget_reason: string | null;
    ledger_entries: number;
    available: boolean;
  };
  health: {
    status: ResumeHealthStatus;
    detail: string;
    production_health: string | null;
  };
  freshness: {
    label: string;
    source: string;
    at: string | null;
    age: string;
  };
  timers: {
    morning: SystemdTimerStatus;
    evening: SystemdTimerStatus;
  };
  last_execution: {
    execution_id: string | null;
    stop_reason: string | null;
    finished_at: string | null;
    health_status: string | null;
    budget_decision: string | null;
    candidate_count: number | null;
    batch_id: string | null;
    requested: number | null;
    accepted: number | null;
    failed: number | null;
    role_integrity_failed: number | null;
    duplicate_skips: number | null;
    available: boolean;
  };
  /** How dispatcher "active" was derived — env flag only unless proven otherwise. */
  revision_dispatcher_basis: "env_flag";
  memory: {
    active_rules: number | null;
    confirmed: number | null;
    provisional: number | null;
    superseded: number | null;
    available: boolean;
  };
  top_bar: {
    department_label: string;
    mode_label: string;
    provider_label: string;
    cost_today_usd: string;
    freshness_label: string;
    queue_label: string;
    health_label: string;
  };
};

function ageFromIso(iso: string | null | undefined): string {
  if (!iso) return "unavailable";
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "unavailable";
  const sec = Math.max(0, Math.floor((Date.now() - t) / 1000));
  if (sec < 60) return `${sec}s`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h`;
  return `${Math.floor(sec / 86400)}d`;
}

function readJson(path: string): Record<string, unknown> | null {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function safeSystemctl(
  args: string[],
): { ok: boolean; out: string } {
  try {
    const out = execFileSync("systemctl", args, {
      encoding: "utf8",
      timeout: 2500,
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
    return { ok: true, out };
  } catch {
    return { ok: false, out: "" };
  }
}

function loadTimerStatus(unit: string): SystemdTimerStatus {
  const enabled = safeSystemctl(["is-enabled", unit]);
  const active = safeSystemctl(["is-active", unit]);
  const show = safeSystemctl([
    "show",
    unit,
    "-p",
    "NextElapseUSecRealtime",
    "-p",
    "LastTriggerUSec",
    "--no-pager",
  ]);
  if (!enabled.ok && !active.ok && !show.ok) {
    return {
      unit,
      enabled: null,
      active: null,
      next_run: null,
      last_run: null,
      available: false,
      detail: "systemctl unavailable (local/dev) or unit missing",
    };
  }
  let next_run: string | null = null;
  let last_run: string | null = null;
  for (const line of show.out.split("\n")) {
    if (line.startsWith("NextElapseUSecRealtime=")) {
      const v = line.slice("NextElapseUSecRealtime=".length).trim();
      next_run = !v || v === "n/a" || v === "0" ? null : v;
    }
    if (line.startsWith("LastTriggerUSec=")) {
      const v = line.slice("LastTriggerUSec=".length).trim();
      last_run = !v || v === "n/a" || v === "0" ? null : v;
    }
  }
  return {
    unit,
    enabled: enabled.ok ? enabled.out === "enabled" : null,
    active: active.ok ? active.out === "active" : null,
    next_run,
    last_run,
    available: true,
    detail:
      enabled.out === "enabled" || active.out === "active"
        ? "timer present"
        : `enabled=${enabled.out || "?"} active=${active.out || "?"}`,
  };
}

function countRevisionTasks(
  repoRoot: string,
): { pending: number; running: number } {
  const dir = join(repoRoot, "SOS/07_LOGS/saios/founder-revision/tasks");
  if (!existsSync(dir)) return { pending: 0, running: 0 };
  let pending = 0;
  let running = 0;
  for (const name of readdirSync(dir)) {
    if (!name.startsWith("revtask-") || !name.endsWith(".json")) continue;
    try {
      const t = JSON.parse(readFileSync(join(dir, name), "utf8")) as {
        status?: string;
      };
      const s = String(t.status ?? "");
      if (s === "PENDING" || s === "QUEUED") pending += 1;
      if (s === "RUNNING" || s === "CLAIMED" || s === "IN_PROGRESS") running += 1;
    } catch {
      /* skip */
    }
  }
  return { pending, running };
}

function loadMemoryCounts(repoRoot: string): ResumeOperationalStatus["memory"] {
  const indexPath = join(
    repoRoot,
    "SOS/07_LOGS/saios/knowledge/founder-memory/active-index.json",
  );
  const idx = readJson(indexPath);
  if (!idx) {
    return {
      active_rules: null,
      confirmed: null,
      provisional: null,
      superseded: null,
      available: false,
    };
  }
  const records = Array.isArray(idx.records) ? idx.records : [];
  let confirmed = 0;
  let provisional = 0;
  let superseded = 0;
  for (const r of records) {
    if (!r || typeof r !== "object") continue;
    const status = String((r as { status?: string }).status ?? "");
    if (status === "CONFIRMED") confirmed += 1;
    else if (status === "PROVISIONAL") provisional += 1;
    else if (status === "SUPERSEDED") superseded += 1;
  }
  const active_rules =
    typeof idx.count === "number" ? idx.count : records.length;
  return {
    active_rules,
    confirmed,
    provisional,
    superseded,
    available: true,
  };
}

function loadLastExecution(
  repoRoot: string,
): ResumeOperationalStatus["last_execution"] {
  const cycle = join(repoRoot, "SOS/07_LOGS/saios/first-production-cycle");
  const latest = readJson(join(cycle, "latest-execution.json"));
  if (!latest) {
    return {
      execution_id: null,
      stop_reason: null,
      finished_at: null,
      health_status: null,
      budget_decision: null,
      candidate_count: null,
      batch_id: null,
      requested: null,
      accepted: null,
      failed: null,
      role_integrity_failed: null,
      duplicate_skips: null,
      available: false,
    };
  }
  let requested: number | null = null;
  let accepted: number | null = null;
  let failed: number | null = null;
  let role_integrity_failed: number | null = null;
  let duplicate_skips: number | null = null;
  const reportRel =
    typeof latest.report_path === "string" ? latest.report_path : null;
  const report = reportRel ? readJson(join(repoRoot, reportRel)) : null;
  const batch =
    report?.batch && typeof report.batch === "object"
      ? (report.batch as Record<string, unknown>)
      : null;
  if (batch) {
    if (typeof batch.batch_size_requested === "number")
      requested = batch.batch_size_requested;
    if (typeof batch.requested_size === "number" && requested == null)
      requested = batch.requested_size;
    if (typeof batch.requested_count === "number" && requested == null)
      requested = batch.requested_count;
    if (typeof batch.accepted_count === "number") accepted = batch.accepted_count;
    if (typeof batch.failure_count === "number") failed = batch.failure_count;
    if (typeof batch.role_integrity_failed_count === "number")
      role_integrity_failed = batch.role_integrity_failed_count;
    else if (typeof batch.role_integrity_failed === "number")
      role_integrity_failed = batch.role_integrity_failed;
    if (typeof batch.duplicate_skip_count === "number")
      duplicate_skips = batch.duplicate_skip_count;
  }
  if (typeof report?.failure_count === "number" && failed == null) {
    failed = report.failure_count as number;
  }
  return {
    execution_id:
      typeof latest.execution_id === "string" ? latest.execution_id : null,
    stop_reason:
      typeof latest.stop_reason === "string" ? latest.stop_reason : null,
    finished_at:
      typeof latest.finished_at === "string" ? latest.finished_at : null,
    health_status:
      typeof latest.health_status === "string" ? latest.health_status : null,
    budget_decision:
      typeof latest.budget_decision === "string"
        ? latest.budget_decision
        : null,
    candidate_count:
      typeof latest.candidate_count === "number"
        ? latest.candidate_count
        : null,
    batch_id: typeof latest.batch_id === "string" ? latest.batch_id : null,
    requested,
    accepted:
      accepted ??
      (typeof latest.candidate_count === "number"
        ? latest.candidate_count
        : null),
    failed,
    role_integrity_failed,
    duplicate_skips,
    available: true,
  };
}

export function buildResumeOperationalStatus(opts?: {
  repoRoot?: string;
  env?: NodeJS.ProcessEnv;
  queueMax?: number;
  now?: Date;
}): ResumeOperationalStatus {
  const repoRoot = opts?.repoRoot ?? DEFAULT_REPO;
  const env = opts?.env ?? process.env;
  const now = opts?.now ?? new Date();
  const queueMax = opts?.queueMax ?? DEFAULT_QUEUE_MAX;

  const live = env.SOS_AIOS_LIVE === "1" ? "1" : "0";
  const bounded = isFounderOpenAIBoundedEnabled(env);
  const dispatcherEnabled = env.SOS_AIOS_REVISION_DISPATCHER !== "0";
  const autoApply = env.SOS_AIOS_PUBLICATION_AUTO_APPLY === "1";

  const projection = summarizeFounderReviewProjection(repoRoot);
  const waiting = projection.waiting;
  const queue_free = Math.max(0, queueMax - waiting);

  const budget = readBudgetFromEnv(env);
  const spend = evaluateSpendAgainstBudget({
    daily_limit_usd: budget.values.daily_limit_usd,
    monthly_budget_usd: budget.values.monthly_budget_usd,
    auto_pause_threshold_pct: budget.values.auto_pause_threshold_pct,
    now,
    repoRoot,
  });
  const ledgerEntries = readCostLedgerEntries(repoRoot);
  const ledgerPath = join(repoRoot, "SOS/07_LOGS/saios/cost/ledger.jsonl");
  const costAvailable = existsSync(ledgerPath);

  const morning = loadTimerStatus("aios-generation-morning.timer");
  const evening = loadTimerStatus("aios-generation-evening.timer");
  const timersScheduled =
    (morning.enabled === true || morning.active === true) &&
    (evening.enabled === true || evening.active === true);

  const tasks = countRevisionTasks(repoRoot);
  const last_execution = loadLastExecution(repoRoot);
  const memory = loadMemoryCounts(repoRoot);

  const provider: ResumeOperationalStatus["provider_generation"] = bounded
    ? "OPENAI_BOUNDED"
    : "MOCK";

  let generation_status: ResumeGenerationStatus = "UNAVAILABLE";
  if (timersScheduled || morning.available || evening.available) {
    generation_status =
      waiting >= queueMax ? "BACKPRESSURED" : "SCHEDULED";
  }
  if (tasks.running > 0 && generation_status === "UNAVAILABLE") {
    generation_status = "SCHEDULED";
  }

  let healthStatus: ResumeHealthStatus = "HEALTHY";
  let healthDetail = "Guarded-active Resume Template department";
  if (waiting >= queueMax) {
    healthStatus = "BACKPRESSURED";
    healthDetail = `Review queue full (${waiting}/${queueMax}) — generation paused until capacity`;
  } else if (!spend.ok) {
    healthStatus = "ATTENTION";
    healthDetail = spend.reason ?? "budget attention";
  } else if (
    last_execution.health_status &&
    /UNHEALTHY|FAIL/i.test(last_execution.health_status)
  ) {
    healthStatus = "DEGRADED";
    healthDetail = `Last execution health ${last_execution.health_status}`;
  } else if (live === "1") {
    healthStatus = "ATTENTION";
    healthDetail =
      "SOS_AIOS_LIVE=1 is incompatible with current production spine";
  }

  const freshnessAt =
    last_execution.finished_at ??
    morning.last_run ??
    evening.last_run ??
    null;
  const freshnessSource = last_execution.finished_at
    ? "last_generation_execution"
    : morning.last_run
      ? "morning_timer_last_run"
      : evening.last_run
        ? "evening_timer_last_run"
        : "unavailable";

  const department_active = live === "0" && (bounded || dispatcherEnabled);
  const mode_label = "GUARDED ACTIVE · PUBLISH MANUAL";
  const provider_label = bounded ? "OPENAI BOUNDED" : "MOCK";
  const human_status_label = department_active
    ? "RESUME TEMPLATES — ACTIVE"
    : "RESUME TEMPLATES — INACTIVE";

  const costToday = Number(spend.daily_usd.toFixed(4));
  const costMonth = Number(spend.monthly_usd.toFixed(4));

  return {
    schema_version: "resume-operational-status-1.0.0",
    generated_at: now.toISOString(),
    operating_mode: "GUARDED_ACTIVE",
    department_active,
    department_status: department_active ? "ACTIVE" : "INACTIVE",
    sos_aios_live: live,
    live_env_guarded: live === "0",
    human_status_label,
    mode_label,
    publication_mode: "MANUAL_GUARDED",
    publication_auto_apply: autoApply,
    provider_label,
    provider_generation: provider,
    provider_revision: provider,
    openai_bounded_enabled: bounded,
    generation_status,
    revision_dispatcher_enabled: dispatcherEnabled,
    revision_dispatcher_active: dispatcherEnabled,
    revision_dispatcher_basis: "env_flag",
    revision_pending: tasks.pending,
    revision_running: tasks.running,
    queue: {
      waiting_founder: waiting,
      queue_max: queueMax,
      queue_free,
      revision_failed: projection.revision_failed,
      approved: projection.approved,
      rejected: projection.rejected,
      changes_requested: projection.changes_requested,
    },
    cost: {
      today_usd: costToday,
      month_usd: costMonth,
      daily_limit_usd: budget.values.daily_limit_usd,
      monthly_limit_usd: budget.values.monthly_budget_usd,
      auto_pause_threshold_pct: budget.values.auto_pause_threshold_pct,
      budget_ok: spend.ok,
      budget_reason: spend.reason,
      ledger_entries: ledgerEntries.length,
      available: costAvailable,
    },
    health: {
      status: healthStatus,
      detail: healthDetail,
      production_health: last_execution.health_status,
    },
    freshness: {
      label: freshnessAt ? `Last gen ${ageFromIso(freshnessAt)}` : "No gen yet",
      source: freshnessSource,
      at: freshnessAt,
      age: ageFromIso(freshnessAt),
    },
    timers: { morning, evening },
    last_execution,
    memory,
    top_bar: {
      department_label: department_active ? "ACTIVE" : "INACTIVE",
      mode_label,
      provider_label,
      cost_today_usd: costToday.toFixed(2),
      freshness_label: freshnessAt
        ? `gen ${ageFromIso(freshnessAt)}`
        : "gen —",
      queue_label: `${waiting}/${queueMax}`,
      health_label: healthStatus,
    },
  };
}

/** Convenience: never use legacy runtime-loop heartbeat for Resume ops. */
export function isLegacyRuntimeHeartbeatPath(rel: string): boolean {
  return rel.replace(/\\/g, "/").includes(
    "SOS/07_LOGS/saios/runtime-loop/runtime-heartbeat.json",
  );
}

export function fileExists(repoRoot: string, rel: string): boolean {
  try {
    return existsSync(join(repoRoot, rel)) && statSync(join(repoRoot, rel)).isFile();
  } catch {
    return false;
  }
}
