/**
 * Live Runtime verify — never enables LIVE mode.
 */
import { existsSync } from "node:fs";
import { join } from "node:path";
import { LIVE_RUNTIME_ROOT } from "./LiveRuntimeReporter.js";
import { runLiveRuntimeVerify } from "./LiveRuntimeManager.js";

const REQUIRED = [
  "live-runtime.json",
  "runtime-mode.json",
  "runtime-session.json",
  "runtime-gate.json",
  "runtime-continuity.json",
  "runtime-caps.json",
  "live-runtime-report.md",
];

async function main(): Promise<void> {
  // Hard safety against LIVE
  delete process.env.SOS_AIOS_LIVE;
  process.env.SOS_SUPERVISOR_DRY_RUN = "true";
  process.env.SOS_RUNTIME_LOOP_DRY_RUN = "true";
  process.env.SOS_RUNTIME_LOOP_MAX_CYCLES = "1";
  process.env.SOS_RUNTIME_LOOP_SLEEP_MS = "0";
  process.env.SOS_AIOS_MAX_CYCLES = "1";

  const result = await runLiveRuntimeVerify();
  const reportsOk = REQUIRED.every((f) =>
    existsSync(join(LIVE_RUNTIME_ROOT, f)),
  );

  const checks = {
    runtime_modes: result.checks.runtime_modes,
    founder_gate: result.checks.founder_gate,
    runtime_continuity: result.checks.runtime_continuity,
    runtime_caps: result.checks.runtime_caps,
    safe_shutdown: result.checks.safe_shutdown,
    graceful_restart: result.checks.graceful_restart,
    reports: reportsOk,
    verify_remains_dry_run:
      result.checks.verify_remains_dry_run &&
      result.requested_mode === "VERIFY" &&
      result.effective_mode !== "LIVE",
  };

  const allPass = Object.values(checks).every(Boolean);
  console.log(
    [
      "Live Runtime Verify",
      "===================",
      ...Object.entries(checks).map(
        ([k, v]) => `${v ? "✔" : "✘"} ${k.replace(/_/g, " ")}`,
      ),
      "",
      `Status: ${result.status}`,
      `Requested: ${result.requested_mode}`,
      `Effective: ${result.effective_mode}`,
      `Gate: ${result.gate.approved ? "approved" : "denied"} — ${result.gate.reason}`,
      `Cycles: ${result.session.cycles_completed}`,
      `Overall: ${allPass ? "PASS" : "FAIL"}`,
    ].join("\n"),
  );
  process.exit(allPass ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
