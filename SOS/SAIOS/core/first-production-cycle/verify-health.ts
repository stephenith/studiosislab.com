/**
 * Canonical Production Health Gate verify — Agent #212.
 * No OpenAI. No production execution beyond BatchRunner abort paths.
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
import {
  evaluateProductionHealth,
} from "./ProductionHealthGate.js";
import { runCanonicalBatch } from "./BatchRunner.js";

const REPO = resolve(import.meta.dirname, "../../../..");
const OUT = join(CYCLE_LOG, "health-gate-verify.json");
const GUARD = join(REPO, "SOS/SAIOS/architecture/runtime-guard.ts");
const HEALTH_REPORT = join(CYCLE_LOG, "health-report.json");

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
  const healthyQueueMax = Math.max(waiting + 10, 50);

  // 1. Healthy configuration passes
  const healthy = evaluateProductionHealth({
    queue_max: healthyQueueMax,
    persist: true,
  });
  assert(healthy.status === "HEALTHY", `expected HEALTHY got ${healthy.status}: ${healthy.failed_checks.join(",")}`);
  assert(existsSync(HEALTH_REPORT), "health-report.json written");
  assert(healthy.publication_allowed === false, "publication_allowed");
  assert(healthy.live === false, "live off");
  assert(
    !healthy.checks.some((c) => /openai\.com|api\.openai/i.test(c.detail)),
    "no openai network hints",
  );

  // 2. Simulated registry failure
  const regFail = evaluateProductionHealth({
    queue_max: healthyQueueMax,
    persist: false,
    simulate: { registry_unreadable: true },
  });
  assert(regFail.status === "UNHEALTHY", "registry failure unhealthy");
  assert(
    regFail.failed_checks.includes("candidate_registry"),
    "candidate_registry failed",
  );

  // 3. Simulated queue limit
  const queueFail = evaluateProductionHealth({
    queue_max: healthyQueueMax,
    persist: false,
    simulate: { queue_over_limit: true },
  });
  assert(queueFail.status === "UNHEALTHY", "queue failure unhealthy");
  assert(
    queueFail.failed_checks.includes("founder_queue_capacity"),
    "queue check failed",
  );

  // 4. Simulated filesystem failure
  const fsFail = evaluateProductionHealth({
    queue_max: healthyQueueMax,
    persist: false,
    simulate: { filesystem_not_writable: true },
  });
  assert(fsFail.status === "UNHEALTHY", "fs failure unhealthy");
  assert(
    fsFail.failed_checks.includes("candidate_root_writable") ||
      fsFail.failed_checks.includes("batch_directory_writable"),
    "writable checks failed",
  );

  // 5. BatchRunner refuses unhealthy execution (no targets / no accepted)
  const refused = await runCanonicalBatch({
    verification: true,
    verification_context: "aios-verify",
    batch_size: 2,
    queue_max: healthyQueueMax,
    force_mock: true,
    select_target: true,
    health_preflight: true,
    health_simulate: { registry_unreadable: true },
  });
  assert(
    refused.stop_reason === "health_unhealthy",
    `stop=${refused.stop_reason}`,
  );
  assert(refused.accepted_count === 0, "no accepted when unhealthy");
  assert(refused.candidates_attempted === 0, "no candidates attempted");
  assert(refused.total_attempts === 0, "no attempts");
  assert(refused.candidates.length === 0, "no candidate records");
  assert(refused.publication_allowed === false, "batch publication");
  assert(refused.health?.status === "UNHEALTHY", "batch health attached");

  // 6. BatchRunner proceeds when healthy
  const stamp = Date.now();
  const okBatch = await runCanonicalBatch({
    verification: true,
    verification_context: "aios-verify",
    batch_size: 1,
    queue_max: healthyQueueMax,
    force_mock: true,
    select_target: false,
    health_preflight: true,
    forced_targets: [
      {
        category: "student",
        title: "Health Gate Batch Check",
        industry: "education",
        seniority: "student",
        objective: `health-gate-batch-ok-${stamp}`,
        role_family: "health_gate_batch_ok",
      },
    ],
  });
  assert(okBatch.stop_reason !== "health_unhealthy", "healthy batch not aborted");
  assert(okBatch.accepted_count === 1, `accepted=${okBatch.accepted_count}`);
  assert(okBatch.health?.status === "HEALTHY", "healthy status on batch");

  const guardSrc = readFileSync(GUARD, "utf8");
  assert(guardSrc.includes("ENGINES"), "Runtime Guard unchanged/present");
  assert(
    !/Promise\.all\s*\(/.test(
      readFileSync(join(import.meta.dirname, "BatchRunner.ts"), "utf8"),
    ),
    "BatchRunner sequential",
  );

  const checks = {
    healthy_passes: true,
    registry_failure_blocks: true,
    queue_limit_blocks: true,
    filesystem_failure_blocks: true,
    batch_refuses_unhealthy: true,
    batch_runs_when_healthy: true,
    health_report_written: true,
    publication_disabled: true,
    runtime_guard: true,
    no_openai_calls: true,
  };

  const overall = Object.values(checks).every(Boolean);
  writeFileSync(
    OUT,
    `${JSON.stringify(
      {
        generated_at: new Date().toISOString(),
        agent: "212",
        overall: overall ? "PASS" : "FAIL",
        checks,
        healthy_failed: healthy.failed_checks,
        refused_batch_id: refused.batch_id,
        ok_batch_id: okBatch.batch_id,
        health_report: HEALTH_REPORT,
      },
      null,
      2,
    )}\n`,
  );

  console.log("Canonical Production Health Gate Verify");
  console.log("======================================");
  for (const [k, v] of Object.entries(checks)) {
    console.log(`${v ? "✔" : "✘"} ${k}`);
  }
  console.log(`Healthy checks: ${healthy.checks.length} · failed=${healthy.failed_checks.length}`);
  console.log(`Overall: ${overall ? "PASS" : "FAIL"}`);
  if (!overall) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
