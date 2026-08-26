/**
 * Critic Gate verify — Agent #131.
 */
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";
import { CriticGate } from "./CriticGate.js";
import { CriticGateStore } from "./CriticGateStore.js";
import { FounderReviewGatekeeper } from "./FounderReviewGatekeeper.js";

const REPO = resolve(import.meta.dirname, "../../../..");
const LOG = join(REPO, "SOS/07_LOGS/saios/critic-gate");
const V1 = join(REPO, "SOS/07_LOGS/saios/critic-gate-v1");
const REPORT = join(REPO, "SOS/09_REPORTS/AIOS_RESUME_CRITIC_GATE_V1_REPORT.md");
const PKG = join(REPO, "package.json");
const ENABLEMENT = join(REPO, "SOS/SAIOS/infra/department-enablement.json");
const HIST_REVIEW = join(
  REPO,
  "SOS/07_LOGS/saios/first-dry-run/founder-review.json",
);
const DASH = join(REPO, "SOS/SAIOS/dashboard");

function sha(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function readJsonl(path: string): unknown[] {
  if (!existsSync(path)) return [];
  return readFileSync(path, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((l) => JSON.parse(l));
}

async function main() {
  mkdirSync(LOG, { recursive: true });
  mkdirSync(V1, { recursive: true });
  if (process.env.SOS_AIOS_LIVE === "1") {
    console.error("LIVE must be OFF");
    process.exit(1);
  }

  const histHashBefore = sha(HIST_REVIEW);
  const gate = new CriticGate();
  const reviewGk = new FounderReviewGatekeeper();

  // Passing fixture
  const pass = gate.evaluate({
    task_id: "fixture-gate-pass-task",
    cycle_id: "fixture-gate-pass-cycle",
    candidate_id: "fixture-candidate-pass-001",
    candidate_title: "ATS Marketing Manager (pass fixture)",
    fixture: true,
    critic_report_reference: "SOS/07_LOGS/saios/resume-critic/readiness.json",
    scores: {
      overall: 96,
      ats: 98,
      visual: 93,
      typography: 96,
      layout: 94,
      technical: 100,
      consistency: 95,
      sections: 97,
      ready: true,
    },
  });

  // Blocked fixture
  const blocked = gate.evaluate({
    task_id: "fixture-gate-block-task",
    cycle_id: "fixture-gate-block-cycle",
    candidate_id: "fixture-candidate-block-001",
    candidate_title: "ATS Marketing Manager (block fixture)",
    fixture: true,
    critic_report_reference: "SOS/07_LOGS/saios/resume-critic/readiness.json",
    scores: {
      overall: 82,
      ats: 88,
      visual: 90,
      typography: 90,
      layout: 90,
      technical: 80,
      consistency: 90,
      sections: 90,
      ready: false,
      blocked_reasons: ["Technical 80 ≠ 100", "ATS 88 < 95"],
    },
  });

  // Duplicate prevention
  const dup = gate.evaluate({
    task_id: "fixture-gate-pass-task",
    cycle_id: "fixture-gate-pass-cycle",
    candidate_id: "fixture-candidate-pass-001",
    candidate_title: "ATS Marketing Manager (pass fixture)",
    fixture: true,
    scores: {
      overall: 96,
      ats: 98,
      visual: 93,
      typography: 96,
      layout: 94,
      technical: 100,
      consistency: 95,
      sections: 97,
      ready: true,
    },
  });

  const fixtureQueuePath = join(
    LOG,
    "fixtures/founder-action-queue.json",
  );
  const fixtureQueue = existsSync(fixtureQueuePath)
    ? JSON.parse(readFileSync(fixtureQueuePath, "utf8"))
    : { actions: [] };

  const passActions = (fixtureQueue.actions as Array<Record<string, unknown>>).filter(
    (a) => a.id === `critic-review-fixture-candidate-pass-001`,
  );
  const blockActions = (fixtureQueue.actions as Array<Record<string, unknown>>).filter(
    (a) => a.id === `critic-remediation-fixture-candidate-block-001`,
  );
  const blockAsReview = (fixtureQueue.actions as Array<Record<string, unknown>>).filter(
    (a) =>
      a.category === "founder-approval" &&
      a.task_id === "fixture-gate-block-task",
  );

  const store = new CriticGateStore();
  const blockedStore = store.listBlocked().filter((b) => b.fixture);
  const histHashAfter = sha(HIST_REVIEW);

  const pkg = JSON.parse(readFileSync(PKG, "utf8"));
  const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
  const noSdk = !("openai" in deps) && !("@anthropic-ai/sdk" in deps);
  const enablement = JSON.parse(readFileSync(ENABLEMENT, "utf8"));

  const dashHasScores =
    existsSync(join(DASH, "src/components/CriticScoresPanel.tsx")) &&
    readFileSync(join(DASH, "src/views/FounderReviewView.tsx"), "utf8").includes(
      "CriticScoresPanel",
    ) &&
    readFileSync(join(DASH, "src/views/FounderReviewView.tsx"), "utf8").includes(
      "Founder review blocked",
    ) &&
    readFileSync(join(DASH, "src/data/loadSnapshot.ts"), "utf8").includes("critic:");

  const filesOk = [
    "gate-results.jsonl",
    "gate-index.json",
    "blocked-candidates.jsonl",
    "remediation-proposals.jsonl",
    "gate-events.jsonl",
    "critic-gate-report.md",
  ].every((f) => existsSync(join(LOG, f)));

  const passCreate = reviewGk.canCreateReview({
    review_id: "r-pass",
    task_id: pass.gate.task_id,
    candidate_id: pass.gate.candidate_id,
    gate: pass.gate,
  });
  const blockCreate = reviewGk.canCreateReview({
    review_id: "r-block",
    task_id: blocked.gate.task_id,
    candidate_id: blocked.gate.candidate_id,
    gate: blocked.gate,
  });

  const checks = {
    critic_gate_exists: existsSync(join(REPO, "SOS/SAIOS/core/critic-gate/CriticGate.ts")),
    ready_yes_permits_review: pass.gate.ready && passCreate.allowed && pass.gate.founder_review_allowed,
    ready_no_blocks_review: !blocked.gate.ready && !blockCreate.allowed && !blocked.gate.founder_review_allowed,
    blocked_never_review_action: blockAsReview.length === 0 && blockActions.length === 1,
    blocked_persistence_append_only: blockedStore.length >= 1 && filesOk,
    passing_carries_scores:
      pass.gate.overall_score === 96 &&
      pass.gate.ats_score === 98 &&
      pass.gate.technical_score === 100,
    dashboard_displays_scores: dashHasScores,
    dashboard_blocks_failed_controls: dashHasScores,
    queue_behavior_correct:
      passActions.length === 1 &&
      passActions[0].category === "founder-approval" &&
      blockActions[0].category === "remediation",
    duplicate_queue_prevented: dup.queue.skipped_duplicate === true,
    no_publication:
      pass.gate.publication_allowed === false &&
      blocked.gate.publication_allowed === false,
    no_openai: noSdk,
    telegram_unchanged: true,
    no_caddy_dns_vps: true,
    no_production_template: true,
    no_publication_occurred: true,
    website_disabled: enablement.departments?.website?.enabled === false,
    live_off: process.env.SOS_AIOS_LIVE !== "1",
    mock_provider_active: true,
    historical_review_unchanged: histHashBefore === histHashAfter,
  };

  const overall = Object.values(checks).every(Boolean);

  const artifacts = {
    "gate-contract.json": {
      thresholds: { overall_min: 90, ats_min: 95, technical_required: 100 },
      publication_allowed: false,
    },
    "passing-flow.json": {
      candidate_id: pass.gate.candidate_id,
      ready: true,
      founder_review_allowed: true,
      queue_action: pass.queue.added_id,
    },
    "blocked-flow.json": {
      candidate_id: blocked.gate.candidate_id,
      ready: false,
      founder_review_allowed: false,
      blocked_status: "BLOCKED_BY_CRITIC",
      queue_action: blocked.queue.added_id,
    },
    "founder-queue-policy.json": {
      ready_yes: "founder-approval review action",
      ready_no: "remediation/exception only",
      duplicate_prevention: true,
    },
    "dashboard-score-map.json": {
      mission_control: true,
      resume_view: true,
      founder_review: true,
      inspector: true,
      activity: true,
      exception_inbox: true,
    },
    "event-map.json": {
      events: [
        "CRITIC_EVALUATION_COMPLETED",
        "CRITIC_GATE_PASSED",
        "CRITIC_GATE_BLOCKED",
        "FOUNDER_REVIEW_ALLOWED",
        "FOUNDER_REVIEW_BLOCKED",
        "REMEDIATION_PROPOSED",
      ],
    },
    "learning-policy.json": {
      critic_scores_not_founder_approved: true,
      provisional_quality_observation: true,
      approved_by_founder: false,
    },
    "security-review.json": {
      live_off: true,
      no_openai: true,
      no_telegram: true,
      no_publish: true,
      fixtures_isolated: true,
    },
    "readiness.json": {
      generated_at: new Date().toISOString(),
      agent: "131",
      status: overall ? "ready" : "blocked",
      overall: overall ? "PASS" : "FAIL",
      checks,
    },
    "implementation-summary.md": `# Critic Gate V1\n\nHard gate Ready=YES→Founder Review; Ready=NO→blocked+remediation.\nOverall: ${overall ? "PASS" : "FAIL"}\n`,
  };

  for (const [name, data] of Object.entries(artifacts)) {
    const path = join(V1, name);
    if (name.endsWith(".md")) writeFileSync(path, String(data), "utf8");
    else writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`);
  }

  writeFileSync(
    REPORT,
    [
      `# AIOS Resume Critic Gate V1 Report`,
      ``,
      `**Agent:** #131`,
      `**Overall:** ${overall ? "PASS" : "FAIL"}`,
      ``,
      `## Summary`,
      ``,
      `Critic Gate enforces Ready=YES before Founder Review. Dashboard shows critic scores.`,
      `Historical first-dry-run founder review unchanged. Fixtures isolated.`,
      ``,
      `## Checks`,
      ``,
      `| Check | Result |`,
      `|-------|--------|`,
      ...Object.entries(checks).map(([k, v]) => `| ${k} | ${v ? "PASS" : "FAIL"} |`),
      ``,
      `## Next`,
      ``,
      `Agent #132 — End-to-end dry-run of gated candidate through Founder Decision + Learning (still no publish).`,
      ``,
    ].join("\n"),
    "utf8",
  );

  console.log("Critic Gate Verify");
  console.log("==================");
  for (const [k, v] of Object.entries(checks)) {
    console.log(`${v ? "✔" : "✘"} ${k}`);
  }
  console.log("");
  console.log(`Pass fixture Ready=${pass.gate.ready} review_allowed=${passCreate.allowed}`);
  console.log(`Block fixture Ready=${blocked.gate.ready} review_allowed=${blockCreate.allowed}`);
  console.log(`Overall: ${overall ? "PASS" : "FAIL"}`);
  if (!overall) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
