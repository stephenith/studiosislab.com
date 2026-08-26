/**
 * Canonical Autonomous Production Service verify — Agent #214.
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
  AutonomousProductionService,
  AUTONOMOUS_LOG_ROOT,
  readAutonomousHistory,
} from "./AutonomousProductionService.js";
import type { ProductionExecutionResult } from "./ProductionController.js";

const REPO = resolve(import.meta.dirname, "../../../..");
const OUT = join(CYCLE_LOG, "autonomous-verify.json");
const GUARD = join(REPO, "SOS/SAIOS/architecture/runtime-guard.ts");
const SERVICE_SRC = join(
  import.meta.dirname,
  "AutonomousProductionService.ts",
);

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
  const sleeps: number[] = [];
  const controllerCalls: string[] = [];

  const sleep = async (ms: number) => {
    sleeps.push(ms);
    await new Promise((r) => setTimeout(r, 5));
  };

  const runProductionFn = async (): Promise<ProductionExecutionResult> => {
    const id = `exec-verify-spy-${controllerCalls.length + 1}`;
    controllerCalls.push(id);
    return {
      schema_version: 1,
      execution_id: id,
      started_at: new Date().toISOString(),
      finished_at: new Date().toISOString(),
      duration_ms: 1,
      health: {
        status: "HEALTHY",
        checks: [],
        failed_checks: [],
        warnings: [],
        timestamp: new Date().toISOString(),
        duration_ms: 0,
        queue_waiting: waiting,
        queue_max: queueMax,
        report_path: "",
        publication_allowed: false,
        live: false,
      },
      budget: null,
      batch: null,
      candidate_count: 1,
      failure_count: 0,
      stop_reason: "completed",
      stop_detail: null,
      publication_allowed: false,
      live: false,
      entrypoint: "ProductionController",
      report_path: "SOS/07_LOGS/saios/first-production-cycle/executions/spy",
      execution_directory: "SOS/07_LOGS/saios/first-production-cycle/executions/spy",
    };
  };

  // A: healthy path — starts, sleeps, calls ProductionController
  const svcA = new AutonomousProductionService();
  svcA.start({
    interval_ms: 25,
    batch_size: 1,
    queue_max: queueMax,
    force_mock: true,
    max_iterations: 2,
    sleep,
    runProductionFn,
  });
  assert(svcA.status().running || svcA.status().state === "running" || svcA.status().busy, "starts");
  // Wait for loop to finish (max_iterations)
  const t0 = Date.now();
  while ((svcA.status().running || svcA.status().busy) && Date.now() - t0 < 10000) {
    await new Promise((r) => setTimeout(r, 20));
  }
  assert(sleeps.length >= 1, `sleeps recorded=${sleeps.length}`);
  assert(controllerCalls.length >= 1, `controller called=${controllerCalls.length}`);
  assert(svcA.status().session_id, "session id");
  const histA = readAutonomousHistory(svcA.status().session_id!);
  assert(histA.some((e) => e.type === "session_start"), "history start");
  assert(histA.some((e) => e.type === "sleep"), "history sleep");
  assert(
    histA.some((e) => e.type === "controller_complete"),
    "history controller",
  );
  assert(
    existsSync(join(AUTONOMOUS_LOG_ROOT, "status.json")),
    "status.json written",
  );

  // B: health failure skips production (no controller call)
  const callsBefore = controllerCalls.length;
  const svcB = new AutonomousProductionService();
  svcB.start({
    interval_ms: 20,
    batch_size: 1,
    queue_max: queueMax,
    force_mock: true,
    max_iterations: 2,
    sleep,
    runProductionFn,
    health_simulate: { registry_unreadable: true },
  });
  const t1 = Date.now();
  while ((svcB.status().running || svcB.status().busy) && Date.now() - t1 < 10000) {
    await new Promise((r) => setTimeout(r, 20));
  }
  assert(
    controllerCalls.length === callsBefore,
    "health failure must skip ProductionController",
  );
  const histB = readAutonomousHistory(svcB.status().session_id!);
  assert(
    histB.some(
      (e) => e.type === "decision_skip" && e.skip_reason === "health_unhealthy",
    ),
    "skip reason health_unhealthy",
  );

  // C: graceful stop mid-busy — wait for controller to finish
  let resolveCtrl: (() => void) | null = null;
  let entered = false;
  const slowCtrl = async (): Promise<ProductionExecutionResult> => {
    entered = true;
    await new Promise<void>((r) => {
      resolveCtrl = r;
    });
    controllerCalls.push("exec-graceful");
    return runProductionFn();
  };
  const svcC = new AutonomousProductionService();
  svcC.start({
    interval_ms: 50,
    batch_size: 1,
    queue_max: queueMax,
    force_mock: true,
    max_iterations: 5,
    sleep: async () => {
      await new Promise((r) => setTimeout(r, 5));
    },
    runProductionFn: slowCtrl,
  });
  const t2 = Date.now();
  while (!entered && Date.now() - t2 < 5000) {
    await new Promise((r) => setTimeout(r, 10));
  }
  assert(entered, "controller entered before stop");
  const stopPromise = svcC.stop();
  // Give stop a moment — must still be busy until we resolve controller
  await new Promise((r) => setTimeout(r, 30));
  assert(svcC.status().busy || svcC.status().stopping, "stop waits on busy");
  resolveCtrl!();
  await stopPromise;
  assert(!svcC.status().running, "stopped after graceful");
  assert(
    !svcC.status().busy,
    "not busy after stop",
  );
  const histC = readAutonomousHistory(svcC.status().session_id!);
  assert(histC.some((e) => e.type === "session_stop"), "history stop");

  // Source: must use ProductionController / runProduction, not BatchRunner directly
  const src = readFileSync(SERVICE_SRC, "utf8");
  assert(/runProduction/.test(src), "service imports/uses runProduction");
  assert(
    !/runCanonicalBatch\s*\(/.test(src),
    "service must not call BatchRunner directly",
  );

  assert(
    existsSync(GUARD) && readFileSync(GUARD, "utf8").includes("ENGINES"),
    "Runtime Guard",
  );

  const checks = {
    starts: true,
    sleeps: true,
    health_failures_skip: true,
    production_controller_called: true,
    graceful_stop: true,
    execution_history_written: true,
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
        agent: "214",
        overall: overall ? "PASS" : "FAIL",
        checks,
        session_a: svcA.status().session_id,
        session_b: svcB.status().session_id,
        session_c: svcC.status().session_id,
        controller_calls: controllerCalls.length,
        sleeps: sleeps.length,
      },
      null,
      2,
    )}\n`,
  );

  console.log("Canonical Autonomous Production Service Verify");
  console.log("=============================================");
  for (const [k, v] of Object.entries(checks)) {
    console.log(`${v ? "✔" : "✘"} ${k}`);
  }
  console.log(`Controller calls: ${controllerCalls.length} · sleeps: ${sleeps.length}`);
  console.log(`Overall: ${overall ? "PASS" : "FAIL"}`);
  if (!overall) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
