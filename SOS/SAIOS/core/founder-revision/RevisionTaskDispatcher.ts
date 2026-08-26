/**
 * Lightweight Founder-feedback revision dispatcher.
 * Claims PENDING RevisionTasks and runs existing runFounderFeedbackRevision.
 * LIVE OFF. No publication. No UI. No second pipeline.
 */
import {
  DEFAULT_STALE_EXECUTING_MS,
  IN_FLIGHT_REVISION_STATUSES,
  TERMINAL_REVISION_STATUSES,
  listRevisionTasks,
  releaseRevisionTaskLock,
  tryClaimRevisionTask,
  updateRevisionTask,
  type ClaimRevisionResult,
} from "./RevisionTaskStore.js";
import {
  runFounderFeedbackRevision,
  type RunRevisionResult,
} from "./FounderRevisionPipeline.js";
import type { RevisionTask } from "./revision-task-types.js";
import { canUseFounderOpenAIOneTest } from "../resume-integration/FounderOpenAIOneTest.js";

/** Conservative poll interval — Founder Dashboard is persistent under systemd. */
export const DEFAULT_REVISION_POLL_INTERVAL_MS = 60_000;

export type RevisionDispatcherDeps = {
  listTasks?: () => RevisionTask[];
  claimTask?: (
    taskId: string,
    opts?: { staleExecutingMs?: number; now?: Date },
  ) => ClaimRevisionResult;
  runTask?: (taskId: string) => Promise<RunRevisionResult>;
  releaseLock?: (taskId: string) => void;
  canRunOpenAI?: () => boolean;
  isLiveOff?: () => boolean;
  now?: () => Date;
  pollIntervalMs?: number;
  staleExecutingMs?: number;
  log?: (msg: string, detail?: Record<string, unknown>) => void;
};

export type RevisionDispatcherHandle = {
  stop: () => void;
  isRunning: () => boolean;
  /** Test/ops: run one poll cycle immediately. */
  tickOnce: () => Promise<void>;
};

type GlobalDispatchFlag = typeof globalThis & {
  __aiosRevisionDispatcherStarted?: boolean;
  __aiosRevisionDispatcherHandle?: RevisionDispatcherHandle | null;
};

function defaultLog(msg: string, detail?: Record<string, unknown>): void {
  if (detail) {
    console.log(`[revision-dispatcher] ${msg}`, detail);
  } else {
    console.log(`[revision-dispatcher] ${msg}`);
  }
}

function pickNextTaskId(
  tasks: RevisionTask[],
  staleMs: number,
  now: Date,
): string | null {
  const pending = tasks
    .filter((t) => t.status === "PENDING")
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
  if (pending[0]) return pending[0].task_id;

  // Stale in-flight recovery (explicit policy): only after timeout.
  const stale = tasks
    .filter((t) => IN_FLIGHT_REVISION_STATUSES.has(t.status))
    .filter((t) => {
      const updated = Date.parse(t.updated_at);
      if (!Number.isFinite(updated)) return true;
      return now.getTime() - updated >= staleMs;
    })
    .sort((a, b) => a.updated_at.localeCompare(b.updated_at));
  return stale[0]?.task_id ?? null;
}

/**
 * One dispatcher poll: claim at most one task, execute, release lock.
 * Survives malformed tasks (listRevisionTasks skips them).
 */
export async function dispatchRevisionTick(
  deps: RevisionDispatcherDeps = {},
): Promise<{
  processed: string | null;
  reason: string;
  ok: boolean | null;
}> {
  const log = deps.log ?? defaultLog;
  const isLiveOff =
    deps.isLiveOff ?? (() => process.env.SOS_AIOS_LIVE !== "1");
  const canRunOpenAI =
    deps.canRunOpenAI ?? (() => canUseFounderOpenAIOneTest("INTERNAL"));
  const listTasks = deps.listTasks ?? listRevisionTasks;
  const claimTask = deps.claimTask ?? tryClaimRevisionTask;
  const runTask = deps.runTask ?? ((id) => runFounderFeedbackRevision({ task_id: id }));
  const releaseLock = deps.releaseLock ?? releaseRevisionTaskLock;
  const now = deps.now?.() ?? new Date();
  const staleMs = deps.staleExecutingMs ?? DEFAULT_STALE_EXECUTING_MS;

  if (!isLiveOff()) {
    log("skip_tick_live_on");
    return { processed: null, reason: "live_on", ok: null };
  }

  let tasks: RevisionTask[] = [];
  try {
    tasks = listTasks();
  } catch (err) {
    log("list_tasks_failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    return { processed: null, reason: "list_failed", ok: null };
  }

  const taskId = pickNextTaskId(tasks, staleMs, now);
  if (!taskId) {
    return { processed: null, reason: "idle", ok: null };
  }

  // Fail closed before claim when OpenAI gate is closed (leave PENDING).
  const candidate = tasks.find((t) => t.task_id === taskId);
  if (candidate?.status === "PENDING" && !canRunOpenAI()) {
    log("skip_pending_openai_gate_closed", { task_id: taskId });
    return { processed: null, reason: "openai_gate_closed", ok: null };
  }

  let claim: ClaimRevisionResult;
  try {
    claim = claimTask(taskId, { staleExecutingMs: staleMs, now });
  } catch (err) {
    log("claim_threw", {
      task_id: taskId,
      error: err instanceof Error ? err.message : String(err),
    });
    return { processed: null, reason: "claim_threw", ok: null };
  }

  if (!claim.claimed) {
    return {
      processed: null,
      reason: claim.reason,
      ok: null,
    };
  }

  const claimedId = claim.claimed.task_id;
  log("claimed", { task_id: claimedId, reason: claim.reason });

  // Re-check gate after claim for PENDING path; if closed, revert to PENDING.
  if (!canRunOpenAI()) {
    try {
      updateRevisionTask(claimedId, {
        status: "PENDING",
        error: "openai_founder_gate_closed",
      });
    } catch {
      /* best-effort */
    }
    releaseLock(claimedId);
    log("reverted_pending_gate_closed", { task_id: claimedId });
    return { processed: claimedId, reason: "openai_gate_closed_after_claim", ok: false };
  }

  try {
    const result = await runTask(claimedId);
    // Pipeline already sets READY_FOR_FOUNDER_REVIEW or FAILED_* — treat as terminal.
    // Map "COMPLETED" requirement → existing READY_FOR_FOUNDER_REVIEW success status.
    if (result.ok) {
      const finalStatus = result.task.status;
      if (
        finalStatus !== "READY_FOR_FOUNDER_REVIEW" &&
        !TERMINAL_REVISION_STATUSES.has(finalStatus)
      ) {
        updateRevisionTask(claimedId, {
          status: "READY_FOR_FOUNDER_REVIEW",
          revised_candidate_id: result.revised_candidate_id,
          error: null,
        });
      }
      log("completed", {
        task_id: claimedId,
        revised_candidate_id: result.revised_candidate_id,
        status: "READY_FOR_FOUNDER_REVIEW",
      });
      return { processed: claimedId, reason: "completed", ok: true };
    }

    // Ensure failure is terminal FAILED* (pipeline usually already set this).
    if (!TERMINAL_REVISION_STATUSES.has(result.task.status)) {
      updateRevisionTask(claimedId, {
        status: "FAILED",
        error: result.error ?? "revision_failed",
      });
    }
    log("failed", {
      task_id: claimedId,
      error: result.error,
      status: result.task.status,
    });
    try {
      const { emitAiosOpsAlert } = await import("../ops/AiosOpsAlert.js");
      await emitAiosOpsAlert({
        title: `Revision ${result.task.status}`,
        message: `task=${claimedId} error=${result.error ?? "unknown"}`,
        severity: "P1",
        meta: { task_id: claimedId, status: result.task.status },
      });
    } catch {
      /* alert fail-open */
    }
    return { processed: claimedId, reason: "failed", ok: false };
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    try {
      updateRevisionTask(claimedId, {
        status: "FAILED",
        error: `dispatcher_exception: ${detail}`.slice(0, 2000),
      });
    } catch {
      /* ignore */
    }
    log("failed_exception", { task_id: claimedId, error: detail });
    return { processed: claimedId, reason: "exception", ok: false };
  } finally {
    releaseLock(claimedId);
  }
}

/**
 * Start the background poll loop. Idempotent per process (Vite HMR safe).
 * Set SOS_AIOS_REVISION_DISPATCHER=0 to disable.
 */
export function startRevisionTaskDispatcher(
  deps: RevisionDispatcherDeps = {},
): RevisionDispatcherHandle {
  const g = globalThis as GlobalDispatchFlag;
  if (g.__aiosRevisionDispatcherHandle?.isRunning()) {
    return g.__aiosRevisionDispatcherHandle;
  }

  const log = deps.log ?? defaultLog;
  if (process.env.SOS_AIOS_REVISION_DISPATCHER === "0") {
    log("disabled_by_env", { SOS_AIOS_REVISION_DISPATCHER: "0" });
    return {
      stop: () => undefined,
      isRunning: () => false,
      tickOnce: async () => undefined,
    };
  }

  const intervalMs = deps.pollIntervalMs ?? DEFAULT_REVISION_POLL_INTERVAL_MS;
  let stopped = false;
  let timer: ReturnType<typeof setInterval> | null = null;
  let firstTimer: ReturnType<typeof setTimeout> | null = null;
  let tickInFlight = false;

  const tickOnce = async (): Promise<void> => {
    if (stopped || tickInFlight) return;
    tickInFlight = true;
    try {
      await dispatchRevisionTick(deps);
    } catch (err) {
      log("tick_unhandled", {
        error: err instanceof Error ? err.message : String(err),
      });
    } finally {
      tickInFlight = false;
    }
  };

  const handle: RevisionDispatcherHandle = {
    stop: () => {
      stopped = true;
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
      if (firstTimer) {
        clearTimeout(firstTimer);
        firstTimer = null;
      }
      g.__aiosRevisionDispatcherStarted = false;
      g.__aiosRevisionDispatcherHandle = null;
      log("stopped");
    },
    isRunning: () => !stopped,
    tickOnce,
  };

  g.__aiosRevisionDispatcherStarted = true;
  g.__aiosRevisionDispatcherHandle = handle;

  // Conservative: first tick after 5s (HTTP already listening); then interval.
  firstTimer = setTimeout(() => {
    firstTimer = null;
    void tickOnce();
    timer = setInterval(() => {
      void tickOnce();
    }, intervalMs);
    if (typeof timer === "object" && timer && "unref" in timer) {
      (timer as NodeJS.Timeout).unref();
    }
  }, Math.min(5_000, intervalMs));
  if (typeof firstTimer === "object" && firstTimer && "unref" in firstTimer) {
    (firstTimer as NodeJS.Timeout).unref();
  }

  log("started", { pollIntervalMs: intervalMs, firstTickMs: Math.min(5_000, intervalMs) });
  return handle;
}

export function stopRevisionTaskDispatcher(): void {
  const g = globalThis as GlobalDispatchFlag;
  g.__aiosRevisionDispatcherHandle?.stop();
}

export function isRevisionTaskDispatcherRunning(): boolean {
  const g = globalThis as GlobalDispatchFlag;
  return Boolean(g.__aiosRevisionDispatcherHandle?.isRunning());
}
