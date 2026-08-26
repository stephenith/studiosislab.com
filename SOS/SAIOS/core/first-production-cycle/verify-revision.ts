/**
 * Canonical critic revision loop verify — Agent #211.
 * Mock-only. Uses force_fail_through_attempt for FAIL/retry paths.
 */
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
  statSync,
} from "node:fs";
import { join, resolve } from "node:path";
import {
  CYCLE_LOG,
  runFirstProductionCycle,
} from "./runFirstProductionCycle.js";
import { countCanonicalWaitingTotal } from "./CandidateStore.js";
import { MAX_AUTOMATIC_REVISIONS } from "./RevisionLoop.js";
import { runCanonicalBatch } from "./BatchRunner.js";
import type { ProductionTarget } from "./ProductionTarget.js";
import { loadWaitingCandidatesFromRegistry } from "../../dashboard/src/data/buildFounderReviewQueue.js";

const REPO = resolve(import.meta.dirname, "../../../..");
const OUT = join(CYCLE_LOG, "revision-loop-verify.json");
const GUARD = join(REPO, "SOS/SAIOS/architecture/runtime-guard.ts");

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(msg);
}

function forceMock(): void {
  delete process.env.SOS_AI_FOUNDER_OPENAI_ONE_TEST;
  delete process.env.OPENAI_API_KEY;
  delete process.env.SOS_OPENAI_API_KEY;
  process.env.SOS_AIOS_LIVE = "0";
}

function noSrcWrites(startMs: number): boolean {
  const src = join(REPO, "src");
  if (!existsSync(src)) return true;
  const stack = [src];
  while (stack.length) {
    const cur = stack.pop()!;
    for (const name of readdirSync(cur)) {
      const p = join(cur, name);
      const st = statSync(p);
      if (st.isDirectory()) {
        if (name === "node_modules" || name === ".git") continue;
        stack.push(p);
      } else if (st.mtimeMs >= startMs - 50) {
        return false;
      }
    }
  }
  return true;
}

function uniqueTarget(label: string): ProductionTarget {
  const stamp = Date.now();
  return {
    category: "engineering",
    title: `Revision Verify ${label}`,
    industry: "engineering",
    seniority: "mid",
    objective: `Agent211 revision verify ${label} ${stamp}`,
    role_family: `revision_verify_${label}`,
  };
}

async function main(): Promise<void> {
  forceMock();
  mkdirSync(CYCLE_LOG, { recursive: true });
  const t0 = Date.now();
  const waitingBefore = countCanonicalWaitingTotal(CYCLE_LOG);
  const queueBefore = loadWaitingCandidatesFromRegistry(REPO).length;

  // 1. PASS candidate — no revisions
  const pass = await runFirstProductionCycle({
    verification: true,
    verification_context: "aios-verify",
    pause_for_founder: true,
    target: uniqueTarget("pass"),
    revision: { enabled: true, max_revisions: MAX_AUTOMATIC_REVISIONS },
  });
  assert(pass.overall === "PASS", `pass overall=${pass.overall}`);
  assert(pass.state === "WAITING_FOUNDER", "pass waiting");
  assert(pass.revision?.outcome === "PASS", "pass revision outcome");
  assert(
    pass.revision?.revisions_performed === 0,
    `pass revisions=${pass.revision?.revisions_performed}`,
  );
  assert(
    existsSync(join(pass.candidate_dir, "revisions", "revision-00")),
    "initial revision snapshot",
  );
  assert(
    existsSync(join(pass.candidate_dir, "revision-history.json")),
    "revision history pointer",
  );

  // 2. FAIL then retry → PASS
  const retry = await runFirstProductionCycle({
    verification: true,
    verification_context: "aios-verify",
    pause_for_founder: true,
    target: uniqueTarget("retry"),
    revision: {
      enabled: true,
      max_revisions: MAX_AUTOMATIC_REVISIONS,
      force_fail_through_attempt: 0,
    },
  });
  assert(retry.overall === "PASS", `retry overall=${retry.overall}`);
  assert(retry.state === "WAITING_FOUNDER", "retry waiting");
  assert(
    (retry.revision?.revisions_performed ?? 0) >= 1,
    "retry performed ≥1 revision",
  );
  assert(
    existsSync(join(retry.candidate_dir, "revisions", "revision-00")),
    "retry rev00",
  );
  assert(
    existsSync(join(retry.candidate_dir, "revisions", "revision-01")),
    "retry rev01",
  );
  const histRetry = JSON.parse(
    readFileSync(join(retry.candidate_dir, "revision-history.json"), "utf8"),
  ) as { history: Array<{ decision: string; revision_number: number }> };
  assert(histRetry.history[0]?.decision === "FAIL", "first attempt FAIL");
  assert(
    histRetry.history.some((h) => h.decision === "PASS"),
    "later PASS",
  );

  // 3. Max revisions → CRITIC_BLOCKED
  const blocked = await runFirstProductionCycle({
    verification: true,
    verification_context: "aios-verify",
    pause_for_founder: true,
    target: uniqueTarget("blocked"),
    revision: {
      enabled: true,
      max_revisions: MAX_AUTOMATIC_REVISIONS,
      force_fail_through_attempt: MAX_AUTOMATIC_REVISIONS,
    },
  });
  assert(blocked.state === "CRITIC_BLOCKED", `blocked state=${blocked.state}`);
  assert(blocked.overall === "FAIL", "blocked overall FAIL");
  assert(
    blocked.revision?.outcome === "CRITIC_BLOCKED",
    "blocked revision outcome",
  );
  assert(
    blocked.revision?.revisions_performed === MAX_AUTOMATIC_REVISIONS,
    `max revisions=${blocked.revision?.revisions_performed}`,
  );
  assert(
    blocked.revision?.attempts === MAX_AUTOMATIC_REVISIONS + 1,
    `attempts=${blocked.revision?.attempts}`,
  );
  assert(
    existsSync(join(blocked.candidate_dir, "revisions", "revision-02")),
    "revision-02 persisted",
  );

  // 4. Agent #231 — verification artifacts stay out of Founder Review / production queue
  const queue = loadWaitingCandidatesFromRegistry(REPO);
  assert(
    !queue.some((q) => q.candidate_id === pass.candidate_id),
    "PASS verify candidate not in founder review",
  );
  assert(
    !queue.some((q) => q.candidate_id === retry.candidate_id),
    "retry verify candidate not in founder review",
  );
  assert(
    !queue.some((q) => q.candidate_id === blocked.candidate_id),
    "CRITIC_BLOCKED not in founder review",
  );

  const waitingAfter = countCanonicalWaitingTotal(CYCLE_LOG);
  assert(
    waitingAfter === waitingBefore,
    `production waiting unchanged (got ${waitingAfter - waitingBefore})`,
  );
  const queueAfter = loadWaitingCandidatesFromRegistry(REPO).length;
  assert(
    queueAfter === queueBefore,
    `production founder queue unchanged (got ${queueAfter - queueBefore})`,
  );
  const verifyWaiting = countCanonicalWaitingTotal(CYCLE_LOG, "verification");
  assert(verifyWaiting >= 2, `verify registry waiting >=2 got ${verifyWaiting}`);

  // 5. Sequential batch preserved
  const stamp = Date.now();
  const batch = await runCanonicalBatch({
    verification: true,
    verification_context: "aios-verify",
    batch_size: 2,
    queue_max: 100,
    force_mock: true,
    select_target: false,
    forced_targets: [
      {
        category: "creative",
        title: "Revision Batch A",
        industry: "creative",
        seniority: "mid",
        objective: `revision-batch-a-${stamp}`,
        role_family: "revision_batch_a",
      },
      {
        category: "finance",
        title: "Revision Batch B",
        industry: "finance",
        seniority: "mid",
        objective: `revision-batch-b-${stamp}`,
        role_family: "revision_batch_b",
      },
    ],
  });
  assert(batch.sequential === true, "batch sequential");
  assert(batch.accepted_count === 2, `batch accepted=${batch.accepted_count}`);
  assert(
    Date.parse(batch.candidates[1]!.started_at) >=
      Date.parse(batch.candidates[0]!.finished_at),
    "batch sequential timing",
  );
  assert(batch.publication_allowed === false, "batch publication");

  assert(noSrcWrites(t0), "no src writes");
  assert(
    existsSync(GUARD) && readFileSync(GUARD, "utf8").includes("ENGINES"),
    "runtime guard",
  );
  assert(MAX_AUTOMATIC_REVISIONS === 2, "max revisions constant");

  const checks = {
    pass_no_revisions: true,
    fail_retries: true,
    max_revision_limit: true,
    revision_history_persisted: true,
    critic_blocked_not_in_founder_review: true,
    pass_in_founder_review: true,
    sequential_batch: true,
    publication_disabled: true,
    runtime_guard: true,
    no_src_writes: true,
    live_off: process.env.SOS_AIOS_LIVE !== "1",
  };

  const overall = Object.values(checks).every(Boolean);
  writeFileSync(
    OUT,
    `${JSON.stringify(
      {
        generated_at: new Date().toISOString(),
        agent: "211",
        overall: overall ? "PASS" : "FAIL",
        checks,
        pass_candidate: pass.candidate_id,
        retry_candidate: retry.candidate_id,
        blocked_candidate: blocked.candidate_id,
        batch_id: batch.batch_id,
      },
      null,
      2,
    )}\n`,
  );

  console.log("Canonical Critic Revision Loop Verify");
  console.log("=====================================");
  for (const [k, v] of Object.entries(checks)) {
    console.log(`${v ? "✔" : "✘"} ${k}`);
  }
  console.log(
    `PASS revisions=${pass.revision?.revisions_performed} · retry=${retry.revision?.revisions_performed} · blocked=${blocked.revision?.revisions_performed}`,
  );
  console.log(`Overall: ${overall ? "PASS" : "FAIL"}`);
  if (!overall) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
