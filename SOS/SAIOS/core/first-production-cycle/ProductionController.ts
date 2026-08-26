/**
 * Canonical Production Controller — Agent #213 (+ Budget Gate #218).
 * Single orchestration entry for production. Owns orchestration only.
 * Flow: Health Gate → Budget Governor → (DENY stop | ALLOW → BatchRunner) → execution report.
 */
import {
  existsSync,
  mkdirSync,
  readdirSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import {
  DEFAULT_BATCH_SIZE,
  DEFAULT_MAX_OPENAI_PER_BATCH,
  DEFAULT_QUEUE_MAX,
  runCanonicalBatch,
  type BatchRunnerOptions,
  type BatchSummary,
} from "./BatchRunner.js";
import {
  evaluateProductionHealth,
  type ProductionHealthResult,
  type ProductionHealthSimulate,
} from "./ProductionHealthGate.js";
import {
  evaluateResourceBudget,
  type ResourceBudgetResult,
  type ResourceBudgetSimulate,
  type ResourceBudgetPolicy,
} from "./ResourceBudgetGovernor.js";
import type { ProductionTarget } from "./ProductionTarget.js";

const REPO = resolve(import.meta.dirname, "../../../..");
const CYCLE_LOG = join(REPO, "SOS/07_LOGS/saios/first-production-cycle");
export const EXECUTION_LOG_ROOT = join(CYCLE_LOG, "executions");

export type ControllerStopReason =
  | "completed"
  | "health_unhealthy"
  | "budget_denied"
  | "batch_stopped"
  | "fatal_error"
  | "live_refused";

export type ProductionExecutionResult = {
  schema_version: 1;
  execution_id: string;
  started_at: string;
  finished_at: string;
  duration_ms: number;
  health: ProductionHealthResult;
  budget: ResourceBudgetResult | null;
  batch: BatchSummary | null;
  candidate_count: number;
  failure_count: number;
  stop_reason: ControllerStopReason;
  stop_detail: string | null;
  publication_allowed: false;
  live: false;
  entrypoint: "ProductionController";
  report_path: string;
  execution_directory: string;
};

export type ProductionControllerOptions = {
  batch_size?: number;
  queue_max?: number;
  max_openai_per_batch?: number;
  max_attempts?: number;
  force_mock?: boolean;
  select_target?: boolean;
  forced_targets?: ProductionTarget[];
  /** Verify-only health simulation */
  health_simulate?: ProductionHealthSimulate;
  /** Verify-only budget simulation */
  budget_simulate?: ResourceBudgetSimulate;
  /** Optional policy overrides for the Budget Governor */
  budget_policy?: Partial<ResourceBudgetPolicy>;
  /** Extra batch opts passthrough (excluding health_preflight — controller owns health) */
  batch?: Omit<
    BatchRunnerOptions,
    "health_preflight" | "health_simulate" | "batch_size" | "queue_max"
  >;
  /**
   * Agent #231 — verification isolation. Candidates land in candidates-verify/.
   * Health/Budget continue to read the production registry only.
   */
  verification?: boolean;
  verification_context?: string;
  /** Agent #240 — refuse mock-backed successes. */
  require_openai?: boolean;
};

function atomicWriteJson(path: string, data: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  const tmp = `${path}.${process.pid}.${Date.now()}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  renameSync(tmp, path);
}

export function allocateExecutionId(now: Date = new Date()): string {
  mkdirSync(EXECUTION_LOG_ROOT, { recursive: true });
  const day = now.toISOString().slice(0, 10).replace(/-/g, "");
  const prefix = `exec-${day}-`;
  let max = 0;
  if (existsSync(EXECUTION_LOG_ROOT)) {
    for (const name of readdirSync(EXECUTION_LOG_ROOT)) {
      if (!name.startsWith(prefix)) continue;
      const n = Number(name.slice(prefix.length));
      if (Number.isFinite(n) && n > max) max = n;
    }
  }
  return `${prefix}${String(max + 1).padStart(3, "0")}`;
}

function mapBatchStop(
  batch: BatchSummary,
): { reason: ControllerStopReason; detail: string | null } {
  if (batch.stop_reason === "completed") {
    return { reason: "completed", detail: null };
  }
  if (batch.stop_reason === "live_refused") {
    return { reason: "live_refused", detail: batch.stop_detail };
  }
  if (batch.stop_reason === "fatal_error") {
    return { reason: "fatal_error", detail: batch.stop_detail };
  }
  if (batch.stop_reason === "health_unhealthy") {
    // Should not happen when controller skips batch health_preflight
    return { reason: "health_unhealthy", detail: batch.stop_detail };
  }
  return {
    reason: "batch_stopped",
    detail: `${batch.stop_reason}${batch.stop_detail ? `: ${batch.stop_detail}` : ""}`,
  };
}

function writeExecutionMarkdown(result: ProductionExecutionResult): string {
  const lines = [
    `# Production Execution ${result.execution_id}`,
    ``,
    `**entrypoint:** ProductionController`,
    `**started:** ${result.started_at}`,
    `**finished:** ${result.finished_at}`,
    `**duration_ms:** ${result.duration_ms}`,
    `**stop_reason:** ${result.stop_reason}`,
    `**health:** ${result.health.status}`,
    `**budget:** ${result.budget?.decision ?? "—"}`,
    `**template_count:** ${result.candidate_count}`,
    `**failure_count:** ${result.failure_count}`,
    `**publication_allowed:** false`,
    `**LIVE:** OFF`,
    ``,
    `## Health`,
    ``,
    `- failed_checks: ${result.health.failed_checks.join(", ") || "—"}`,
    `- queue: ${result.health.queue_waiting} / ${result.health.queue_max}`,
    ``,
    `## Budget`,
    ``,
    result.budget
      ? [
          `- decision: ${result.budget.decision}`,
          `- violations: ${result.budget.violations.map((v) => v.code).join(", ") || "—"}`,
          `- daily_cycles: ${result.budget.resources.daily_cycles}`,
          `- daily_templates: ${result.budget.resources.daily_candidates}`,
        ].join("\n")
      : `- _(not evaluated — stopped earlier)_`,
    ``,
    `## Batch`,
    ``,
    result.batch
      ? [
          `- batch_id: ${result.batch.batch_id}`,
          `- stop_reason: ${result.batch.stop_reason}`,
          `- accepted: ${result.batch.accepted_count}`,
          `- attempts: ${result.batch.total_attempts}`,
        ].join("\n")
      : `- _(no batch — stopped before BatchRunner)_`,
    ``,
  ];
  return lines.join("\n");
}

/**
 * Canonical production entry. Future scheduler / autonomous mode must call this.
 * Does not own planning, generation, rendering, critic, founder, or publication.
 */
export async function runProduction(
  opts?: ProductionControllerOptions,
): Promise<ProductionExecutionResult> {
  if (process.env.SOS_AIOS_LIVE === "1") {
    throw new Error("ProductionController refuses SOS_AIOS_LIVE=1");
  }

  const started_at = new Date().toISOString();
  const t0 = performance.now();
  const execution_id = allocateExecutionId();
  const execDir = join(EXECUTION_LOG_ROOT, execution_id);
  mkdirSync(execDir, { recursive: true });
  mkdirSync(CYCLE_LOG, { recursive: true });

  const batch_size = Math.max(
    1,
    Math.min(50, Math.floor(opts?.batch_size ?? DEFAULT_BATCH_SIZE)),
  );
  const queue_max = Math.max(
    1,
    Math.floor(opts?.queue_max ?? DEFAULT_QUEUE_MAX),
  );

  // 1. Health Gate
  const health = evaluateProductionHealth({
    cycleLog: CYCLE_LOG,
    queue_max,
    persist: true,
    simulate: opts?.health_simulate,
  });
  atomicWriteJson(join(execDir, "health.json"), health);

  if (health.status !== "HEALTHY") {
    const finished_at = new Date().toISOString();
    const result: ProductionExecutionResult = {
      schema_version: 1,
      execution_id,
      started_at,
      finished_at,
      duration_ms: Number((performance.now() - t0).toFixed(2)),
      health,
      budget: null,
      batch: null,
      candidate_count: 0,
      failure_count: 0,
      stop_reason: "health_unhealthy",
      stop_detail: `Health Gate UNHEALTHY: ${health.failed_checks.join(", ")}`,
      publication_allowed: false,
      live: false,
      entrypoint: "ProductionController",
      report_path: "",
      execution_directory: relative(REPO, execDir).replace(/\\/g, "/"),
    };
    const report_path = join(execDir, "execution-report.json");
    result.report_path = relative(REPO, report_path).replace(/\\/g, "/");
    atomicWriteJson(report_path, result);
    writeFileSync(
      join(execDir, "execution-report.md"),
      `${writeExecutionMarkdown(result)}\n`,
      "utf8",
    );
    atomicWriteJson(join(CYCLE_LOG, "latest-execution.json"), {
      execution_id,
      report_path: result.report_path,
      stop_reason: result.stop_reason,
      health_status: health.status,
      publication_allowed: false,
      finished_at,
    });
    atomicWriteJson(join(CYCLE_LOG, "execution-report.json"), result);
    return result;
  }

  // 2. Budget Governor
  const budget = evaluateResourceBudget({
    cycleLog: CYCLE_LOG,
    executionLogRoot: EXECUTION_LOG_ROOT,
    proposed_batch_size: batch_size,
    policy: {
      ...opts?.budget_policy,
      maximum_founder_queue:
        opts?.budget_policy?.maximum_founder_queue ?? queue_max,
    },
    persist: true,
    simulate: opts?.budget_simulate,
  });
  atomicWriteJson(join(execDir, "budget.json"), budget);

  if (budget.decision === "DENY") {
    const finished_at = new Date().toISOString();
    const result: ProductionExecutionResult = {
      schema_version: 1,
      execution_id,
      started_at,
      finished_at,
      duration_ms: Number((performance.now() - t0).toFixed(2)),
      health,
      budget,
      batch: null,
      candidate_count: 0,
      failure_count: 0,
      stop_reason: "budget_denied",
      stop_detail: `Budget Governor DENY: ${budget.violations.map((v) => v.code).join(", ")}`,
      publication_allowed: false,
      live: false,
      entrypoint: "ProductionController",
      report_path: "",
      execution_directory: relative(REPO, execDir).replace(/\\/g, "/"),
    };
    const report_path = join(execDir, "execution-report.json");
    result.report_path = relative(REPO, report_path).replace(/\\/g, "/");
    atomicWriteJson(report_path, result);
    writeFileSync(
      join(execDir, "execution-report.md"),
      `${writeExecutionMarkdown(result)}\n`,
      "utf8",
    );
    atomicWriteJson(join(CYCLE_LOG, "latest-execution.json"), {
      execution_id,
      report_path: result.report_path,
      stop_reason: result.stop_reason,
      health_status: health.status,
      budget_decision: budget.decision,
      publication_allowed: false,
      finished_at,
    });
    atomicWriteJson(join(CYCLE_LOG, "execution-report.json"), result);
    return result;
  }

  // 3. BatchRunner (health + budget already enforced — skip duplicate health preflight)
  let batch: BatchSummary;
  try {
    batch = await runCanonicalBatch({
      ...opts?.batch,
      batch_size,
      queue_max,
      max_openai_per_batch:
        opts?.max_openai_per_batch ?? DEFAULT_MAX_OPENAI_PER_BATCH,
      max_attempts: opts?.max_attempts,
      force_mock: opts?.force_mock,
      select_target: opts?.select_target !== false,
      forced_targets: opts?.forced_targets,
      health_preflight: false,
      verification: opts?.verification === true,
      verification_context: opts?.verification_context,
      require_openai: opts?.require_openai === true,
    });
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    const finished_at = new Date().toISOString();
    const live = /SOS_AIOS_LIVE/i.test(detail);
    const result: ProductionExecutionResult = {
      schema_version: 1,
      execution_id,
      started_at,
      finished_at,
      duration_ms: Number((performance.now() - t0).toFixed(2)),
      health,
      budget,
      batch: null,
      candidate_count: 0,
      failure_count: 1,
      stop_reason: live ? "live_refused" : "fatal_error",
      stop_detail: detail,
      publication_allowed: false,
      live: false,
      entrypoint: "ProductionController",
      report_path: "",
      execution_directory: relative(REPO, execDir).replace(/\\/g, "/"),
    };
    const report_path = join(execDir, "execution-report.json");
    result.report_path = relative(REPO, report_path).replace(/\\/g, "/");
    atomicWriteJson(report_path, result);
    writeFileSync(
      join(execDir, "execution-report.md"),
      `${writeExecutionMarkdown(result)}\n`,
      "utf8",
    );
    atomicWriteJson(join(CYCLE_LOG, "latest-execution.json"), {
      execution_id,
      report_path: result.report_path,
      stop_reason: result.stop_reason,
      publication_allowed: false,
      finished_at,
    });
    atomicWriteJson(join(CYCLE_LOG, "execution-report.json"), result);
    return result;
  }

  // Attach controller health onto batch summary copy for the report
  const batchWithHealth: BatchSummary = { ...batch, health };
  atomicWriteJson(join(execDir, "batch-summary.json"), batchWithHealth);

  const mapped = mapBatchStop(batch);
  const finished_at = new Date().toISOString();
  const result: ProductionExecutionResult = {
    schema_version: 1,
    execution_id,
    started_at,
    finished_at,
    duration_ms: Number((performance.now() - t0).toFixed(2)),
    health,
    budget,
    batch: batchWithHealth,
    candidate_count: batch.accepted_count,
    failure_count: batch.failure_count,
    stop_reason: mapped.reason,
    stop_detail: mapped.detail,
    publication_allowed: false,
    live: false,
    entrypoint: "ProductionController",
    report_path: "",
    execution_directory: relative(REPO, execDir).replace(/\\/g, "/"),
  };
  const report_path = join(execDir, "execution-report.json");
  result.report_path = relative(REPO, report_path).replace(/\\/g, "/");
  atomicWriteJson(report_path, result);
  writeFileSync(
    join(execDir, "execution-report.md"),
    `${writeExecutionMarkdown(result)}\n`,
    "utf8",
  );
  atomicWriteJson(join(CYCLE_LOG, "latest-execution.json"), {
    execution_id,
    report_path: result.report_path,
    batch_id: batch.batch_id,
    stop_reason: result.stop_reason,
    health_status: health.status,
    budget_decision: budget.decision,
    candidate_count: result.candidate_count,
    publication_allowed: false,
    finished_at,
  });
  atomicWriteJson(join(CYCLE_LOG, "execution-report.json"), result);

  return result;
}

/** Alias for clarity at call sites */
export const ProductionController = {
  run: runProduction,
  allocateExecutionId,
};
