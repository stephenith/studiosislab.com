/**
 * Phase 6E — Failed-revision Founder recovery.
 * No automatic retry. Historical task remains terminal. No production mutation.
 */
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { FounderReviewRepository } from "../founder-decisions/FounderReviewRepository.js";
import { summarizeFounderReviewProjection } from "../founder-review/FounderReviewProjection.js";
import {
  canRecoverFailedRevision,
  findLatestRevisionTaskForReview,
  isRevisionTaskTerminalFailure,
} from "./FailedRevisionRecovery.js";
import {
  createRevisionTask,
  setRevisionTasksDirForTests,
  updateRevisionTask,
} from "./RevisionTaskStore.js";
import type { FounderDecision } from "../founder-decisions/types.js";

const REPO = resolve(import.meta.dirname, "../../../..");
const OUT = join(
  REPO,
  "SOS/07_LOGS/saios/founder-revision/verify-failed-revision-recovery-6e.json",
);

type Check = { name: string; pass: boolean; detail: string };
function assert(cond: boolean, name: string, detail: string): Check {
  return { name, pass: !!cond, detail };
}

function writeSource(root: string, id: string, reviewId: string): void {
  const dir = join(root, "SOS/07_LOGS/saios/first-production-cycle/candidates", id);
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, "candidate.json"),
    JSON.stringify(
      {
        schema_version: 1,
        candidate_id: id,
        task_id: `task-${id}`,
        review_id: reviewId,
        cycle_id: `cycle-${id}`,
        created_at: "2026-09-02T19:34:55.000Z",
        status: "WAITING_FOUNDER",
        publication_allowed: false,
        target: { title: "Marketing Manager", category: "marketing" },
      },
      null,
      2,
    ),
  );
  writeFileSync(join(dir, "preview.png"), "png");
  writeFileSync(join(dir, "thumbnail.png"), "png");
}

function decision(partial: Partial<FounderDecision> & { decision: FounderDecision["decision"] }): FounderDecision {
  return {
    decision_id: "fd-6e-old",
    review_id: "founder-review-cand-6e-recovery-source",
    task_id: "task-cand-6e-recovery-source",
    cycle_id: "cycle-cand-6e-recovery-source",
    department: "resume",
    founder_actor: "founder",
    reason: "spacing",
    structured_feedback: { candidate_id: "cand-6e-recovery-source" },
    quality_scores: {},
    requested_changes: ["Reduce the excessive vertical gap before a named bullet."],
    reviewed_artifacts: [],
    provider: "mock",
    dry_run: true,
    created_at: "2026-09-02T19:50:34.000Z",
    source_interface: "aios_dashboard",
    publication_allowed: false,
    next_action: "none",
    supersedes: null,
    fixture: true,
    ...partial,
  };
}

function main(): void {
  const checks: Check[] = [];
  const root = mkdtempSync(join(tmpdir(), "aios-6e-rec-"));
  const tasksDir = join(root, "SOS/07_LOGS/saios/founder-revision/tasks");
  mkdirSync(tasksDir, { recursive: true });
  mkdirSync(join(root, "SOS/07_LOGS/saios/founder-decisions"), { recursive: true });
  setRevisionTasksDirForTests(tasksDir);
  try {
    const candId = "cand-6e-recovery-source";
    const reviewId = `founder-review-${candId}`;
    writeSource(root, candId, reviewId);

    const created = createRevisionTask({
      decision_id: "fd-6e-old",
      review_id: reviewId,
      prior_candidate_id: candId,
      prior_canvas_path: `SOS/07_LOGS/saios/first-production-cycle/candidates/${candId}/canvas.json`,
      founder_reason: "spacing",
      requested_changes: ["Reduce the excessive vertical gap before a named bullet."],
      role: "Marketing Manager",
      design_family: null,
    });
    const failed = updateRevisionTask(created.task.task_id, {
      status: "FAILED_GATE",
      error: "spacing intent unsatisfied",
    });

    writeFileSync(
      join(root, "SOS/07_LOGS/saios/founder-decisions/decisions.jsonl"),
      `${JSON.stringify({
        decision_id: "fd-6e-old",
        review_id: reviewId,
        task_id: `task-${candId}`,
        cycle_id: `cycle-${candId}`,
        decision: "CHANGES_REQUESTED",
        reason: "spacing",
        requested_changes: ["Reduce the excessive vertical gap before a named bullet."],
        created_at: "2026-09-02T19:50:34.000Z",
        fixture: false,
        supersedes: null,
        publication_allowed: false,
      })}\n`,
    );

    const summary = summarizeFounderReviewProjection(root);
    const item = summary.items.find((i) => i.review_id === reviewId);
    checks.push(
      assert(
        item?.status === "revision_failed" && summary.revision_failed >= 1,
        "FAILED_GATE_PROJECTS_REVISION_FAILED",
        `status=${item?.status} count=${summary.revision_failed} waiting=${summary.waiting}`,
      ),
    );
    checks.push(
      assert(
        item?.status !== "waiting_founder",
        "FAILED_ITEM_NOT_DUPLICATE_WAITING_SLOT",
        `status=${item?.status} waiting=${summary.waiting}`,
      ),
    );
    checks.push(
      assert(
        canRecoverFailedRevision(root, reviewId) === true,
        "FOUNDER_CAN_REQUEST_CHANGES_AGAIN",
        String(canRecoverFailedRevision(root, reviewId)),
      ),
    );
    checks.push(
      assert(
        isRevisionTaskTerminalFailure(failed) && failed.status === "FAILED_GATE",
        "HISTORICAL_TASK_REMAINS_TERMINAL",
        failed.status,
      ),
    );

    const repo = new FounderReviewRepository(root);
    repo.append(
      decision({
        decision_id: "fd-6e-old",
        review_id: reviewId,
        fixture: true,
        supersedes: null,
      }),
    );
    let dupBlocked = false;
    try {
      repo.append(
        decision({
          decision_id: "fd-6e-dup",
          review_id: reviewId,
          fixture: true,
          supersedes: null,
        }),
      );
    } catch {
      dupBlocked = true;
    }
    checks.push(
      assert(dupBlocked, "DUPLICATE_DECISION_GUARD_STILL_VALID", `dupBlocked=${dupBlocked}`),
    );

    repo.append(
      decision({
        decision_id: "fd-6e-new",
        review_id: reviewId,
        fixture: true,
        supersedes: "fd-6e-old",
        requested_changes: [
          "Reduce the excessive vertical gap before the “Conducted quarterly market analysis…” bullet.",
        ],
      }),
    );
    const newTask = createRevisionTask({
      decision_id: "fd-6e-new",
      review_id: reviewId,
      prior_candidate_id: candId,
      prior_canvas_path: `SOS/07_LOGS/saios/first-production-cycle/candidates/${candId}/canvas.json`,
      founder_reason: "Retry with clearer spacing request",
      requested_changes: [
        "Reduce the excessive vertical gap before the “Conducted quarterly market analysis…” bullet.",
      ],
      role: "Marketing Manager",
    });
    checks.push(
      assert(
        newTask.created && newTask.task.task_id !== failed.task_id,
        "NEW_FEEDBACK_CREATES_NEW_TASK_ID",
        `old=${failed.task_id} new=${newTask.task.task_id}`,
      ),
    );

    const oldAfter = JSON.parse(
      readFileSync(join(tasksDir, `${failed.task_id}.json`), "utf8"),
    ) as { status: string; error: string | null; task_id: string };
    checks.push(
      assert(
        oldAfter.status === "FAILED_GATE" &&
          oldAfter.error === "spacing intent unsatisfied" &&
          oldAfter.task_id === failed.task_id,
        "OLD_FAILED_TASK_UNCHANGED",
        oldAfter.status,
      ),
    );

    repo.append(
      decision({
        decision_id: "fd-6e-reject",
        review_id: reviewId,
        fixture: true,
        decision: "REJECTED",
        reason: "Founder rejects after failed revision",
        supersedes: "fd-6e-new",
      }),
    );
    checks.push(
      assert(
        repo.latestForReview(reviewId, true)?.decision === "REJECTED",
        "FOUNDER_CAN_REJECT_AFTER_FAILED_GATE",
        repo.latestForReview(reviewId, true)?.decision ?? "none",
      ),
    );

    const viewSrc = readFileSync(
      join(REPO, "SOS/SAIOS/dashboard/src/views/FounderReviewView.tsx"),
      "utf8",
    );
    const serverSrc = readFileSync(join(REPO, "SOS/SAIOS/dashboard/server.ts"), "utf8");
    const dispatcherSrc = readFileSync(
      join(REPO, "SOS/SAIOS/core/founder-revision/RevisionTaskDispatcher.ts"),
      "utf8",
    );
    checks.push(
      assert(
        viewSrc.includes("Revision failed. No revised Resume Template") &&
          viewSrc.includes("canRequestOrReject") &&
          serverSrc.includes("canRecoverFailedRevision") &&
          serverSrc.includes("Cannot approve after a failed revision") &&
          /decision === "APPROVED" && recoverableFailed/.test(serverSrc) &&
          !serverSrc.includes("recoverableFailed && !waiting"),
        "RECOVERY_UI_API_WIRED",
        "dashboard strings",
      ),
    );
    checks.push(
      assert(
        dispatcherSrc.includes('.filter((t) => t.status === "PENDING")') &&
          !dispatcherSrc.includes("FAILED_GATE"),
        "FAILED_GATE_AUTOMATIC_RETRY_NO",
        "dispatcher claims PENDING only",
      ),
    );
    const latest = findLatestRevisionTaskForReview(reviewId, root);
    checks.push(
      assert(
        latest?.task_id === newTask.task.task_id,
        "LATEST_TASK_IS_NEW",
        latest?.task_id ?? "none",
      ),
    );
  } finally {
    setRevisionTasksDirForTests(null);
    rmSync(root, { recursive: true, force: true });
  }

  const failed = checks.filter((c) => !c.pass);
  const report = {
    schema_version: "phase-6e-failed-revision-recovery-1.0.0",
    generated_at: new Date().toISOString(),
    pass: failed.length === 0,
    checks,
    publication_allowed: false,
    live: false,
  };
  mkdirSync(join(OUT, ".."), { recursive: true });
  writeFileSync(OUT, `${JSON.stringify(report, null, 2)}\n`);
  if (failed.length) {
    console.error(JSON.stringify(report, null, 2));
    process.exit(1);
  }
  console.log(`PHASE 6E RECOVERY PASS ${checks.length}/${checks.length}`);
}

main();
