/**
 * First production cycle verify — Agent #132/#133.
 * Real path must pause at WAITING_FOUNDER (no auto-decision).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  CYCLE_LOG,
  runFirstProductionCycle,
} from "./runFirstProductionCycle.js";

const REPO = resolve(import.meta.dirname, "../../../..");
const PKG = join(REPO, "package.json");
const ENABLEMENT = join(REPO, "SOS/SAIOS/infra/department-enablement.json");
const REPORT = join(
  REPO,
  "SOS/09_REPORTS/AIOS_FIRST_COMPLETE_DEPARTMENT_CYCLE_V1_REPORT.md",
);

const REQUIRED_STAGES = [
  "scheduler",
  "queue",
  "production_intake",
  "research",
  "resume_department",
  "knowledge",
  "skills",
  "brain",
  "mock_provider",
  "designbrief",
  "resume_renderer",
  "canvas_json",
  "editor_compatibility",
  "resume_critic",
  "critic_gate",
  "founder_review_queue",
  "waiting_founder",
  "cycle_paused",
];

async function main() {
  mkdirSync(CYCLE_LOG, { recursive: true });
  if (process.env.SOS_AIOS_LIVE === "1") {
    console.error("LIVE must be OFF");
    process.exit(1);
  }

  const cycle = await runFirstProductionCycle({
    verification: true,
    verification_context: "aios-verify",
    pause_for_founder: true,
    select_target: true,
  });

  const pkg = JSON.parse(readFileSync(PKG, "utf8"));
  const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
  void deps;
  const cycleSources = [
    readFileSync(join(import.meta.dirname, "run.ts"), "utf8"),
    readFileSync(join(import.meta.dirname, "runFirstProductionCycle.ts"), "utf8"),
  ].join("\n");
  // OpenAI SDK lives only in core/providers/openai — cycle must not import it directly.
  const noDirectSdk =
    !/\bfrom\s+["']openai["']/.test(cycleSources) &&
    !/\brequire\(\s*["']openai["']\s*\)/.test(cycleSources);
  const enablement = JSON.parse(readFileSync(ENABLEMENT, "utf8"));

  const stageNames = cycle.stages.map((s) => s.stage);
  const everyStage =
    REQUIRED_STAGES.every((s) => stageNames.includes(s)) &&
    cycle.stages.every((s) => s.status === "completed" && s.validation.pass);

  const dash = JSON.parse(
    readFileSync(join(CYCLE_LOG, "dashboard.json"), "utf8"),
  ) as Record<string, unknown>;
  const pipeline = JSON.parse(
    readFileSync(join(CYCLE_LOG, "pipeline.json"), "utf8"),
  ) as { auto_decision?: boolean };
  const brain = JSON.parse(
    readFileSync(join(CYCLE_LOG, "brain.json"), "utf8"),
  ) as { provider?: string; openai?: boolean };
  const providerLog = JSON.parse(
    readFileSync(join(CYCLE_LOG, "mock-provider.json"), "utf8"),
  ) as { provider?: string };

  const checks = {
    every_stage_executed: everyStage,
    no_stage_skipped: !cycle.stages.some((s) => s.status === "skipped"),
    pauses_at_waiting_founder:
      cycle.state === "WAITING_FOUNDER" && cycle.paused === true,
    no_auto_decision:
      cycle.founder_decision === null &&
      pipeline.auto_decision === false &&
      cycle.learning_count === 0,
    dashboard_shows_waiting:
      dash.founder_waiting === true && dash.completed_cycle === false,
    critic_gate_enforced: cycle.critic_ready === true,
    no_publication: cycle.publication_allowed === false,
    no_openai_sdk_in_cycle: noDirectSdk,
    provider_log_matches_brain:
      brain.provider === providerLog.provider &&
      brain.openai === (brain.provider === "openai"),
    live_off: process.env.SOS_AIOS_LIVE !== "1",
    website_disabled: enablement.departments?.website?.enabled === false,
  };

  const overall = Object.values(checks).every(Boolean) && cycle.overall === "PASS";

  writeFileSync(
    join(CYCLE_LOG, "readiness.json"),
    `${JSON.stringify(
      {
        generated_at: new Date().toISOString(),
        agent: "133",
        status: overall ? "ready" : "blocked",
        overall: overall ? "PASS" : "FAIL",
        mode: "pause_for_founder",
        checks,
        task_id: cycle.task_id,
        state: cycle.state,
      },
      null,
      2,
    )}\n`,
  );

  writeFileSync(
    REPORT,
    [
      `# AIOS First Complete Department Cycle V1 Report`,
      ``,
      `**Updated by Agent:** #133 (interactive pause)`,
      `**Overall:** ${overall ? "PASS" : "FAIL"}`,
      ``,
      `Real cycle now pauses at WAITING_FOUNDER. No auto-decision.`,
      `Resume via dashboard Founder Decision (founder-gate-runtime).`,
      ``,
      `| Check | Result |`,
      `|-------|--------|`,
      ...Object.entries(checks).map(
        ([k, v]) => `| ${k} | ${v ? "PASS" : "FAIL"} |`,
      ),
      ``,
    ].join("\n"),
    "utf8",
  );

  console.log("First Production Cycle Verify (pause mode)");
  console.log("==========================================");
  for (const [k, v] of Object.entries(checks)) {
    console.log(`${v ? "✔" : "✘"} ${k}`);
  }
  console.log(`State: ${cycle.state}`);
  console.log(`Overall: ${overall ? "PASS" : "FAIL"}`);
  if (!overall) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
