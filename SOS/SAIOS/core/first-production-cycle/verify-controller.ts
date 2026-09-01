/**
 * Canonical Production Controller verify — Agent #213.
 */
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";
import { CYCLE_LOG } from "./runFirstProductionCycle.js";
import { countFounderReviewWaiting } from "../founder-review/FounderReviewProjection.js";
import { runProduction } from "./ProductionController.js";

const REPO = resolve(import.meta.dirname, "../../../..");
const OUT = join(CYCLE_LOG, "controller-verify.json");
const GUARD = join(REPO, "SOS/SAIOS/architecture/runtime-guard.ts");
const RUN_BATCH = join(
  import.meta.dirname,
  "run-batch.ts",
);
const RUN_CONTROLLER = join(import.meta.dirname, "run-controller.ts");

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(msg);
}

function forceMock(): void {
  delete process.env.SOS_AI_FOUNDER_OPENAI_ONE_TEST;
  delete process.env.OPENAI_API_KEY;
  delete process.env.SOS_OPENAI_API_KEY;
  process.env.SOS_AIOS_LIVE = "0";
}

async function main(): Promise<void> {
  forceMock();
  mkdirSync(CYCLE_LOG, { recursive: true });

  const waiting = countFounderReviewWaiting(REPO);
  const queueMax = Math.max(waiting + 10, 50);
  const stamp = Date.now();

  // 1. Healthy execution
  const healthy = await runProduction({
    verification: true,
    verification_context: "aios-verify",
    batch_size: 1,
    queue_max: queueMax,
    force_mock: true,
    select_target: false,
    // Offline harness: avoid fail-closed budget DENY when local disk free %
    // is near the 10% floor (unrelated to controller orchestration).
    budget_simulate: { disk_free_percent: 40 },
    forced_targets: [
      {
        category: "creative",
        title: "Controller Verify Role",
        industry: "creative",
        seniority: "mid",
        objective: `controller-verify-healthy-${stamp}`,
        role_family: "controller_verify_healthy",
      },
    ],
  });
  assert(healthy.health.status === "HEALTHY", "healthy health");
  assert(healthy.entrypoint === "ProductionController", "entrypoint");
  assert(healthy.batch !== null, "batch ran");
  assert(healthy.candidate_count >= 1, `candidates=${healthy.candidate_count}`);
  assert(healthy.publication_allowed === false, "publication");
  assert(healthy.live === false, "live");
  assert(
    existsSync(join(REPO, healthy.report_path)),
    "execution report written",
  );
  assert(
    existsSync(join(CYCLE_LOG, "latest-execution.json")),
    "latest-execution pointer",
  );
  assert(
    existsSync(join(CYCLE_LOG, "execution-report.json")),
    "flat execution-report",
  );

  // 2. Unhealthy blocked — no batch
  const blocked = await runProduction({
    verification: true,
    verification_context: "aios-verify",
    batch_size: 2,
    queue_max: queueMax,
    force_mock: true,
    health_simulate: { registry_unreadable: true },
  });
  assert(blocked.stop_reason === "health_unhealthy", `stop=${blocked.stop_reason}`);
  assert(blocked.batch === null, "no batch when unhealthy");
  assert(blocked.candidate_count === 0, "no candidates");
  assert(blocked.health.status === "UNHEALTHY", "unhealthy status");
  assert(
    existsSync(join(REPO, blocked.report_path)),
    "unhealthy execution report written",
  );

  // 3. BatchRunner only through controller for production CLIs
  const batchCli = readFileSync(RUN_BATCH, "utf8");
  const controllerCli = readFileSync(RUN_CONTROLLER, "utf8");
  assert(
    /run-controller|runProduction|ProductionController/.test(batchCli),
    "aios:batch:run delegates to controller",
  );
  assert(
    !/runCanonicalBatch/.test(batchCli),
    "run-batch must not call BatchRunner directly",
  );
  assert(
    /runProduction/.test(controllerCli),
    "controller CLI uses runProduction",
  );
  assert(
    !/runCanonicalBatch/.test(controllerCli),
    "controller CLI must not call BatchRunner directly",
  );

  const guardSrc = readFileSync(GUARD, "utf8");
  assert(guardSrc.includes("ENGINES"), "Runtime Guard present");

  const checks = {
    healthy_execution: true,
    unhealthy_blocked: true,
    batch_only_through_controller: true,
    execution_report_written: true,
    publication_disabled: true,
    runtime_guard: true,
    live_off: process.env.SOS_AIOS_LIVE !== "1",
  };

  const overall = Object.values(checks).every(Boolean);
  writeFileSync(
    OUT,
    `${JSON.stringify(
      {
        generated_at: new Date().toISOString(),
        agent: "213",
        overall: overall ? "PASS" : "FAIL",
        checks,
        healthy_execution_id: healthy.execution_id,
        blocked_execution_id: blocked.execution_id,
        healthy_report: healthy.report_path,
      },
      null,
      2,
    )}\n`,
  );

  console.log("Canonical Production Controller Verify");
  console.log("=====================================");
  for (const [k, v] of Object.entries(checks)) {
    console.log(`${v ? "✔" : "✘"} ${k}`);
  }
  console.log(
    `Healthy: ${healthy.execution_id} · candidates=${healthy.candidate_count}`,
  );
  console.log(`Blocked: ${blocked.execution_id} · ${blocked.stop_reason}`);
  console.log(`Overall: ${overall ? "PASS" : "FAIL"}`);
  if (!overall) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
