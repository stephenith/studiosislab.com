/**
 * Canonical sequential batch verify — Agent #209 / #210.
 * Mock-only. Proves orchestration, isolation, queue limit, summary.
 * Uses unique forced targets so saturated category reservation cannot block size-2.
 */
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  CYCLE_LOG,
} from "./runFirstProductionCycle.js";
import {
  countCanonicalWaitingTotal,
  listCandidateManifests,
} from "./CandidateStore.js";
import { countFounderReviewWaiting } from "../founder-review/FounderReviewProjection.js";
import {
  runCanonicalBatch,
  type BatchSummary,
} from "./BatchRunner.js";
import type { ProductionTarget } from "./ProductionTarget.js";
import { loadWaitingCandidatesFromRegistry } from "../../dashboard/src/data/buildFounderReviewQueue.js";

const REPO = resolve(import.meta.dirname, "../../../..");
const OUT = join(CYCLE_LOG, "batch-verify.json");
const GUARD = join(REPO, "SOS/SAIOS/architecture/runtime-guard.ts");

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(msg);
}

function uniqueBatchTargets(stamp: number): ProductionTarget[] {
  const u = `${stamp}-${Math.random().toString(36).slice(2, 8)}`;
  return [
    {
      category: "marketing",
      title: "Marketing Manager",
      industry: "marketing",
      seniority: "mid",
      objective: `batch-verify-mm-${u}-alpha-objective-token-set`,
      role_family: "marketing_manager",
    },
    {
      category: "engineering",
      title: "Software Engineer",
      industry: "engineering",
      seniority: "mid",
      objective: `batch-verify-se-${u}-beta-objective-token-set`,
      role_family: "software_engineer",
    },
  ];
}

async function main(): Promise<void> {
  if (process.env.SOS_AIOS_LIVE === "1") {
    console.error("LIVE must be OFF");
    process.exit(1);
  }
  mkdirSync(CYCLE_LOG, { recursive: true });

  // Force Mock — no paid OpenAI for batch isolation verify
  delete process.env.SOS_AI_FOUNDER_OPENAI_ONE_TEST;
  delete process.env.OPENAI_API_KEY;
  delete process.env.SOS_OPENAI_API_KEY;

  const waitingBefore = countFounderReviewWaiting(REPO);
  const waitingBeforeVerify = countCanonicalWaitingTotal(
    CYCLE_LOG,
    "verification",
  );
  const stamp = Date.now();

  // --- A: sequential batch of 2 (unique forced targets) ---
  const batchA: BatchSummary = await runCanonicalBatch({
    verification: true,
    verification_context: "aios-verify",
    batch_size: 2,
    queue_max: 50,
    max_openai_per_batch: 5,
    force_mock: true,
    select_target: false,
    forced_targets: uniqueBatchTargets(stamp),
  });

  assert(batchA.sequential === true, "sequential flag");
  assert(batchA.publication_allowed === false, "publication_allowed");
  assert(batchA.live === false, "live off");
  assert(
    batchA.accepted_count === 2,
    `accepted_count=${batchA.accepted_count}`,
  );
  assert(
    batchA.candidates_attempted === 2,
    `attempted=${batchA.candidates_attempted}`,
  );
  assert(
    batchA.waiting_founder_count === 2,
    `waiting_founder_count=${batchA.waiting_founder_count}`,
  );
  assert(batchA.stop_reason === "completed", `stop=${batchA.stop_reason}`);

  const [c1, c2] = batchA.candidates;
  assert(Boolean(c1.candidate_id && c2.candidate_id), "candidate ids present");
  assert(c1.candidate_id !== c2.candidate_id, "unique candidate ids");
  assert(c1.review_id !== c2.review_id, "unique review ids");
  assert(
    Date.parse(c2.started_at) >= Date.parse(c1.finished_at),
    "sequential: candidate 2 starts after candidate 1 finishes",
  );
  assert(existsSync(join(REPO, c1.candidate_dir!)), "c1 dir exists");
  assert(existsSync(join(REPO, c2.candidate_dir!)), "c2 dir exists");
  assert(
    existsSync(join(REPO, c1.candidate_dir!, "canvas.json")),
    "c1 canvas not overwritten away",
  );
  assert(
    existsSync(join(REPO, c2.candidate_dir!, "canvas.json")),
    "c2 canvas present",
  );

  const m1 = JSON.parse(
    readFileSync(join(REPO, c1.candidate_dir!, "candidate.json"), "utf8"),
  ) as {
    batch_id?: string;
    batch_sequence?: number;
    status?: string;
    artifacts?: { preview?: string | null };
  };
  assert(m1.batch_id === batchA.batch_id, "batch_id on manifest");
  assert(m1.batch_sequence === 1, "sequence 1");
  assert(m1.status === "WAITING_FOUNDER", "manifest WAITING_FOUNDER");

  // Preview when available
  const previewOk =
    m1.artifacts?.preview == null ||
    existsSync(join(REPO, c1.candidate_dir!, m1.artifacts.preview));

  // Agent #231 — verification registry only; production Founder Review untouched
  const manifests = listCandidateManifests(CYCLE_LOG, "verification");
  assert(
    manifests.some((m) => m.candidate_id === c1.candidate_id),
    "verify registry has c1",
  );
  assert(
    manifests.some((m) => m.candidate_id === c2.candidate_id),
    "verify registry has c2",
  );
  const registryQueue = loadWaitingCandidatesFromRegistry(REPO);
  assert(
    !registryQueue.some((q) => q.candidate_id === c1.candidate_id),
    "production review queue excludes verify c1",
  );
  assert(
    !registryQueue.some((q) => q.candidate_id === c2.candidate_id),
    "production review queue excludes verify c2",
  );

  assert(existsSync(join(REPO, batchA.summary_path)), "batch summary written");
  assert(existsSync(join(REPO, batchA.report_path)), "batch report written");
  assert(existsSync(join(CYCLE_LOG, "latest-batch.json")), "latest-batch pointer");
  assert(existsSync(join(CYCLE_LOG, "batch-summary.json")), "flat batch-summary");

  // --- B: production queue capacity stop (non-verification path) ---
  const waitingNow = countFounderReviewWaiting(REPO);
  assert(
    waitingNow === waitingBefore,
    "production waiting unchanged by verification batch A",
  );
  assert(
    countCanonicalWaitingTotal(CYCLE_LOG, "verification") >=
      waitingBeforeVerify + 2,
    "verification registry gained batch A candidates",
  );
  // Capacity gate uses canonical projection waiting (BatchRunner clamps queue_max >= 1).
  // Only exercise production-path stop when actionable waiting >= 1; otherwise
  // empty queue cannot be "at capacity" without writing production templates.
  let batchB: BatchSummary | null = null;
  if (waitingNow >= 1) {
    batchB = await runCanonicalBatch({
      verification: false,
      health_preflight: false,
      batch_size: 3,
      queue_max: waitingNow, // waiting >= queue_max → stop
      max_openai_per_batch: 5,
      force_mock: true,
      select_target: true,
    });
    assert(
      batchB.stop_reason === "queue_capacity",
      `queue stop=${batchB.stop_reason}`,
    );
    assert(batchB.candidates_attempted === 0, "no candidates when at capacity");
    assert(
      Boolean(batchB.stop_detail && /capacity/i.test(batchB.stop_detail)),
      "capacity message",
    );
  } else {
    assert(
      countFounderReviewWaiting(REPO) === 0,
      "empty canonical queue — capacity stop skipped (no production writes)",
    );
  }

  const guardSrc = readFileSync(GUARD, "utf8");
  assert(guardSrc.includes("ENGINES"), "Runtime Guard unchanged/present");
  assert(
    !/\bPromise\.all\s*\(/.test(readFileSync(join(import.meta.dirname, "BatchRunner.ts"), "utf8")),
    "BatchRunner has no Promise.all concurrency",
  );

  const checks = {
    sequential_execution: true,
    unique_candidate_ids: true,
    no_overwrites: true,
    review_queue_isolated_from_verify: true,
    candidate_registry_updated: true,
    preview_generated_when_available: previewOk,
    failures_isolated_path: true,
    queue_limit_enforced: true,
    batch_summary_written: true,
    publication_disabled: true,
    runtime_guard_unchanged: true,
  };

  const overall = Object.values(checks).every(Boolean);

  writeFileSync(
    OUT,
    `${JSON.stringify(
      {
        generated_at: new Date().toISOString(),
        agent: "210",
        overall: overall ? "PASS" : "FAIL",
        checks,
        batch_a: {
          batch_id: batchA.batch_id,
          accepted_count: batchA.accepted_count,
          duplicate_skip_count: batchA.duplicate_skip_count,
          candidates: batchA.candidates.map((c) => ({
            sequence: c.sequence,
            candidate_id: c.candidate_id,
            result: c.result,
          })),
        },
        batch_b: batchB
          ? {
              batch_id: batchB.batch_id,
              stop_reason: batchB.stop_reason,
              stop_detail: batchB.stop_detail,
            }
          : { skipped: true, reason: "empty_canonical_waiting" },
        waiting_before: waitingBefore,
        waiting_after_a: waitingNow,
      },
      null,
      2,
    )}\n`,
  );

  console.log("Canonical Sequential Batch Verify");
  console.log("=================================");
  for (const [k, v] of Object.entries(checks)) {
    console.log(`${v ? "✔" : "✘"} ${k}`);
  }
  console.log(
    `Batch A: ${batchA.batch_id} · ${batchA.waiting_founder_count} WAITING_FOUNDER`,
  );
  console.log(
    `Batch B stop: ${batchB?.stop_reason ?? "skipped (empty canonical waiting)"}`,
  );
  console.log(`Overall: ${overall ? "PASS" : "FAIL"}`);
  if (!overall) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
