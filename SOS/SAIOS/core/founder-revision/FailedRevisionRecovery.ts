/**
 * Phase 6E — Failed-revision Founder recovery.
 *
 * A terminal FAILED_* revision stays fail-closed and immutable.
 * The source Resume Template must remain Founder-actionable so a NEW
 * decision / NEW task can be created. No automatic retry.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { RevisionTask, RevisionTaskStatus } from "./revision-task-types.js";
import { tasksDir } from "./RevisionTaskStore.js";

export const REVISION_TERMINAL_FAILURE_STATUSES: ReadonlySet<RevisionTaskStatus> =
  new Set<RevisionTaskStatus>([
    "FAILED",
    "FAILED_PROVIDER",
    "FAILED_COVERAGE",
    "FAILED_EXECUTION",
    "FAILED_CRITIC",
    "FAILED_GATE",
    "FAILED_ARTIFACTS",
  ]);

export function isRevisionTaskTerminalFailure(task: {
  status: string;
  revised_candidate_id?: string | null;
}): boolean {
  if (!REVISION_TERMINAL_FAILURE_STATUSES.has(task.status as RevisionTaskStatus)) {
    return false;
  }
  return !task.revised_candidate_id;
}

function listTasksInDir(dir: string): RevisionTask[] {
  if (!existsSync(dir)) return [];
  const out: RevisionTask[] = [];
  for (const name of readdirSync(dir)) {
    if (!name.endsWith(".json") || name.startsWith("_")) continue;
    try {
      out.push(JSON.parse(readFileSync(join(dir, name), "utf8")) as RevisionTask);
    } catch {
      /* skip */
    }
  }
  return out.sort((a, b) => a.created_at.localeCompare(b.created_at));
}

export function revisionTasksDirForRepo(repoRoot: string): string {
  return join(repoRoot, "SOS/07_LOGS/saios/founder-revision/tasks");
}

export function findLatestRevisionTaskForReview(
  reviewId: string,
  repoRoot?: string,
): RevisionTask | null {
  const dir = repoRoot ? revisionTasksDirForRepo(repoRoot) : tasksDir();
  const tasks = listTasksInDir(dir).filter((t) => t.review_id === reviewId);
  if (tasks.length === 0) return null;
  return tasks[tasks.length - 1] ?? null;
}

export function findLatestRevisionTaskForCandidate(
  candidateId: string,
  repoRoot?: string,
): RevisionTask | null {
  const dir = repoRoot ? revisionTasksDirForRepo(repoRoot) : tasksDir();
  const tasks = listTasksInDir(dir).filter(
    (t) => t.prior_candidate_id === candidateId,
  );
  if (tasks.length === 0) return null;
  return tasks[tasks.length - 1] ?? null;
}

export function isRecoverableFailedRevisionTask(task: RevisionTask | null): boolean {
  if (!task) return false;
  return isRevisionTaskTerminalFailure(task);
}

export function canRecoverFailedRevision(
  repoRoot: string,
  reviewId: string,
): boolean {
  const task = findLatestRevisionTaskForReview(reviewId, repoRoot);
  return isRecoverableFailedRevisionTask(task);
}

export function canApproveAfterFailedRevision(
  repoRoot: string,
  reviewId: string,
): boolean {
  return !canRecoverFailedRevision(repoRoot, reviewId);
}

export function projectionStatusForChangesRequested(
  repoRoot: string,
  reviewId: string,
): "revision_failed" | "changes_requested" {
  return canRecoverFailedRevision(repoRoot, reviewId)
    ? "revision_failed"
    : "changes_requested";
}
