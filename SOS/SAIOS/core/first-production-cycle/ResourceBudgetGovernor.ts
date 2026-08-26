/**
 * Canonical Resource & Budget Governor — Agent #218.
 * Evaluates whether a production cycle may begin under operational limits.
 * Never selects goals, generates resumes, calls OpenAI, or runs production.
 */
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  statfsSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { listCandidateManifests } from "./CandidateStore.js";
import { countFounderReviewWaiting } from "../founder-review/FounderReviewProjection.js";
import {
  DEFAULT_BATCH_SIZE,
  DEFAULT_QUEUE_MAX,
} from "./BatchRunner.js";

const REPO = resolve(import.meta.dirname, "../../../..");
const CYCLE_LOG = join(REPO, "SOS/07_LOGS/saios/first-production-cycle");
const DEFAULT_EXECUTION_LOG_ROOT = join(CYCLE_LOG, "executions");
export const BUDGET_LOG_ROOT = join(CYCLE_LOG, "budget");
export const BUDGET_HISTORY_ROOT = join(BUDGET_LOG_ROOT, "history");
export const BUDGET_REPORT_PATH = join(
  BUDGET_LOG_ROOT,
  "budget-governor-report.json",
);
export const BUDGET_REPORT_FLAT = join(CYCLE_LOG, "budget-governor-report.json");

/** BatchRunner hard ceiling (Math.min(50, …)). */
export const BATCH_RUNNER_MAX_SIZE = 50;

export const BUDGET_GOVERNOR_VERSION = 1 as const;

export type OpenAiBudgetMode = "registry_only" | "disabled";

export type ResourceBudgetPolicy = {
  maximum_daily_cycles: number;
  maximum_daily_candidates: number;
  /** Must not exceed BatchRunner hard ceiling. */
  maximum_batch_size: number;
  minimum_disk_free_percent: number;
  maximum_founder_queue: number;
  openai_budget_mode: OpenAiBudgetMode;
};

export const DEFAULT_BUDGET_POLICY: ResourceBudgetPolicy = {
  maximum_daily_cycles: 100,
  maximum_daily_candidates: 500,
  maximum_batch_size: BATCH_RUNNER_MAX_SIZE,
  minimum_disk_free_percent: 10,
  maximum_founder_queue: DEFAULT_QUEUE_MAX,
  openai_budget_mode: "registry_only",
};

export type BudgetDecision = "ALLOW" | "DENY";

export type BudgetViolation = {
  code: string;
  detail: string;
  observed: number | string | boolean | null;
  limit: number | string | null;
};

export type ResourceBudgetSummary = {
  daily_cycles: number;
  daily_candidates: number;
  proposed_batch_size: number;
  founder_queue_waiting: number;
  disk_free_percent: number | null;
  disk_check_available: boolean;
  openai_registry_ok: boolean;
  openai_registry_detail: string;
  day_utc: string;
};

export type ResourceBudgetResult = {
  schema_version: typeof BUDGET_GOVERNOR_VERSION;
  governor_version: typeof BUDGET_GOVERNOR_VERSION;
  timestamp: string;
  decision: BudgetDecision;
  policy: ResourceBudgetPolicy;
  violations: BudgetViolation[];
  resources: ResourceBudgetSummary;
  publication_allowed: false;
  live: false;
  openai_called: false;
  production_triggered: false;
  report_path: string;
  history_path: string;
  duration_ms: number;
};

export type ResourceBudgetSimulate = {
  daily_cycles?: number;
  daily_candidates?: number;
  founder_queue_waiting?: number;
  disk_free_percent?: number | null;
  openai_registry_ok?: boolean;
};

export type ResourceBudgetOptions = {
  repoRoot?: string;
  cycleLog?: string;
  executionLogRoot?: string;
  policy?: Partial<ResourceBudgetPolicy>;
  /** Batch size the controller intends to run. */
  proposed_batch_size?: number;
  persist?: boolean;
  simulate?: ResourceBudgetSimulate;
  now?: Date;
};

function atomicWriteJson(path: string, data: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  const tmp = `${path}.${process.pid}.${Date.now()}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  renameSync(tmp, path);
}

export function mergeBudgetPolicy(
  partial?: Partial<ResourceBudgetPolicy>,
): ResourceBudgetPolicy {
  const merged: ResourceBudgetPolicy = {
    ...DEFAULT_BUDGET_POLICY,
    ...partial,
  };
  merged.maximum_daily_cycles = Math.max(
    0,
    Math.floor(merged.maximum_daily_cycles),
  );
  merged.maximum_daily_candidates = Math.max(
    0,
    Math.floor(merged.maximum_daily_candidates),
  );
  merged.maximum_batch_size = Math.max(
    1,
    Math.min(
      BATCH_RUNNER_MAX_SIZE,
      Math.floor(merged.maximum_batch_size || DEFAULT_BATCH_SIZE),
    ),
  );
  merged.minimum_disk_free_percent = Math.max(
    0,
    Math.min(100, Number(merged.minimum_disk_free_percent)),
  );
  merged.maximum_founder_queue = Math.max(
    1,
    Math.floor(merged.maximum_founder_queue),
  );
  if (
    merged.openai_budget_mode !== "registry_only" &&
    merged.openai_budget_mode !== "disabled"
  ) {
    merged.openai_budget_mode = "registry_only";
  }
  return merged;
}

function dayUtc(now: Date): string {
  return now.toISOString().slice(0, 10);
}

export function countDailyExecutions(
  executionLogRoot: string,
  day: string,
): number {
  if (!existsSync(executionLogRoot)) return 0;
  const prefix = `exec-${day.replace(/-/g, "")}-`;
  let n = 0;
  for (const name of readdirSync(executionLogRoot)) {
    if (name.startsWith(prefix)) n += 1;
  }
  return n;
}

export function countDailyCandidates(cycleLog: string, day: string): number {
  const manifests = listCandidateManifests(cycleLog);
  let n = 0;
  for (const m of manifests) {
    const created = typeof m.created_at === "string" ? m.created_at : "";
    if (created.startsWith(day)) n += 1;
  }
  return n;
}

export function probeDiskFreePercent(
  path: string,
): { ok: true; percent: number } | { ok: false; detail: string } {
  try {
    const s = statfsSync(path);
    const blocks = Number(s.blocks);
    const avail = Number(s.bavail);
    if (!Number.isFinite(blocks) || blocks <= 0) {
      return { ok: false, detail: "statfs blocks unavailable" };
    }
    const percent = (avail / blocks) * 100;
    return { ok: true, percent: Number(percent.toFixed(2)) };
  } catch (e) {
    return {
      ok: false,
      detail: e instanceof Error ? e.message : String(e),
    };
  }
}

function inspectOpenAiRegistry(
  repoRoot: string,
  mode: OpenAiBudgetMode,
): { ok: boolean; detail: string } {
  const registryPath = join(repoRoot, "SOS/SAIOS/config/provider-registry.json");
  if (!existsSync(registryPath)) {
    return { ok: false, detail: `missing registry: ${registryPath}` };
  }
  try {
    const raw = JSON.parse(readFileSync(registryPath, "utf8")) as {
      providers?: Array<{
        id?: string;
        enabled?: boolean;
        implemented?: boolean;
        mode?: string;
      }>;
    };
    const providers = raw.providers ?? [];
    const openai = providers.find((p) => p.id === "openai");
    const mock = providers.find((p) => p.id === "mock");
    if (!openai || openai.implemented !== true) {
      return { ok: false, detail: "openai provider not implemented in registry" };
    }
    if (mode === "disabled" && openai.enabled === true) {
      return {
        ok: false,
        detail: "openai_budget_mode=disabled but openai.enabled=true",
      };
    }
    // registry_only: consult registry only — never call OpenAI APIs
    return {
      ok: true,
      detail: `registry_only · openai enabled=${Boolean(openai.enabled)} mode=${openai.mode ?? "?"} · mock enabled=${Boolean(mock?.enabled)} (no API call)`,
    };
  } catch (e) {
    return {
      ok: false,
      detail: e instanceof Error ? e.message : String(e),
    };
  }
}

/**
 * Evaluate resource & budget policy. Returns ALLOW or DENY with all violations.
 */
export function evaluateResourceBudget(
  opts?: ResourceBudgetOptions,
): ResourceBudgetResult {
  const t0 = performance.now();
  const now = opts?.now ?? new Date();
  const timestamp = now.toISOString();
  const day = dayUtc(now);
  const repoRoot = opts?.repoRoot ?? REPO;
  const cycleLog = opts?.cycleLog ?? CYCLE_LOG;
  const executionLogRoot = opts?.executionLogRoot ?? DEFAULT_EXECUTION_LOG_ROOT;
  const policy = mergeBudgetPolicy(opts?.policy);
  const sim = opts?.simulate ?? {};

  const proposed_batch_size = Math.max(
    1,
    Math.floor(opts?.proposed_batch_size ?? DEFAULT_BATCH_SIZE),
  );

  const daily_cycles =
    sim.daily_cycles !== undefined
      ? sim.daily_cycles
      : countDailyExecutions(executionLogRoot, day);
  const daily_candidates =
    sim.daily_candidates !== undefined
      ? sim.daily_candidates
      : countDailyCandidates(cycleLog, day);
  const founder_queue_waiting =
    sim.founder_queue_waiting !== undefined
      ? sim.founder_queue_waiting
      : countFounderReviewWaiting(repoRoot);

  let disk_free_percent: number | null = null;
  let disk_check_available = false;
  if (sim.disk_free_percent !== undefined) {
    disk_free_percent = sim.disk_free_percent;
    disk_check_available = sim.disk_free_percent !== null;
  } else {
    const disk = probeDiskFreePercent(cycleLog);
    if (disk.ok) {
      disk_free_percent = disk.percent;
      disk_check_available = true;
    }
  }

  let openai_registry_ok: boolean;
  let openai_registry_detail: string;
  if (sim.openai_registry_ok !== undefined) {
    openai_registry_ok = sim.openai_registry_ok;
    openai_registry_detail = sim.openai_registry_ok
      ? "simulated ok"
      : "simulated registry failure";
  } else {
    const reg = inspectOpenAiRegistry(repoRoot, policy.openai_budget_mode);
    openai_registry_ok = reg.ok;
    openai_registry_detail = reg.detail;
  }

  const violations: BudgetViolation[] = [];

  if (daily_cycles >= policy.maximum_daily_cycles) {
    violations.push({
      code: "maximum_daily_cycles",
      detail: `daily executions ${daily_cycles} >= limit ${policy.maximum_daily_cycles}`,
      observed: daily_cycles,
      limit: policy.maximum_daily_cycles,
    });
  }

  if (daily_candidates >= policy.maximum_daily_candidates) {
    violations.push({
      code: "maximum_daily_candidates",
      detail: `daily resume templates ${daily_candidates} >= limit ${policy.maximum_daily_candidates}`,
      observed: daily_candidates,
      limit: policy.maximum_daily_candidates,
    });
  }

  if (proposed_batch_size > policy.maximum_batch_size) {
    violations.push({
      code: "maximum_batch_size",
      detail: `proposed batch_size ${proposed_batch_size} > limit ${policy.maximum_batch_size}`,
      observed: proposed_batch_size,
      limit: policy.maximum_batch_size,
    });
  }

  if (founder_queue_waiting >= policy.maximum_founder_queue) {
    violations.push({
      code: "maximum_founder_queue",
      detail: `founder queue ${founder_queue_waiting} >= capacity ${policy.maximum_founder_queue}`,
      observed: founder_queue_waiting,
      limit: policy.maximum_founder_queue,
    });
  }

  if (!openai_registry_ok) {
    violations.push({
      code: "openai_registry",
      detail: openai_registry_detail,
      observed: false,
      limit: policy.openai_budget_mode,
    });
  }

  if (
    disk_check_available &&
    disk_free_percent !== null &&
    disk_free_percent < policy.minimum_disk_free_percent
  ) {
    violations.push({
      code: "minimum_disk_free_percent",
      detail: `disk free ${disk_free_percent}% < minimum ${policy.minimum_disk_free_percent}%`,
      observed: disk_free_percent,
      limit: policy.minimum_disk_free_percent,
    });
  }

  const decision: BudgetDecision = violations.length === 0 ? "ALLOW" : "DENY";

  mkdirSync(BUDGET_HISTORY_ROOT, { recursive: true });
  const stamp = timestamp.replace(/[:.]/g, "-");
  const history_path_abs = join(
    BUDGET_HISTORY_ROOT,
    `budget-${stamp}.json`,
  );
  const report_path_abs = BUDGET_REPORT_PATH;

  const result: ResourceBudgetResult = {
    schema_version: BUDGET_GOVERNOR_VERSION,
    governor_version: BUDGET_GOVERNOR_VERSION,
    timestamp,
    decision,
    policy,
    violations,
    resources: {
      daily_cycles,
      daily_candidates,
      proposed_batch_size,
      founder_queue_waiting,
      disk_free_percent,
      disk_check_available,
      openai_registry_ok,
      openai_registry_detail,
      day_utc: day,
    },
    publication_allowed: false,
    live: false,
    openai_called: false,
    production_triggered: false,
    report_path: relative(repoRoot, report_path_abs).replace(/\\/g, "/"),
    history_path: relative(repoRoot, history_path_abs).replace(/\\/g, "/"),
    duration_ms: Number((performance.now() - t0).toFixed(2)),
  };

  if (opts?.persist !== false) {
    atomicWriteJson(report_path_abs, result);
    atomicWriteJson(BUDGET_REPORT_FLAT, result);
    atomicWriteJson(history_path_abs, result);
  }

  return result;
}
