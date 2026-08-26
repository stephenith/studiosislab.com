/**
 * Canonical Sequential Batch Production — Agent #209 / #210.
 * Orchestrates runFirstProductionCycle only. No parallel execution. No publication.
 * #210: duplicate skips retry with alternate targets (bounded attempts).
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
  CYCLE_LOG,
  runFirstProductionCycle,
  type CycleResult,
} from "./runFirstProductionCycle.js";
import { countFounderReviewWaiting } from "../founder-review/FounderReviewProjection.js";
import { selectNextProductionTarget } from "./selectProductionTarget.js";
import {
  createBatchLocalDuplicateState,
  fingerprintProductionTarget,
  recordBatchLocalAttempt,
  type DuplicateDecision,
} from "./DuplicateDetector.js";
import type { ProductionTarget } from "./ProductionTarget.js";
import {
  evaluateProductionHealth,
  type ProductionHealthResult,
  type ProductionHealthSimulate,
} from "./ProductionHealthGate.js";

const REPO = resolve(import.meta.dirname, "../../../..");

export const BATCH_LOG_ROOT = join(CYCLE_LOG, "batches");

export const DEFAULT_BATCH_SIZE = 5;
export const DEFAULT_QUEUE_MAX = 20;
export const DEFAULT_MAX_OPENAI_PER_BATCH = 5;

export type BatchStopReason =
  | "completed"
  | "queue_capacity"
  | "openai_budget"
  | "fatal_error"
  | "live_refused"
  | "max_attempts"
  | "no_eligible_targets"
  | "health_unhealthy"
  | "require_openai_violated";

export type BatchDuplicateSkipRecord = {
  attempt: number;
  duplicate_type: DuplicateDecision["duplicate_type"];
  target_fingerprint: string;
  matched_candidate_id: string | null;
  category: string;
  title: string;
  reason: string;
  checked_at: string;
};

export type BatchCandidateRecord = {
  sequence: number;
  of: number;
  candidate_id: string | null;
  review_id: string | null;
  task_id: string | null;
  candidate_dir: string | null;
  title: string | null;
  category: string | null;
  industry: string | null;
  seniority: string | null;
  provider: string | null;
  result: "WAITING_FOUNDER" | "FAILED" | "CRITIC_BLOCKED" | "SKIPPED" | "PREVIEW_FAILED" | "THUMBNAIL_FAILED";
  overall: "PASS" | "FAIL" | "SKIPPED";
  duration_ms: number;
  error: string | null;
  started_at: string;
  finished_at: string;
  target_fingerprint?: string | null;
};

export type BatchSummary = {
  schema_version: 1;
  batch_id: string;
  started_at: string;
  finished_at: string;
  duration_ms: number;
  batch_size_requested: number;
  requested_size: number;
  accepted_count: number;
  candidates_attempted: number;
  total_attempts: number;
  maximum_attempts: number;
  duplicate_skip_count: number;
  success_count: number;
  failure_count: number;
  waiting_founder_count: number;
  critic_blocked_count: number;
  skipped_count: number;
  queue_max: number;
  max_openai_per_batch: number;
  openai_used_count: number;
  stop_reason: BatchStopReason;
  stop_detail: string | null;
  publication_allowed: false;
  live: false;
  sequential: true;
  provider_mode: "mock" | "openai_eligible" | "mixed";
  candidates: BatchCandidateRecord[];
  duplicate_skips: BatchDuplicateSkipRecord[];
  batch_directory: string;
  summary_path: string;
  report_path: string;
  health?: ProductionHealthResult | null;
};

export type BatchRunnerOptions = {
  batch_size?: number;
  queue_max?: number;
  max_openai_per_batch?: number;
  /** max(batch_size * 3, batch_size + 5) when omitted */
  max_attempts?: number;
  force_mock?: boolean;
  select_target?: boolean;
  /**
   * Optional ordered targets (verify / maintenance).
   * Consumed before coverage selection when present.
   */
  forced_targets?: ProductionTarget[];
  /** When false, skip Health Gate (verify only). Default true. */
  health_preflight?: boolean;
  /** Injected health simulation (verify only). */
  health_simulate?: ProductionHealthSimulate;
  /**
   * Agent #231 — persist accepted candidates under candidates-verify/.
   * Production queue / Budget / Health still count the production registry.
   */
  verification?: boolean;
  verification_context?: string;
  /**
   * Agent #240 — refuse mock-backed successes.
   * If a completed candidate is not OpenAI-backed, stop the batch safely.
   */
  require_openai?: boolean;
};

function atomicWriteJson(path: string, data: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  const tmp = `${path}.${process.pid}.${Date.now()}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  renameSync(tmp, path);
}

function openaiEligible(): boolean {
  const key =
    process.env.OPENAI_API_KEY?.trim() ||
    process.env.SOS_OPENAI_API_KEY?.trim();
  if (!key) return false;
  return (
    process.env.SOS_AI_FOUNDER_OPENAI_BOUNDED === "1" ||
    process.env.SOS_AI_FOUNDER_OPENAI_ONE_TEST === "1"
  );
}

function readProvider(candidateDir: string): string | null {
  try {
    const mp = JSON.parse(
      readFileSync(join(candidateDir, "mock-provider.json"), "utf8"),
    ) as { provider?: string };
    return mp.provider ?? null;
  } catch {
    return null;
  }
}

export function defaultMaxAttempts(batchSize: number): number {
  return Math.max(batchSize * 3, batchSize + 5);
}

export function allocateBatchId(now: Date = new Date()): string {
  mkdirSync(BATCH_LOG_ROOT, { recursive: true });
  const day = now.toISOString().slice(0, 10).replace(/-/g, "");
  const prefix = `batch-${day}-`;
  let max = 0;
  if (existsSync(BATCH_LOG_ROOT)) {
    for (const name of readdirSync(BATCH_LOG_ROOT)) {
      if (!name.startsWith(prefix)) continue;
      const n = Number(name.slice(prefix.length));
      if (Number.isFinite(n) && n > max) max = n;
    }
  }
  const seq = String(max + 1).padStart(3, "0");
  return `${prefix}${seq}`;
}

function isFatalError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  const lower = msg.toLowerCase();
  if (/SOS_AIOS_LIVE=1/i.test(msg)) return true;
  if (/runtime guard|engine access|execution lock/i.test(msg)) return true;
  if (/ENOSPC|EACCES|EROFS/i.test(msg)) return true;
  if (/filesystem|no space|permission denied/i.test(lower)) return true;
  if (
    /authentication|unauthorized|401|invalid.?api.?key|openai.*auth/i.test(
      lower,
    )
  ) {
    return true;
  }
  if (/configuration corruption/i.test(lower)) return true;
  return false;
}

function buildReportMarkdown(summary: BatchSummary): string {
  const lines = [
    `# Canonical Batch ${summary.batch_id}`,
    ``,
    `- started: ${summary.started_at}`,
    `- finished: ${summary.finished_at}`,
    `- duration_ms: ${summary.duration_ms}`,
    `- requested: ${summary.requested_size}`,
    `- accepted: ${summary.accepted_count}`,
    `- total_attempts: ${summary.total_attempts} / max ${summary.maximum_attempts}`,
    `- duplicate_skips: ${summary.duplicate_skip_count}`,
    `- success (WAITING_FOUNDER): ${summary.waiting_founder_count}`,
    `- failed: ${summary.failure_count}`,
    `- stop_reason: ${summary.stop_reason}`,
    summary.stop_detail ? `- stop_detail: ${summary.stop_detail}` : null,
    `- publication_allowed: false`,
    `- LIVE: OFF`,
    `- sequential: true`,
    ``,
    `## Accepted candidates`,
    ``,
    `| # | candidate_id | title | category | result | provider | duration_ms |`,
    `|---|--------------|-------|----------|--------|----------|-------------|`,
    ...summary.candidates.map(
      (c) =>
        `| ${c.sequence}/${c.of} | ${c.candidate_id ?? "—"} | ${c.title ?? "—"} | ${c.category ?? "—"} | ${c.result} | ${c.provider ?? "—"} | ${c.duration_ms} |`,
    ),
    ``,
    `## Duplicate skips`,
    ``,
    ...(summary.duplicate_skips.length
      ? summary.duplicate_skips.map(
          (d) =>
            `- attempt ${d.attempt}: ${d.duplicate_type} · ${d.category}/${d.title} · matched=${d.matched_candidate_id ?? "—"} · ${d.reason}`,
        )
      : [`- (none)`]),
    ``,
  ];
  return lines.filter((l) => l !== null).join("\n");
}

/**
 * Run until N accepted WAITING_FOUNDER candidates (or stop conditions).
 * Strictly sequential. Duplicate skips do not consume accepted slots.
 * Agent #212: Production Health Gate must return HEALTHY before any target selection.
 */
export async function runCanonicalBatch(
  opts?: BatchRunnerOptions,
): Promise<BatchSummary> {
  if (process.env.SOS_AIOS_LIVE === "1") {
    throw new Error("Canonical batch refuses SOS_AIOS_LIVE=1");
  }

  if (opts?.force_mock) {
    delete process.env.SOS_AI_FOUNDER_OPENAI_ONE_TEST;
    delete process.env.OPENAI_API_KEY;
    delete process.env.SOS_OPENAI_API_KEY;
  }

  const batch_size = Math.max(
    1,
    Math.min(50, Math.floor(opts?.batch_size ?? DEFAULT_BATCH_SIZE)),
  );
  const queue_max = Math.max(
    1,
    Math.floor(opts?.queue_max ?? DEFAULT_QUEUE_MAX),
  );
  const max_openai_per_batch = Math.max(
    0,
    Math.floor(opts?.max_openai_per_batch ?? DEFAULT_MAX_OPENAI_PER_BATCH),
  );
  const maximum_attempts =
    opts?.max_attempts != null
      ? Math.max(1, Math.floor(opts.max_attempts))
      : defaultMaxAttempts(batch_size);
  const select_target = opts?.select_target !== false;
  const forced_targets = [...(opts?.forced_targets ?? [])];
  let forced_index = 0;

  mkdirSync(CYCLE_LOG, { recursive: true });
  mkdirSync(BATCH_LOG_ROOT, { recursive: true });

  // Agent #212 — Health Gate before batch id / target selection
  let health: ProductionHealthResult | null = null;
  if (opts?.health_preflight !== false) {
    health = evaluateProductionHealth({
      cycleLog: CYCLE_LOG,
      queue_max,
      persist: true,
      simulate: opts?.health_simulate,
    });
    if (health.status !== "HEALTHY") {
      const started_at = new Date().toISOString();
      const finished_at = started_at;
      const batch_id = `batch-health-abort-${started_at.slice(0, 10).replace(/-/g, "")}`;
      const batchDir = join(BATCH_LOG_ROOT, batch_id);
      mkdirSync(batchDir, { recursive: true });
      const summary_path = join(batchDir, "batch-summary.json");
      const report_path = join(batchDir, "batch-report.md");
      const summary: BatchSummary = {
        schema_version: 1,
        batch_id,
        started_at,
        finished_at,
        duration_ms: 0,
        batch_size_requested: batch_size,
        requested_size: batch_size,
        accepted_count: 0,
        candidates_attempted: 0,
        total_attempts: 0,
        maximum_attempts,
        duplicate_skip_count: 0,
        success_count: 0,
        failure_count: 0,
        waiting_founder_count: 0,
        critic_blocked_count: 0,
        skipped_count: 0,
        queue_max,
        max_openai_per_batch,
        openai_used_count: 0,
        stop_reason: "health_unhealthy",
        stop_detail: `Production Health Gate UNHEALTHY: ${health.failed_checks.join(", ")}`,
        publication_allowed: false,
        live: false,
        sequential: true,
        provider_mode: "mock",
        candidates: [],
        duplicate_skips: [],
        batch_directory: relative(REPO, batchDir).replace(/\\/g, "/"),
        summary_path: relative(REPO, summary_path).replace(/\\/g, "/"),
        report_path: relative(REPO, report_path).replace(/\\/g, "/"),
        health,
      };
      atomicWriteJson(summary_path, summary);
      writeFileSync(
        report_path,
        [
          `# Batch ${batch_id}`,
          ``,
          `**stop_reason:** health_unhealthy`,
          `**health:** UNHEALTHY`,
          `**failed_checks:** ${health.failed_checks.join(", ") || "—"}`,
          `**publication_allowed:** false`,
          `**LIVE:** OFF`,
          ``,
          `No targets selected. No production executed.`,
          ``,
        ].join("\n"),
        "utf8",
      );
      atomicWriteJson(join(CYCLE_LOG, "latest-batch.json"), {
        schema_version: 1,
        batch_id,
        stop_reason: "health_unhealthy",
        health_status: health.status,
        failed_checks: health.failed_checks,
        publication_allowed: false,
      });
      atomicWriteJson(join(CYCLE_LOG, "batch-summary.json"), summary);
      return summary;
    }
  }

  const batch_id = allocateBatchId();
  const batchDir = join(BATCH_LOG_ROOT, batch_id);
  mkdirSync(batchDir, { recursive: true });

  const started_at = new Date().toISOString();
  const t0 = performance.now();
  const candidates: BatchCandidateRecord[] = [];
  const duplicate_skips: BatchDuplicateSkipRecord[] = [];
  const batchLocal = createBatchLocalDuplicateState();
  let openai_used_count = 0;
  let stop_reason: BatchStopReason = "completed";
  let stop_detail: string | null = null;
  let total_attempts = 0;
  let accepted = 0;

  while (accepted < batch_size && total_attempts < maximum_attempts) {
    // Agent #231 — verification artifacts do not enter Founder Review / production
    // queue capacity. Capacity gate applies only to production registry writes.
    const waiting = countFounderReviewWaiting(REPO);
    if (!opts?.verification && waiting >= queue_max) {
      stop_reason = "queue_capacity";
      stop_detail = `Founder queue reached capacity (${waiting} >= ${queue_max})`;
      break;
    }

    if (openaiEligible() && openai_used_count >= max_openai_per_batch) {
      stop_reason = "openai_budget";
      stop_detail = `OpenAI-backed candidates per batch reached maximum (${max_openai_per_batch})`;
      break;
    }

    total_attempts += 1;
    const seqStarted = new Date().toISOString();
    const seqT0 = performance.now();

    const exclude = [
      ...batchLocal.accepted_fingerprints,
      ...batchLocal.skipped_fingerprints,
      ...batchLocal.attempted_fingerprints,
    ];

    const fromForced = forced_index < forced_targets.length;
    const target = fromForced
      ? forced_targets[forced_index++]
      : select_target
        ? selectNextProductionTarget(undefined, {
            excludeFingerprints: exclude,
          })
        : undefined;

    // If selection fell back to a still-excluded fingerprint, stop — no alternatives
    if (!fromForced && target) {
      const fp = fingerprintProductionTarget(target);
      if (exclude.includes(fp) && exclude.length > 0) {
        stop_reason = "no_eligible_targets";
        stop_detail =
          "No eligible production targets remain after duplicate exclusions";
        break;
      }
    }

    let result: CycleResult;
    try {
      result = await runFirstProductionCycle({
        pause_for_founder: true,
        select_target: false,
        target,
        excludeFingerprints: exclude,
        duplicate_context: batchLocal,
        duplicate_preflight: true,
        batch: {
          batch_id,
          batch_sequence: accepted + 1,
          batch_size,
        },
        verification: opts?.verification === true,
        verification_context: opts?.verification_context,
      });
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      candidates.push({
        sequence: accepted + 1,
        of: batch_size,
        candidate_id: null,
        review_id: null,
        task_id: null,
        candidate_dir: null,
        title: null,
        category: target?.category ?? null,
        industry: target?.industry ?? null,
        seniority: target?.seniority ?? null,
        provider: null,
        result: "FAILED",
        overall: "FAIL",
        duration_ms: Number((performance.now() - seqT0).toFixed(2)),
        error: detail,
        started_at: seqStarted,
        finished_at: new Date().toISOString(),
      });
      if (isFatalError(err)) {
        stop_reason = /SOS_AIOS_LIVE/i.test(detail)
          ? "live_refused"
          : "fatal_error";
        stop_detail = detail;
        break;
      }
      continue;
    }

    if (result.state === "DUPLICATE_SKIPPED" && result.duplicate_decision) {
      const d = result.duplicate_decision;
      recordBatchLocalAttempt(batchLocal, d.target_fingerprint, "skipped");
      duplicate_skips.push({
        attempt: total_attempts,
        duplicate_type: d.duplicate_type,
        target_fingerprint: d.target_fingerprint,
        matched_candidate_id: d.matched_candidate_id,
        category: result.production_target.category,
        title: result.production_target.title,
        reason: d.reason,
        checked_at: d.checked_at,
      });
      // Write skip into batch dir (diagnostic only)
      atomicWriteJson(join(batchDir, `duplicate-skip-${total_attempts}.json`), {
        attempt: total_attempts,
        decision: d,
        target: result.production_target,
      });
      continue;
    }

    const providerLabel = result.candidate_dir
      ? readProvider(result.candidate_dir)
      : null;
    if (providerLabel === "openai") openai_used_count += 1;

    if (
      opts?.require_openai &&
      result.state === "WAITING_FOUNDER" &&
      providerLabel !== "openai"
    ) {
      candidates.push({
        sequence: accepted + 1,
        of: batch_size,
        candidate_id: result.candidate_id ?? null,
        review_id: result.review_id ?? null,
        task_id: result.task_id ?? null,
        candidate_dir: result.candidate_dir
          ? relative(REPO, result.candidate_dir).replace(/\\/g, "/")
          : null,
        title: result.production_target.title,
        category: result.production_target.category,
        industry: result.production_target.industry,
        seniority: result.production_target.seniority,
        provider: providerLabel,
        result: "FAILED",
        overall: "FAIL",
        duration_ms: Number((performance.now() - seqT0).toFixed(2)),
        error: `require_openai violated: provider=${providerLabel ?? "null"}`,
        started_at: seqStarted,
        finished_at: new Date().toISOString(),
      });
      stop_reason = "require_openai_violated";
      stop_detail = `Candidate used ${providerLabel ?? "unknown"} instead of openai — stopped without mock substitution`;
      break;
    }

    const mappedResult: BatchCandidateRecord["result"] =
      result.state === "WAITING_FOUNDER"
        ? "WAITING_FOUNDER"
        : result.state === "CRITIC_BLOCKED"
          ? "CRITIC_BLOCKED"
          : result.state === "PREVIEW_FAILED"
            ? "PREVIEW_FAILED"
            : result.state === "THUMBNAIL_FAILED"
              ? "THUMBNAIL_FAILED"
              : "FAILED";

    const fp =
      result.duplicate_decision?.target_fingerprint ??
      fingerprintProductionTarget(result.production_target);

    if (mappedResult === "WAITING_FOUNDER") {
      recordBatchLocalAttempt(batchLocal, fp, "accepted");
      accepted += 1;
    } else {
      recordBatchLocalAttempt(batchLocal, fp, "skipped");
    }

    candidates.push({
      sequence: accepted || candidates.length + 1,
      of: batch_size,
      candidate_id: result.candidate_id || null,
      review_id: result.review_id || null,
      task_id: result.task_id || null,
      candidate_dir: result.candidate_dir
        ? relative(REPO, result.candidate_dir).replace(/\\/g, "/")
        : null,
      title: result.candidate_title,
      category: result.production_target.category,
      industry: result.production_target.industry,
      seniority: result.production_target.seniority,
      provider: providerLabel,
      result: mappedResult,
      overall: result.overall === "SKIPPED" ? "SKIPPED" : result.overall,
      duration_ms: Number((performance.now() - seqT0).toFixed(2)),
      error: mappedResult === "FAILED" ? `state=${result.state}` : null,
      started_at: seqStarted,
      finished_at: new Date().toISOString(),
      target_fingerprint: fp,
    });
  }

  if (accepted < batch_size && stop_reason === "completed") {
    if (total_attempts >= maximum_attempts) {
      stop_reason = "max_attempts";
      stop_detail = `Reached maximum attempts (${maximum_attempts}) with ${accepted}/${batch_size} accepted`;
    }
  }

  // Renumber accepted sequences for clarity
  let seq = 0;
  for (const c of candidates) {
    if (c.result === "WAITING_FOUNDER") {
      seq += 1;
      c.sequence = seq;
      c.of = batch_size;
    }
  }

  const finished_at = new Date().toISOString();
  const success_count = candidates.filter((c) => c.overall === "PASS").length;
  const failure_count = candidates.filter((c) => c.result === "FAILED").length;
  const waiting_founder_count = candidates.filter(
    (c) => c.result === "WAITING_FOUNDER",
  ).length;
  const critic_blocked_count = candidates.filter(
    (c) => c.result === "CRITIC_BLOCKED",
  ).length;
  const skipped_count = duplicate_skips.length;

  const providers = new Set(
    candidates.map((c) => c.provider).filter(Boolean) as string[],
  );
  const provider_mode: BatchSummary["provider_mode"] =
    providers.has("openai") && providers.has("mock")
      ? "mixed"
      : providers.has("openai")
        ? "openai_eligible"
        : "mock";

  const summary_path = join(batchDir, "batch-summary.json");
  const report_path = join(batchDir, "batch-report.md");

  const summary: BatchSummary = {
    schema_version: 1,
    batch_id,
    started_at,
    finished_at,
    duration_ms: Number((performance.now() - t0).toFixed(2)),
    batch_size_requested: batch_size,
    requested_size: batch_size,
    accepted_count: accepted,
    candidates_attempted: candidates.length,
    total_attempts,
    maximum_attempts,
    duplicate_skip_count: duplicate_skips.length,
    success_count,
    failure_count,
    waiting_founder_count,
    critic_blocked_count,
    skipped_count,
    queue_max,
    max_openai_per_batch,
    openai_used_count,
    stop_reason,
    stop_detail,
    publication_allowed: false,
    live: false,
    sequential: true,
    provider_mode,
    candidates,
    duplicate_skips,
    batch_directory: relative(REPO, batchDir).replace(/\\/g, "/"),
    summary_path: relative(REPO, summary_path).replace(/\\/g, "/"),
    report_path: relative(REPO, report_path).replace(/\\/g, "/"),
    health,
  };

  atomicWriteJson(summary_path, summary);
  writeFileSync(report_path, `${buildReportMarkdown(summary)}\n`, "utf8");
  atomicWriteJson(join(CYCLE_LOG, "latest-batch.json"), {
    schema_version: 1,
    batch_id,
    batch_directory: summary.batch_directory,
    summary_path: summary.summary_path,
    report_path: summary.report_path,
    finished_at,
    stop_reason,
    publication_allowed: false,
  });
  atomicWriteJson(join(CYCLE_LOG, "batch-summary.json"), summary);

  return summary;
}
