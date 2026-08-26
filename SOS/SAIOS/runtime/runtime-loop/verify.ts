/**
 * Runtime Loop verify — dry-run, single cycle, never infinite.
 */
import { existsSync } from "node:fs";
import { join } from "node:path";
import { RUNTIME_LOOP_ROOT } from "./LoopConfiguration.js";
import { runRuntimeLoopVerify } from "./RuntimeLoop.js";

const REQUIRED = [
  "runtime-loop.json",
  "runtime-cycle.json",
  "runtime-health.json",
  "runtime-heartbeat.json",
  "runtime-snapshot.json",
  "runtime-report.md",
];

async function main(): Promise<void> {
  // Hard safety against infinite loop
  process.env.SOS_RUNTIME_LOOP_DRY_RUN = "true";
  process.env.SOS_RUNTIME_LOOP_MAX_CYCLES = "1";
  process.env.SOS_RUNTIME_LOOP_SLEEP_MS = "0";

  const result = await runRuntimeLoopVerify();
  const reportsOk = REQUIRED.every((f) =>
    existsSync(join(RUNTIME_LOOP_ROOT, f)),
  );

  const checks = {
    runtime_loop: result.checks.runtime_loop && result.cycle_count === 1,
    heartbeat: result.checks.heartbeat,
    scheduler_bridge: result.checks.scheduler_bridge,
    department_discovery: result.checks.department_discovery,
    health_checks: result.checks.health_checks,
    recovery: result.checks.recovery,
    snapshots: reportsOk,
    reports: reportsOk,
  };

  const allPass = Object.values(checks).every(Boolean);
  console.log(
    [
      "Runtime Loop Verify",
      "===================",
      ...Object.entries(checks).map(
        ([k, v]) => `${v ? "✔" : "✘"} ${k.replace(/_/g, " ")}`,
      ),
      "",
      `Status: ${result.status}`,
      `Mode: ${result.mode}`,
      `Cycles: ${result.cycle_count} (capped)`,
      `Departments: ${result.departments.filter((d) => d.available).length}/${result.departments.length}`,
      `Recoveries: ${result.recoveries.length}`,
      `Events (last cycle): ${result.last_cycle?.events_published ?? 0}`,
      `Overall: ${allPass ? "PASS" : "FAIL"}`,
    ].join("\n"),
  );
  process.exit(allPass ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
