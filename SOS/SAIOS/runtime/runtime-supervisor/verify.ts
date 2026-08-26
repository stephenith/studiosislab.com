/**
 * Runtime Supervisor verify — dry-run, single pass, never infinite.
 */
import { existsSync } from "node:fs";
import { join } from "node:path";
import { SUPERVISOR_ROOT } from "./SupervisorConfiguration.js";
import { runRuntimeSupervisorVerify } from "./RuntimeSupervisor.js";

const REQUIRED = [
  "supervisor-health.json",
  "watchdog.json",
  "restart-history.json",
  "recovery-history.json",
  "runtime-status.json",
  "supervisor-report.md",
  "supervisor-config.json",
];

async function main(): Promise<void> {
  process.env.SOS_SUPERVISOR_DRY_RUN = "true";
  process.env.SOS_SUPERVISOR_MAX_CYCLES = "1";
  process.env.SOS_RUNTIME_LOOP_DRY_RUN = "true";
  process.env.SOS_RUNTIME_LOOP_MAX_CYCLES = "1";
  process.env.SOS_RUNTIME_LOOP_SLEEP_MS = "0";

  const result = await runRuntimeSupervisorVerify();
  const reportsOk = REQUIRED.every((f) =>
    existsSync(join(SUPERVISOR_ROOT, f)),
  );

  const checks = {
    supervisor: result.checks.supervisor && result.loop_supervised,
    watchdog: result.checks.watchdog,
    heartbeat_monitor: result.checks.heartbeat_monitor,
    restart_coordinator: result.checks.restart_coordinator,
    recovery_coordinator: result.checks.recovery_coordinator,
    founder_monitoring: result.checks.founder_monitoring,
    reports: reportsOk,
    dry_run_safety: result.checks.dry_run_safety && result.mode === "dry_run",
  };

  const allPass = Object.values(checks).every(Boolean);
  console.log(
    [
      "Runtime Supervisor Verify",
      "=========================",
      ...Object.entries(checks).map(
        ([k, v]) => `${v ? "✔" : "✘"} ${k.replace(/_/g, " ")}`,
      ),
      "",
      `Status: ${result.status}`,
      `Mode: ${result.mode}`,
      `Loop supervised: ${result.loop_supervised}`,
      `Failures: ${result.failures.length}`,
      `Restarts: ${result.restarts.length}`,
      `Recoveries: ${result.recoveries.length}`,
      `Founder actions: ${result.founder_actions.length}`,
      `Events: ${result.events_published.join(", ") || "none"}`,
      `Overall: ${allPass ? "PASS" : "FAIL"}`,
    ].join("\n"),
  );
  process.exit(allPass ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
