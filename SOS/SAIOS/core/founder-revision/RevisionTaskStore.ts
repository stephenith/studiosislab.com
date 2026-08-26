/**
 * Durable Founder revision task store — one task per decision_id.
 */
import {
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  readdirSync,
  statSync,
  unlinkSync,
  writeFileSync,
  constants as fsConstants,
} from "node:fs";
import { join, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import type { RevisionTask, RevisionTaskStatus } from "./revision-task-types.js";
import { FOUNDER_FEEDBACK_REVISION_VERSION } from "./revision-task-types.js";

const REPO = resolve(import.meta.dirname, "../../../..");
export const REVISION_TASKS_DIR = join(
  REPO,
  "SOS/07_LOGS/saios/founder-revision/tasks",
);

/** Test-only override — never set in production paths. */
let tasksDirOverride: string | null = null;

export function setRevisionTasksDirForTests(dir: string | null): void {
  tasksDirOverride = dir;
}

function tasksDir(): string {
  return tasksDirOverride ?? REVISION_TASKS_DIR;
}

/** In-flight statuses that may be reclaimed after a stale timeout. */
export const IN_FLIGHT_REVISION_STATUSES: ReadonlySet<RevisionTaskStatus> =
  new Set<RevisionTaskStatus>(["EXECUTING", "PLANNING", "VALIDATING"]);

/** Terminal statuses — never auto-executed again. */
export const TERMINAL_REVISION_STATUSES: ReadonlySet<RevisionTaskStatus> =
  new Set<RevisionTaskStatus>([
    "READY_FOR_FOUNDER_REVIEW",
    "FAILED",
    "FAILED_PROVIDER",
    "FAILED_COVERAGE",
    "FAILED_EXECUTION",
    "FAILED_CRITIC",
    "FAILED_GATE",
    "FAILED_ARTIFACTS",
  ]);

/** Default stale window for EXECUTING/PLANNING/VALIDATING recovery (45 minutes). */
export const DEFAULT_STALE_EXECUTING_MS = 45 * 60 * 1000;

export function taskLockPath(taskId: string): string {
  return join(tasksDir(), `${taskId}.lock`);
}

function writeJson(path: string, data: unknown): void {
  mkdirSync(join(path, ".."), { recursive: true });
  writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

export function taskPath(taskId: string): string {
  return join(tasksDir(), `${taskId}.json`);
}

export function findTaskByDecisionId(decisionId: string): RevisionTask | null {
  const dir = tasksDir();
  if (!existsSync(dir)) return null;
  for (const name of readdirSync(dir)) {
    if (!name.endsWith(".json") || name.startsWith("_")) continue;
    try {
      const t = readJson<RevisionTask>(join(dir, name));
      if (t.decision_id === decisionId) return t;
    } catch {
      /* skip */
    }
  }
  return null;
}

export type CreateRevisionTaskInput = {
  decision_id: string;
  review_id: string;
  prior_candidate_id: string;
  prior_canvas_path: string;
  founder_reason: string;
  requested_changes: string[];
  role: string;
  design_family?: string | null;
  revision_number?: number;
};

export function createRevisionTask(
  input: CreateRevisionTaskInput,
): { task: RevisionTask; created: boolean } {
  const existing = findTaskByDecisionId(input.decision_id);
  if (existing) {
    return { task: existing, created: false };
  }

  const dir = tasksDir();
  mkdirSync(dir, { recursive: true });
  const now = new Date().toISOString();
  const task: RevisionTask = {
    schema_version: "founder-revision-task-1.0.0",
    task_id: `revtask-${randomUUID().slice(0, 12)}`,
    decision_id: input.decision_id,
    review_id: input.review_id,
    prior_candidate_id: input.prior_candidate_id,
    prior_canvas_path: input.prior_canvas_path,
    founder_reason: input.founder_reason,
    requested_changes: [...input.requested_changes],
    role: input.role,
    design_family: input.design_family ?? null,
    status: "PENDING",
    created_at: now,
    updated_at: now,
    revised_candidate_id: null,
    revised_review_id: null,
    revision_number: input.revision_number ?? 1,
    error: null,
    openai_execution_path: null,
    publication_allowed: false,
    live: false,
  };
  writeJson(taskPath(task.task_id), task);
  writeJson(join(dir, "_index.json"), {
    version: FOUNDER_FEEDBACK_REVISION_VERSION,
    updated_at: now,
    note: "Founder feedback revision tasks — LIVE OFF",
  });
  return { task, created: true };
}

export function updateRevisionTask(
  taskId: string,
  patch: Partial<RevisionTask> & { status?: RevisionTaskStatus },
): RevisionTask {
  const path = taskPath(taskId);
  const current = readJson<RevisionTask>(path);
  const next: RevisionTask = {
    ...current,
    ...patch,
    task_id: current.task_id,
    decision_id: current.decision_id,
    publication_allowed: false,
    live: false,
    updated_at: new Date().toISOString(),
  };
  writeJson(path, next);
  return next;
}

export function loadRevisionTask(taskId: string): RevisionTask {
  return readJson<RevisionTask>(taskPath(taskId));
}

export function listRevisionTasks(): RevisionTask[] {
  const dir = tasksDir();
  if (!existsSync(dir)) return [];
  const out: RevisionTask[] = [];
  for (const name of readdirSync(dir)) {
    if (!name.endsWith(".json") || name.startsWith("_")) continue;
    try {
      out.push(readJson<RevisionTask>(join(dir, name)));
    } catch {
      /* skip malformed — dispatcher must not crash */
    }
  }
  return out.sort((a, b) => a.created_at.localeCompare(b.created_at));
}

export function releaseRevisionTaskLock(taskId: string): void {
  try {
    unlinkSync(taskLockPath(taskId));
  } catch {
    /* ignore */
  }
}

function tryAcquireLock(taskId: string, now: Date, staleMs: number): boolean {
  mkdirSync(tasksDir(), { recursive: true });
  const lockPath = taskLockPath(taskId);
  try {
    const fd = openSync(
      lockPath,
      fsConstants.O_CREAT | fsConstants.O_EXCL | fsConstants.O_WRONLY,
    );
    try {
      writeFileSync(fd, `${process.pid}\n${now.toISOString()}\n`, "utf8");
    } finally {
      closeSync(fd);
    }
    return true;
  } catch {
    try {
      const st = statSync(lockPath);
      if (now.getTime() - st.mtimeMs < staleMs) return false;
      unlinkSync(lockPath);
      const fd = openSync(
        lockPath,
        fsConstants.O_CREAT | fsConstants.O_EXCL | fsConstants.O_WRONLY,
      );
      try {
        writeFileSync(
          fd,
          `${process.pid}\n${now.toISOString()}\nstale_lock_reclaimed\n`,
          "utf8",
        );
      } finally {
        closeSync(fd);
      }
      return true;
    } catch {
      return false;
    }
  }
}

export type ClaimRevisionResult = {
  claimed: RevisionTask | null;
  reason:
    | "claimed_pending"
    | "reclaimed_stale"
    | "lock_held"
    | "in_flight"
    | "terminal"
    | "missing"
    | "malformed";
};

/**
 * Atomically claim a task for dispatcher execution.
 * - PENDING → EXECUTING
 * - Stale EXECUTING/PLANNING/VALIDATING (past staleExecutingMs) → EXECUTING (reclaim)
 * - Terminal / fresh in-flight → not claimed
 * Holds `${taskId}.lock` until releaseRevisionTaskLock().
 */
export function tryClaimRevisionTask(
  taskId: string,
  opts?: { staleExecutingMs?: number; now?: Date },
): ClaimRevisionResult {
  const now = opts?.now ?? new Date();
  const staleMs = opts?.staleExecutingMs ?? DEFAULT_STALE_EXECUTING_MS;
  const path = taskPath(taskId);
  if (!existsSync(path)) {
    return { claimed: null, reason: "missing" };
  }

  if (!tryAcquireLock(taskId, now, staleMs)) {
    return { claimed: null, reason: "lock_held" };
  }

  try {
    let task: RevisionTask;
    try {
      task = readJson<RevisionTask>(path);
    } catch {
      releaseRevisionTaskLock(taskId);
      return { claimed: null, reason: "malformed" };
    }

    if (task.status === "PENDING") {
      const claimed = updateRevisionTask(taskId, {
        status: "EXECUTING",
        error: null,
      });
      return { claimed, reason: "claimed_pending" };
    }

    if (IN_FLIGHT_REVISION_STATUSES.has(task.status)) {
      const updated = Date.parse(task.updated_at);
      const age = Number.isFinite(updated)
        ? now.getTime() - updated
        : Number.POSITIVE_INFINITY;
      if (age >= staleMs) {
        const claimed = updateRevisionTask(taskId, {
          status: "EXECUTING",
          error: `stale_${String(task.status).toLowerCase()}_reclaimed`,
        });
        return { claimed, reason: "reclaimed_stale" };
      }
      releaseRevisionTaskLock(taskId);
      return { claimed: null, reason: "in_flight" };
    }

    releaseRevisionTaskLock(taskId);
    return { claimed: null, reason: "terminal" };
  } catch (err) {
    releaseRevisionTaskLock(taskId);
    throw err;
  }
}
