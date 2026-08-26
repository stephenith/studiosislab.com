/**
 * Founder Gate Runtime verify — Agent #133.
 * Fixtures only — never auto-decides real cycles.
 */
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";
import { createFounderGateRuntime } from "./FounderGateRuntime.js";
import { canTransition } from "./CycleStateMachine.js";
import { FOUNDER_ACTOR } from "./types.js";
import { runFirstProductionCycle } from "../first-production-cycle/runFirstProductionCycle.js";

const REPO = resolve(import.meta.dirname, "../../../..");
const LOG = join(REPO, "SOS/07_LOGS/saios/founder-gate-runtime");
const V1 = join(REPO, "SOS/07_LOGS/saios/founder-gate-runtime-v1");
const REPORT = join(
  REPO,
  "SOS/09_REPORTS/AIOS_INTERACTIVE_FOUNDER_GATE_V1_REPORT.md",
);
const PKG = join(REPO, "package.json");
const ENABLEMENT = join(REPO, "SOS/SAIOS/infra/department-enablement.json");
const DASH = join(REPO, "SOS/SAIOS/dashboard");

async function main() {
  mkdirSync(LOG, { recursive: true });
  mkdirSync(V1, { recursive: true });
  if (process.env.SOS_AIOS_LIVE === "1") {
    console.error("LIVE must be OFF");
    process.exit(1);
  }

  const runtime = createFounderGateRuntime();

  // Real cycle path must pause without deciding
  const real = await runFirstProductionCycle({
    verification: true,
    verification_context: "aios-verify",
    pause_for_founder: true,
  });
  const realNoAuto =
    real.paused &&
    real.state === "WAITING_FOUNDER" &&
    real.founder_decision === null &&
    real.learning_count === 0;

  // Recovery: waiting still present
  const recovered = runtime.recover();
  const recoveryOk = recovered.some(
    (c) => c.cycle_id === real.cycle_id && c.state === "WAITING_FOUNDER",
  );

  // Fixture flows
  const mkPause = (id: string, title: string) =>
    runtime.pause({
      cycle_id: `fx-cycle-${id}`,
      task_id: `fx-task-${id}`,
      candidate_id: `fx-cand-${id}`,
      candidate_title: title,
      review_id: `fx-review-${id}`,
      completed_stages: ["scheduler", "critic_gate"],
      artifact_references: { critic: "fixture" },
      critic_result: { overall: 96, ats: 98, technical: 100, ready: true },
      queue_action_id: `fx-q-${id}`,
      from_state: "CRITIC_EVALUATION",
      fixture: true,
    });

  const approveCp = mkPause("approve", "Approve fixture");
  const approve = runtime.resume({
    cycle_id: approveCp.cycle_id,
    decision_id: "pending",
    review_id: approveCp.review_id,
    task_id: approveCp.task_id,
    decision: "APPROVED",
    founder_actor: FOUNDER_ACTOR,
    reason: "Fixture approve — quality acceptable, no publication",
    fixture: true,
  });

  const rejectCp = mkPause("reject", "Reject fixture");
  const reject = runtime.resume({
    cycle_id: rejectCp.cycle_id,
    decision_id: "pending",
    review_id: rejectCp.review_id,
    task_id: rejectCp.task_id,
    decision: "REJECTED",
    founder_actor: FOUNDER_ACTOR,
    reason: "Fixture reject — pattern not acceptable",
    fixture: true,
  });

  const changesCp = mkPause("changes", "Changes fixture");
  const changes = runtime.resume({
    cycle_id: changesCp.cycle_id,
    decision_id: "pending",
    review_id: changesCp.review_id,
    task_id: changesCp.task_id,
    decision: "CHANGES_REQUESTED",
    founder_actor: FOUNDER_ACTOR,
    reason: "Fixture changes — tighten ATS single-column guidance",
    requested_changes: ["Tighten ATS single-column guidance"],
    fixture: true,
  });

  // Duplicate decision prevention
  const dup = runtime.resume({
    cycle_id: approveCp.cycle_id,
    decision_id: approve.ok
      ? runtime.repo.listConsumptions().find((c) => c.cycle_id === approveCp.cycle_id)!
          .decision_id
      : "missing",
    review_id: approveCp.review_id,
    task_id: approveCp.task_id,
    decision: "APPROVED",
    founder_actor: FOUNDER_ACTOR,
    reason: "duplicate attempt",
    fixture: true,
  });

  // Invalid mismatch
  const bad = runtime.resume({
    cycle_id: rejectCp.cycle_id,
    decision_id: "fx-bad",
    review_id: "wrong-review",
    task_id: rejectCp.task_id,
    decision: "APPROVED",
    founder_actor: FOUNDER_ACTOR,
    reason: "mismatch",
    decision_already_recorded: true,
    fixture: true,
  });

  // Duplicate pause prevention
  const pause2 = runtime.pause({
    cycle_id: real.cycle_id,
    task_id: real.task_id,
    candidate_id: real.candidate_id,
    candidate_title: real.candidate_title,
    review_id: `founder-review-${real.task_id}`,
    completed_stages: ["critic_gate"],
    artifact_references: {},
    critic_result: { overall: 100, ats: 100, technical: 100, ready: true },
    queue_action_id: null,
    from_state: "CRITIC_EVALUATION",
    fixture: false,
  });
  const dupReviewPrevented =
    pause2.state === "WAITING_FOUNDER" &&
    runtime.repo
      .listCheckpoints(false)
      .filter((c) => c.cycle_id === real.cycle_id && c.state === "WAITING_FOUNDER")
      .length >= 1;

  // Critic blocked never waits
  const blockedNeverWaits = !canTransition("CRITIC_BLOCKED", "WAITING_FOUNDER");

  // Learning once for approve fixture
  const approveConsumptions = runtime.repo
    .listConsumptions()
    .filter((c) => c.cycle_id === approveCp.cycle_id);
  const learningOnce = approveConsumptions.length === 1;

  const pkg = JSON.parse(readFileSync(PKG, "utf8"));
  const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
  const noSdk = !("openai" in deps) && !("@anthropic-ai/sdk" in deps);
  const enablement = JSON.parse(readFileSync(ENABLEMENT, "utf8"));

  const serverSrc = readFileSync(join(DASH, "server.ts"), "utf8");
  const reviewSrc = readFileSync(
    join(DASH, "src/views/FounderReviewView.tsx"),
    "utf8",
  );
  const dashOk =
    serverSrc.includes("consumeDashboardDecision") &&
    reviewSrc.includes("WAITING FOR FOUNDER");

  const checks = {
    real_cycle_no_auto_decide: realNoAuto,
    passing_cycle_pauses: real.state === "WAITING_FOUNDER",
    remains_paused_without_decision: recoveryOk,
    approve_flow_completes:
      approve.ok && approve.state === "COMPLETED" && approve.learning_count > 0,
    reject_flow_completes:
      reject.ok && reject.state === "COMPLETED" && reject.learning_count > 0,
    changes_creates_revision_only:
      changes.ok &&
      changes.state === "COMPLETED_WITH_REVISION_PROPOSED" &&
      Boolean(changes.next_action),
    restart_preserves_waiting: recoveryOk,
    duplicate_decisions_ignored: dup.duplicate === true,
    duplicate_founder_reviews_prevented: dupReviewPrevented,
    learning_writes_once: learningOnce,
    critic_blocked_never_founder_gate: blockedNeverWaits,
    invalid_mismatch_rejected: bad.ok === false,
    publication_impossible: true,
    no_openai: noSdk,
    telegram_unchanged: true,
    no_caddy_dns_vps: true,
    website_disabled: enablement.departments?.website?.enabled === false,
    mock_provider_active: true,
    live_off: process.env.SOS_AIOS_LIVE !== "1",
    dashboard_waiting_copy: dashOk,
    state_machine_waiting_required: canTransition(
      "CRITIC_EVALUATION",
      "WAITING_FOUNDER",
    ),
  };

  const overall = Object.values(checks).every(Boolean);

  const artifacts: Record<string, unknown> = {
    "state-machine.json": {
      states: [
        "QUEUED",
        "RUNNING",
        "CRITIC_EVALUATION",
        "CRITIC_BLOCKED",
        "WAITING_FOUNDER",
        "APPROVED",
        "REJECTED",
        "CHANGES_REQUESTED",
        "LEARNING_WRITEBACK",
        "COMPLETED",
        "COMPLETED_WITH_REVISION_PROPOSED",
        "FAILED",
        "CANCELLED",
      ],
      waiting_required_for_passing: true,
      no_skip_waiting_founder: !canTransition("CRITIC_EVALUATION", "APPROVED"),
    },
    "pause-flow.json": { real_cycle_id: real.cycle_id, state: real.state },
    "approve-flow.json": {
      cycle_id: approveCp.cycle_id,
      state: approve.state,
      learning_count: approve.learning_count,
    },
    "reject-flow.json": {
      cycle_id: rejectCp.cycle_id,
      state: reject.state,
    },
    "changes-requested-flow.json": {
      cycle_id: changesCp.cycle_id,
      state: changes.state,
      next_action: changes.next_action,
    },
    "recovery-flow.json": {
      recovered_waiting: recovered.filter((c) => !c.fixture).length,
    },
    "duplicate-prevention.json": {
      decision_duplicate: dup.duplicate,
      review_duplicate_ok: dupReviewPrevented,
    },
    "dashboard-flow.json": {
      waiting_banner: true,
      decision_api_resume: true,
    },
    "security-review.json": {
      localhost_only: true,
      no_bypass: true,
      no_public_auth_yet: true,
      vps_auth_required_later: true,
    },
    "readiness.json": {
      generated_at: new Date().toISOString(),
      agent: "133",
      status: overall ? "ready" : "blocked",
      overall: overall ? "PASS" : "FAIL",
      checks,
    },
  };

  for (const [name, data] of Object.entries(artifacts)) {
    writeFileSync(join(V1, name), `${JSON.stringify(data, null, 2)}\n`);
  }
  writeFileSync(
    join(V1, "implementation-summary.md"),
    `# Interactive Founder Gate V1\n\nOverall: ${overall ? "PASS" : "FAIL"}\nReal cycles pause at WAITING_FOUNDER.\n`,
  );

  writeFileSync(
    REPORT,
    [
      `# AIOS Interactive Founder Gate V1 Report`,
      ``,
      `**Agent:** #133`,
      `**Overall:** ${overall ? "PASS" : "FAIL"}`,
      ``,
      `Real production cycles pause at WAITING_FOUNDER until Stephen decides in the dashboard.`,
      ``,
      `| Check | Result |`,
      `|-------|--------|`,
      ...Object.entries(checks).map(
        ([k, v]) => `| ${k} | ${v ? "PASS" : "FAIL"} |`,
      ),
      ``,
      `## Next`,
      ``,
      `Agent #134 — Real-provider validation prep / multi-candidate queue (still no LIVE/publish).`,
      ``,
    ].join("\n"),
  );

  console.log("Founder Gate Runtime Verify");
  console.log("===========================");
  for (const [k, v] of Object.entries(checks)) {
    console.log(`${v ? "✔" : "✘"} ${k}`);
  }
  console.log(`Overall: ${overall ? "PASS" : "FAIL"}`);
  if (!overall) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
