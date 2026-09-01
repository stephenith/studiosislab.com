/**
 * Post-batch Founder Telegram notification — reuses emitAiosOpsAlert /
 * NotificationLiveBridge (SOS_AIOS_NOTIFY_LIVE gate). Fail-open: never throws
 * into generation. One message per batch_id / execution_id.
 */
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { emitAiosOpsAlert } from "../ops/AiosOpsAlert.js";
import type { BatchSummary } from "./BatchRunner.js";
import type { ProductionHealthResult } from "./ProductionHealthGate.js";
import type { ResourceBudgetResult } from "./ResourceBudgetGovernor.js";

/** Structural execution snapshot — avoids circular import with ProductionController. */
export type BatchReadyExecutionSnapshot = {
  execution_id: string;
  finished_at: string;
  candidate_count: number;
  failure_count: number;
  stop_reason: string;
  stop_detail: string | null;
  health: Pick<ProductionHealthResult, "queue_waiting" | "queue_max">;
  budget?: Pick<ResourceBudgetResult, "decision"> | null;
  batch: BatchSummary | null;
};

const REPO = resolve(import.meta.dirname, "../../../..");
const CYCLE_LOG = join(REPO, "SOS/07_LOGS/saios/first-production-cycle");
export const BATCH_READY_LEDGER_PATH = join(
  CYCLE_LOG,
  "batch-ready-notifications.json",
);
export const FOUNDER_DASHBOARD_URL = "https://founder.studiosislab.com";

export type BatchReadySlot = "morning" | "evening" | "manual";
export type BatchReadyState = "full" | "partial" | "needs_attention";

export type BatchReadyNotifyInput = {
  execution_id: string;
  batch_id: string | null;
  slot: BatchReadySlot;
  requested_count: number;
  accepted_count: number;
  failure_count: number;
  queue_waiting: number;
  queue_max: number;
  stop_reason: string | null;
  stop_detail: string | null;
  /** Accepted Resume Template titles (Founder-facing). */
  titles: string[];
  finished_at?: string;
};

export type BatchReadyNotifyResult = {
  attempted: boolean;
  sent: boolean;
  deduped: boolean;
  dry_run: boolean;
  state: BatchReadyState;
  slot: BatchReadySlot;
  title: string;
  message: string;
  notification_type: "batch_ready";
  batch_id: string | null;
  execution_id: string;
  error: string | null;
};

export type BatchReadyNotifyDeps = {
  emitAlert?: typeof emitAiosOpsAlert;
  ledgerPath?: string;
  /** Injected clock for slot/tests. */
  now?: () => Date;
};

type LedgerFile = {
  schema_version: 1;
  entries: Record<
    string,
    {
      sent_at: string;
      state: BatchReadyState;
      slot: BatchReadySlot;
      execution_id: string;
      batch_id: string | null;
      accepted_count: number;
      requested_count: number;
    }
  >;
};

const MORNING_MINUTES = 8 * 60 + 50; // 08:50 IST
const EVENING_MINUTES = 17 * 60 + 50; // 17:50 IST
/** ±30 minutes around scheduled fire time. */
const SLOT_WINDOW_MINUTES = 30;

function atomicWriteJson(path: string, data: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  const tmp = `${path}.${process.pid}.${Date.now()}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  renameSync(tmp, path);
}

function readLedger(path: string): LedgerFile {
  if (!existsSync(path)) {
    return { schema_version: 1, entries: {} };
  }
  try {
    const raw = JSON.parse(readFileSync(path, "utf8")) as LedgerFile;
    if (!raw || typeof raw !== "object" || !raw.entries) {
      return { schema_version: 1, entries: {} };
    }
    return { schema_version: 1, entries: raw.entries };
  } catch {
    return { schema_version: 1, entries: {} };
  }
}

export function batchReadyDedupeKey(input: {
  batch_id: string | null;
  execution_id: string;
}): string {
  if (input.batch_id && input.batch_id.trim()) {
    return `batch:${input.batch_id.trim()}`;
  }
  return `exec:${input.execution_id.trim()}`;
}

/**
 * Resolve morning/evening from explicit env, else IST clock near timer fire.
 * Manual / off-window runs → "manual" (never falsely labeled Morning/Evening).
 */
export function resolveGenerationSlot(
  at: Date = new Date(),
  env: NodeJS.ProcessEnv = process.env,
): BatchReadySlot {
  const forced = String(env.SOS_AIOS_GENERATION_SLOT ?? "")
    .trim()
    .toLowerCase();
  if (forced === "morning" || forced === "evening") return forced;
  if (forced === "manual") return "manual";

  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(at);
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "99");
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? "99");
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return "manual";
  const mins = hour * 60 + minute;
  if (Math.abs(mins - MORNING_MINUTES) <= SLOT_WINDOW_MINUTES) return "morning";
  if (Math.abs(mins - EVENING_MINUTES) <= SLOT_WINDOW_MINUTES) return "evening";
  return "manual";
}

export function classifyBatchReadyState(input: {
  requested_count: number;
  accepted_count: number;
  failure_count?: number;
}): BatchReadyState {
  const requested = Math.max(0, Math.floor(input.requested_count));
  const accepted = Math.max(0, Math.floor(input.accepted_count));
  if (accepted <= 0) return "needs_attention";
  if (requested > 0 && accepted >= requested) return "full";
  return "partial";
}

export function humanizeStopReason(
  stop_reason: string | null | undefined,
  stop_detail?: string | null,
): string {
  const r = String(stop_reason ?? "").trim();
  const detail = String(stop_detail ?? "").trim();
  const map: Record<string, string> = {
    completed: "Batch completed",
    queue_capacity: "Founder Review queue reached capacity",
    no_eligible_targets: "No eligible production targets remaining",
    openai_budget: "OpenAI per-batch budget reached",
    max_attempts: "Maximum selection attempts reached",
    health_unhealthy: "Health gate blocked production",
    budget_denied: "Resource budget denied production",
    batch_stopped: "Batch stopped early",
    fatal_error: "Production controller fatal error",
    live_refused: "LIVE mode refused",
    require_openai_violated: "OpenAI requirement not satisfied",
  };
  const base = map[r] ?? (r || "Unknown stop reason");
  if (detail && detail.length > 0 && detail.length < 180 && detail !== r) {
    return `${base} (${detail})`;
  }
  return base;
}

function slotLabel(slot: BatchReadySlot): string {
  if (slot === "morning") return "Morning";
  if (slot === "evening") return "Evening";
  return "Generation";
}

export function formatBatchReadyTitle(
  slot: BatchReadySlot,
  state: BatchReadyState,
): string {
  const s = slotLabel(slot);
  if (state === "full") return `${s} Batch Ready`;
  if (state === "partial") return `${s} Batch Partial`;
  return `${s} Batch Needs Attention`;
}

export function formatBatchReadyMessage(input: BatchReadyNotifyInput): {
  state: BatchReadyState;
  title: string;
  message: string;
} {
  const state = classifyBatchReadyState(input);
  const title = formatBatchReadyTitle(input.slot, state);
  const reason = humanizeStopReason(input.stop_reason, input.stop_detail);
  const titles = input.titles.filter((t) => t && t.trim());
  const list =
    titles.length > 0
      ? titles.map((t, i) => `${i + 1}. ${t.trim()}`).join("\n")
      : "(none)";

  let message: string;
  if (state === "full") {
    message = [
      `${input.accepted_count} Resume Templates ready for Founder Review`,
      ``,
      `Generated: ${input.accepted_count}/${input.requested_count}`,
      `Founder Queue: ${input.queue_waiting}/${input.queue_max}`,
      `Batch: ${input.batch_id ?? input.execution_id}`,
      ``,
      `Resume Templates:`,
      list,
      ``,
      `Founder Dashboard:`,
      FOUNDER_DASHBOARD_URL,
    ].join("\n");
  } else if (state === "partial") {
    message = [
      `Generated: ${input.accepted_count}/${input.requested_count}`,
      `Founder Queue: ${input.queue_waiting}/${input.queue_max}`,
      `Stop reason: ${reason}`,
      `Batch: ${input.batch_id ?? input.execution_id}`,
      ``,
      `Ready:`,
      list,
      ``,
      `Founder Dashboard:`,
      FOUNDER_DASHBOARD_URL,
    ].join("\n");
  } else {
    message = [
      `Generated: ${input.accepted_count}/${input.requested_count}`,
      `Reason: ${reason}`,
      `Batch: ${input.batch_id ?? input.execution_id}`,
      ``,
      `Founder Dashboard:`,
      FOUNDER_DASHBOARD_URL,
    ].join("\n");
  }

  return { state, title, message };
}

function acceptedTitles(batch: BatchSummary | null): string[] {
  if (!batch) return [];
  return batch.candidates
    .filter((c) => c.result === "WAITING_FOUNDER")
    .sort((a, b) => (a.sequence ?? 0) - (b.sequence ?? 0))
    .map((c) => {
      const t = (c.title ?? "").trim();
      if (t) return t;
      const cat = (c.category ?? "").trim();
      return cat || c.candidate_id || "Resume Template";
    });
}

export function buildBatchReadyNotifyInputFromExecution(
  result: BatchReadyExecutionSnapshot,
  opts?: { slot?: BatchReadySlot; now?: () => Date },
): BatchReadyNotifyInput {
  const batch = result.batch;
  const accepted = batch?.accepted_count ?? result.candidate_count ?? 0;
  const requested =
    batch?.requested_size ??
    batch?.batch_size_requested ??
    Math.max(accepted, 1);
  const queue_max = batch?.queue_max ?? result.health.queue_max;
  const preWaiting = Math.max(0, result.health.queue_waiting);
  const queue_waiting = Math.min(queue_max, preWaiting + Math.max(0, accepted));
  const slot =
    opts?.slot ??
    resolveGenerationSlot(opts?.now ? opts.now() : new Date(result.finished_at));

  return {
    execution_id: result.execution_id,
    batch_id: batch?.batch_id ?? null,
    slot,
    requested_count: requested,
    accepted_count: accepted,
    failure_count: batch?.failure_count ?? result.failure_count,
    queue_waiting,
    queue_max,
    stop_reason: batch?.stop_reason ?? result.stop_reason,
    stop_detail: batch?.stop_detail ?? result.stop_detail,
    titles: acceptedTitles(batch),
    finished_at: result.finished_at,
  };
}

/**
 * Send batch-ready Telegram (or dry-run). Never throws. Dedupes by batch_id.
 */
export async function notifyBatchReady(
  input: BatchReadyNotifyInput,
  deps: BatchReadyNotifyDeps = {},
): Promise<BatchReadyNotifyResult> {
  const formatted = formatBatchReadyMessage(input);
  const ledgerPath = deps.ledgerPath ?? BATCH_READY_LEDGER_PATH;
  const key = batchReadyDedupeKey(input);
  const ledger = readLedger(ledgerPath);

  if (ledger.entries[key]) {
    return {
      attempted: false,
      sent: false,
      deduped: true,
      dry_run: process.env.SOS_AIOS_NOTIFY_LIVE !== "1",
      state: formatted.state,
      slot: input.slot,
      title: formatted.title,
      message: formatted.message,
      notification_type: "batch_ready",
      batch_id: input.batch_id,
      execution_id: input.execution_id,
      error: null,
    };
  }

  const severity =
    formatted.state === "full" ? ("P2" as const) : ("P1" as const);
  const emit = deps.emitAlert ?? emitAiosOpsAlert;

  try {
    const result = await emit({
      title: formatted.title,
      message: formatted.message,
      severity,
      meta: {
        notification_type: "batch_ready",
        batch_id: input.batch_id,
        execution_id: input.execution_id,
        slot: input.slot,
        requested_count: input.requested_count,
        accepted_count: input.accepted_count,
        queue_waiting: input.queue_waiting,
        queue_max: input.queue_max,
        stop_reason: input.stop_reason,
        state: formatted.state,
      },
    });

    // Dedupe only after a successful delivery attempt (live or dry-run).
    if (result.ok) {
      ledger.entries[key] = {
        sent_at: new Date().toISOString(),
        state: formatted.state,
        slot: input.slot,
        execution_id: input.execution_id,
        batch_id: input.batch_id,
        accepted_count: input.accepted_count,
        requested_count: input.requested_count,
      };
      try {
        atomicWriteJson(ledgerPath, ledger);
      } catch {
        /* ledger fail-open */
      }
    }

    return {
      attempted: true,
      sent: result.ok === true,
      deduped: false,
      dry_run: result.dry_run === true,
      state: formatted.state,
      slot: input.slot,
      title: formatted.title,
      message: formatted.message,
      notification_type: "batch_ready",
      batch_id: input.batch_id,
      execution_id: input.execution_id,
      error: result.error ?? null,
    };
  } catch (e) {
    return {
      attempted: true,
      sent: false,
      deduped: false,
      dry_run: process.env.SOS_AIOS_NOTIFY_LIVE !== "1",
      state: formatted.state,
      slot: input.slot,
      title: formatted.title,
      message: formatted.message,
      notification_type: "batch_ready",
      batch_id: input.batch_id,
      execution_id: input.execution_id,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

/**
 * Fail-open post-execution hook. Skips verification isolation runs.
 */
export async function notifyBatchReadyAfterExecution(
  result: BatchReadyExecutionSnapshot,
  opts?: {
    verification?: boolean;
    deps?: BatchReadyNotifyDeps;
    slot?: BatchReadySlot;
  },
): Promise<BatchReadyNotifyResult | null> {
  if (opts?.verification === true) return null;
  try {
    const input = buildBatchReadyNotifyInputFromExecution(result, {
      slot: opts?.slot,
      now: opts?.deps?.now,
    });
    return await notifyBatchReady(input, opts?.deps);
  } catch {
    return null;
  }
}
