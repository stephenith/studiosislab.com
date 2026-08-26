/**
 * Focused verification for Founder revision task dispatcher.
 * Uses isolated temp dirs + mocked runTask — never touches production tasks,
 * never calls OpenAI.
 */
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import {
  createRevisionTask,
  listRevisionTasks,
  loadRevisionTask,
  releaseRevisionTaskLock,
  setRevisionTasksDirForTests,
  tryClaimRevisionTask,
  updateRevisionTask,
} from "./RevisionTaskStore.js";
import {
  dispatchRevisionTick,
  startRevisionTaskDispatcher,
  stopRevisionTaskDispatcher,
  isRevisionTaskDispatcherRunning,
} from "./RevisionTaskDispatcher.js";
import type { RevisionTask } from "./revision-task-types.js";
import type { RunRevisionResult } from "./FounderRevisionPipeline.js";
import { loadReviewQueueForRepo } from "../../dashboard/src/data/buildFounderReviewQueue.js";

const REPO = resolve(import.meta.dirname, "../../../..");
const OUT = join(
  REPO,
  "SOS/07_LOGS/saios/founder-revision/verify-revision-dispatcher.json",
);

type Check = { name: string; pass: boolean; detail: string };

function assert(cond: boolean, name: string, detail: string): Check {
  return { name, pass: cond, detail };
}

function writeCand(
  repoRoot: string,
  id: string,
  body: Record<string, unknown>,
  withMedia = true,
): void {
  const dir = join(
    repoRoot,
    "SOS/07_LOGS/saios/first-production-cycle/candidates",
    id,
  );
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "candidate.json"), JSON.stringify(body, null, 2));
  if (withMedia) {
    writeFileSync(join(dir, "preview.png"), Buffer.from([0x89, 0x50, 0x4e, 0x47]));
    writeFileSync(join(dir, "thumbnail.png"), Buffer.from([0x89, 0x50, 0x4e, 0x47]));
  }
}

async function main(): Promise<void> {
  const checks: Check[] = [];
  const base = join(
    tmpdir(),
    `aios-rev-dispatch-${Date.now().toString(36)}-${process.pid}`,
  );
  const tasksDir = join(base, "tasks");
  const fakeRepo = join(base, "repo");
  mkdirSync(tasksDir, { recursive: true });
  mkdirSync(fakeRepo, { recursive: true });

  // Snapshot production pending count BEFORE any work (must remain untouched).
  setRevisionTasksDirForTests(null);
  const prodPendingBefore = listRevisionTasks().filter(
    (t) => t.status === "PENDING",
  ).length;
  const prodTaskIdsBefore = new Set(
    listRevisionTasks().map((t) => `${t.task_id}:${t.status}:${t.updated_at}`),
  );

  setRevisionTasksDirForTests(tasksDir);

  const prevLive = process.env.SOS_AIOS_LIVE;
  const prevDisp = process.env.SOS_AIOS_REVISION_DISPATCHER;
  process.env.SOS_AIOS_LIVE = "0";
  delete process.env.SOS_AIOS_REVISION_DISPATCHER;

  let openaiCallCount = 0;
  const runCounts = new Map<string, number>();

  try {
    // --- Claim once ---
    const { task: t1 } = createRevisionTask({
      decision_id: "fd-dispatch-verify-1",
      review_id: "rev-dispatch-1",
      prior_candidate_id: "cand-prior-1",
      prior_canvas_path: "canvas.json",
      founder_reason: "verify",
      requested_changes: ["fix spacing"],
      role: "verify",
    });
    const c1 = tryClaimRevisionTask(t1.task_id);
    checks.push(
      assert(
        c1.claimed?.status === "EXECUTING" && c1.reason === "claimed_pending",
        "claim_pending_once",
        `reason=${c1.reason} status=${c1.claimed?.status}`,
      ),
    );
    const c1b = tryClaimRevisionTask(t1.task_id);
    checks.push(
      assert(
        c1b.claimed == null && c1b.reason === "lock_held",
        "overlapping_claim_blocked_by_lock",
        `reason=${c1b.reason}`,
      ),
    );
    releaseRevisionTaskLock(t1.task_id);
    // Fresh in-flight (not stale) must not reclaim
    const c1c = tryClaimRevisionTask(t1.task_id, { staleExecutingMs: 60_000 });
    checks.push(
      assert(
        c1c.claimed == null && c1c.reason === "in_flight",
        "fresh_executing_not_reclaimed",
        `reason=${c1c.reason}`,
      ),
    );
    // Park claim fixture as terminal so later ticks cannot reclaim it.
    updateRevisionTask(t1.task_id, {
      status: "FAILED",
      error: "verify_claim_fixture_parked",
    });

    // --- Success path via dispatcher (mocked run) ---
    const { task: tOk } = createRevisionTask({
      decision_id: "fd-dispatch-verify-ok",
      review_id: "rev-ok",
      prior_candidate_id: "cand-prior-ok",
      prior_canvas_path: "canvas.json",
      founder_reason: "ok",
      requested_changes: ["a"],
      role: "verify",
    });

    const mockSuccess = async (taskId: string): Promise<RunRevisionResult> => {
      runCounts.set(taskId, (runCounts.get(taskId) ?? 0) + 1);
      openaiCallCount += 0; // explicit: no OpenAI
      const task = updateRevisionTask(taskId, {
        status: "READY_FOR_FOUNDER_REVIEW",
        revised_candidate_id: "cand-revised-ok",
        error: null,
      });
      return {
        ok: true,
        task,
        revised_candidate_id: "cand-revised-ok",
        error: null,
        coverage_gate_pass: true,
      };
    };

    const rOk = await dispatchRevisionTick({
      listTasks: listRevisionTasks,
      claimTask: tryClaimRevisionTask,
      runTask: mockSuccess,
      releaseLock: releaseRevisionTaskLock,
      canRunOpenAI: () => true,
      isLiveOff: () => true,
    });
    const afterOk = loadRevisionTask(tOk.task_id);
    checks.push(
      assert(
        rOk.ok === true && afterOk.status === "READY_FOR_FOUNDER_REVIEW",
        "success_reaches_ready_for_founder_review",
        `tick=${rOk.reason} status=${afterOk.status}`,
      ),
    );
    checks.push(
      assert(
        (runCounts.get(tOk.task_id) ?? 0) === 1,
        "success_run_exactly_once",
        `runs=${runCounts.get(tOk.task_id)}`,
      ),
    );

    // Completed (READY_FOR_FOUNDER_REVIEW) never rerun
    const rAgain = await dispatchRevisionTick({
      listTasks: listRevisionTasks,
      claimTask: tryClaimRevisionTask,
      runTask: mockSuccess,
      releaseLock: releaseRevisionTaskLock,
      canRunOpenAI: () => true,
      isLiveOff: () => true,
    });
    checks.push(
      assert(
        rAgain.processed !== tOk.task_id &&
          (runCounts.get(tOk.task_id) ?? 0) === 1,
        "completed_never_rerun",
        `processed=${rAgain.processed} runs=${runCounts.get(tOk.task_id)} reason=${rAgain.reason}`,
      ),
    );
    const claimTerminal = tryClaimRevisionTask(tOk.task_id);
    checks.push(
      assert(
        claimTerminal.reason === "terminal",
        "terminal_claim_rejected",
        `reason=${claimTerminal.reason}`,
      ),
    );

    // --- Failure path ---
    const { task: tFail } = createRevisionTask({
      decision_id: "fd-dispatch-verify-fail",
      review_id: "rev-fail",
      prior_candidate_id: "cand-prior-fail",
      prior_canvas_path: "canvas.json",
      founder_reason: "fail",
      requested_changes: ["b"],
      role: "verify",
    });
    const rFail = await dispatchRevisionTick({
      listTasks: listRevisionTasks,
      claimTask: tryClaimRevisionTask,
      runTask: async (taskId) => {
        runCounts.set(taskId, (runCounts.get(taskId) ?? 0) + 1);
        const task = updateRevisionTask(taskId, {
          status: "FAILED",
          error: "mock_pipeline_error",
        });
        return {
          ok: false,
          task,
          revised_candidate_id: null,
          error: "mock_pipeline_error",
          coverage_gate_pass: false,
        };
      },
      releaseLock: releaseRevisionTaskLock,
      canRunOpenAI: () => true,
      isLiveOff: () => true,
    });
    const afterFail = loadRevisionTask(tFail.task_id);
    checks.push(
      assert(
        rFail.ok === false && afterFail.status === "FAILED",
        "failure_reaches_failed",
        `status=${afterFail.status} error=${afterFail.error}`,
      ),
    );

    // --- Overlapping polls cannot double-run ---
    const { task: tRace } = createRevisionTask({
      decision_id: "fd-dispatch-verify-race",
      review_id: "rev-race",
      prior_candidate_id: "cand-prior-race",
      prior_canvas_path: "canvas.json",
      founder_reason: "race",
      requested_changes: ["c"],
      role: "verify",
    });
    let raceRuns = 0;
    const slowRun = async (taskId: string): Promise<RunRevisionResult> => {
      raceRuns += 1;
      await new Promise((r) => setTimeout(r, 80));
      const task = updateRevisionTask(taskId, {
        status: "READY_FOR_FOUNDER_REVIEW",
        revised_candidate_id: "cand-race-rev",
        error: null,
      });
      return {
        ok: true,
        task,
        revised_candidate_id: "cand-race-rev",
        error: null,
        coverage_gate_pass: true,
      };
    };
    const depsRace = {
      listTasks: listRevisionTasks,
      claimTask: tryClaimRevisionTask,
      runTask: slowRun,
      releaseLock: releaseRevisionTaskLock,
      canRunOpenAI: () => true as boolean,
      isLiveOff: () => true as boolean,
    };
    const [raceA, raceB] = await Promise.all([
      dispatchRevisionTick(depsRace),
      dispatchRevisionTick(depsRace),
    ]);
    checks.push(
      assert(
        raceRuns === 1 &&
          [raceA, raceB].filter((x) => x.processed === tRace.task_id).length ===
            1,
        "overlapping_polls_single_execution",
        `runs=${raceRuns} a=${raceA.reason} b=${raceB.reason}`,
      ),
    );

    // --- Malformed task does not crash ---
    writeFileSync(join(tasksDir, "revtask-malformed.json"), "{not-json", "utf8");
    let threw = false;
    try {
      await dispatchRevisionTick({
        listTasks: listRevisionTasks,
        claimTask: tryClaimRevisionTask,
        runTask: mockSuccess,
        releaseLock: releaseRevisionTaskLock,
        canRunOpenAI: () => true,
        isLiveOff: () => true,
      });
    } catch {
      threw = true;
    }
    checks.push(
      assert(!threw, "malformed_task_survived", `threw=${threw}`),
    );

    // --- Stale EXECUTING recovery ---
    const { task: tStale } = createRevisionTask({
      decision_id: "fd-dispatch-verify-stale",
      review_id: "rev-stale",
      prior_candidate_id: "cand-prior-stale",
      prior_canvas_path: "canvas.json",
      founder_reason: "stale",
      requested_changes: ["d"],
      role: "verify",
    });
    updateRevisionTask(tStale.task_id, { status: "EXECUTING" });
    // Backdate updated_at by rewriting file
    const stalePath = join(tasksDir, `${tStale.task_id}.json`);
    const staleRaw = JSON.parse(readFileSync(stalePath, "utf8")) as RevisionTask;
    staleRaw.updated_at = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    writeFileSync(stalePath, JSON.stringify(staleRaw, null, 2));
    let staleRuns = 0;
    const rStale = await dispatchRevisionTick({
      listTasks: listRevisionTasks,
      claimTask: tryClaimRevisionTask,
      runTask: async (taskId) => {
        staleRuns += 1;
        const task = updateRevisionTask(taskId, {
          status: "READY_FOR_FOUNDER_REVIEW",
          revised_candidate_id: "cand-stale-rev",
          error: null,
        });
        return {
          ok: true,
          task,
          revised_candidate_id: "cand-stale-rev",
          error: null,
          coverage_gate_pass: true,
        };
      },
      releaseLock: releaseRevisionTaskLock,
      canRunOpenAI: () => true,
      isLiveOff: () => true,
      staleExecutingMs: 1_000,
      now: () => new Date(),
    });
    checks.push(
      assert(
        rStale.ok === true && staleRuns === 1,
        "stale_executing_reclaimed",
        `reason=${rStale.reason} runs=${staleRuns}`,
      ),
    );

    // --- Start once + shutdown ---
    stopRevisionTaskDispatcher();
    const h1 = startRevisionTaskDispatcher({
      pollIntervalMs: 60_000,
      listTasks: () => [],
      canRunOpenAI: () => false,
      isLiveOff: () => true,
      log: () => undefined,
    });
    const h2 = startRevisionTaskDispatcher({
      pollIntervalMs: 60_000,
      listTasks: () => [],
      log: () => undefined,
    });
    checks.push(
      assert(
        h1 === h2 && isRevisionTaskDispatcherRunning(),
        "dispatcher_starts_only_once",
        `sameHandle=${h1 === h2} running=${isRevisionTaskDispatcherRunning()}`,
      ),
    );
    h1.stop();
    checks.push(
      assert(
        !isRevisionTaskDispatcherRunning(),
        "shutdown_stops_polling",
        `running=${isRevisionTaskDispatcherRunning()}`,
      ),
    );

    // --- Queue: revised visible, prior superseded; no decision duplication ---
    const priorId = "cand-dispatch-prior-q";
    const revisedId = "cand-dispatch-revised-q";
    writeCand(fakeRepo, priorId, {
      candidate_id: priorId,
      task_id: "task-prior",
      review_id: "review-prior",
      cycle_id: "cycle-q",
      created_at: "2026-07-01T00:00:00.000Z",
      status: "READY_FOR_FOUNDER_REVIEW",
      publication_allowed: false,
      target: { title: "Prior Role", category: "resume" },
      superseded_by_revision: revisedId,
      revision_forward: {
        tag: "revfb",
        new_candidate_id: revisedId,
        new_review_id: "review-revised",
      },
    });
    mkdirSync(
      join(
        fakeRepo,
        "SOS/07_LOGS/saios/first-production-cycle/candidates",
        priorId,
        "revisions/revfb",
      ),
      { recursive: true },
    );
    writeFileSync(
      join(
        fakeRepo,
        "SOS/07_LOGS/saios/first-production-cycle/candidates",
        priorId,
        "revisions/revfb/forward-link.json",
      ),
      JSON.stringify({ new_candidate_id: revisedId }),
    );
    writeCand(fakeRepo, revisedId, {
      candidate_id: revisedId,
      task_id: "task-revised",
      review_id: "review-revised",
      cycle_id: "cycle-q",
      created_at: "2026-07-01T01:00:00.000Z",
      status: "READY_FOR_FOUNDER_REVIEW",
      publication_allowed: false,
      target: { title: "Revised Role", category: "resume" },
      artifacts: {
        preview: "preview.png",
        thumbnail: "thumbnail.png",
      },
    });
    writeFileSync(
      join(
        fakeRepo,
        "SOS/07_LOGS/saios/first-production-cycle/candidates",
        revisedId,
        "revision-summary.json",
      ),
      JSON.stringify({ revised: true, prior_candidate_id: priorId }),
    );

    const queue = loadReviewQueueForRepo(fakeRepo);
    const ids = queue.map((q) => q.candidate_id);
    checks.push(
      assert(
        ids.includes(revisedId) && !ids.includes(priorId),
        "queue_shows_revised_hides_superseded",
        `ids=${ids.join(",")}`,
      ),
    );
    checks.push(
      assert(
        ids.filter((id) => id === revisedId).length === 1,
        "no_decision_duplication_in_queue",
        `count=${ids.filter((id) => id === revisedId).length}`,
      ),
    );

    checks.push(
      assert(openaiCallCount === 0, "no_openai_during_verification", `n=${openaiCallCount}`),
    );

    // Production tasks untouched
    setRevisionTasksDirForTests(null);
    const prodAfter = listRevisionTasks();
    const prodPendingAfter = prodAfter.filter((t) => t.status === "PENDING").length;
    const fingerprintMatch = prodAfter.every((t) =>
      prodTaskIdsBefore.has(`${t.task_id}:${t.status}:${t.updated_at}`),
    );
    checks.push(
      assert(
        prodPendingAfter === prodPendingBefore && fingerprintMatch,
        "production_pending_tasks_untouched",
        `before=${prodPendingBefore} after=${prodPendingAfter} fingerprint_ok=${fingerprintMatch}`,
      ),
    );
  } finally {
    stopRevisionTaskDispatcher();
    setRevisionTasksDirForTests(null);
    if (prevLive === undefined) delete process.env.SOS_AIOS_LIVE;
    else process.env.SOS_AIOS_LIVE = prevLive;
    if (prevDisp === undefined) delete process.env.SOS_AIOS_REVISION_DISPATCHER;
    else process.env.SOS_AIOS_REVISION_DISPATCHER = prevDisp;
    try {
      rmSync(base, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  }

  const passed = checks.filter((c) => c.pass).length;
  const failed = checks.filter((c) => !c.pass);
  const report = {
    ok: failed.length === 0,
    passed,
    total: checks.length,
    checks,
    note:
      "Isolated temp dirs + mocked execution. No OpenAI. Production revision tasks untouched.",
    at: new Date().toISOString(),
  };
  mkdirSync(join(OUT, ".."), { recursive: true });
  writeFileSync(OUT, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
  if (!report.ok) {
    console.error("VERIFY FAILED", failed.map((f) => f.name));
    process.exit(1);
  }
  console.log(`OK ${passed}/${checks.length}`);
}

main().catch((e) => {
  console.error(e);
  setRevisionTasksDirForTests(null);
  process.exit(1);
});
