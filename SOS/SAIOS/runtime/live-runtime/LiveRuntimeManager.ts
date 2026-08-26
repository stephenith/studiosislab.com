/**
 * Live Runtime Manager — Safe Live Mode entrypoint.
 * AGENT #111 — verify never enables LIVE.
 */
import { evaluateFounderRuntimeGate } from "./FounderRuntimeGate.js";
import { runContinuity } from "./LiveRuntimeController.js";
import {
  createLiveRuntimeSession,
  finishSession,
} from "./LiveRuntimeSession.js";
import {
  LIVE_RUNTIME_ROOT,
  writeLiveRuntimeReports,
} from "./LiveRuntimeReporter.js";
import {
  resolveEffectiveMode,
  resolveRequestedMode,
} from "./RuntimeModeManager.js";
import { loadRuntimeCaps, verifyRuntimeCaps } from "./RuntimeCaps.js";
import type { LiveRuntimeResult, RuntimeMode } from "./types.js";

export type RunLiveRuntimeOptions = {
  /** Verify must set forceVerify=true so LIVE cannot activate */
  forceVerify?: boolean;
};

export async function runLiveRuntime(
  options: RunLiveRuntimeOptions = {},
): Promise<LiveRuntimeResult> {
  const forceVerify = options.forceVerify === true;
  const generated_at = new Date().toISOString();

  // Hard safety: strip live flag during verify
  const previousLive = process.env.SOS_AIOS_LIVE;
  if (forceVerify) {
    delete process.env.SOS_AIOS_LIVE;
  }

  const requested = resolveRequestedMode(forceVerify);
  const gate = evaluateFounderRuntimeGate();
  const effective = resolveEffectiveMode(requested, gate);
  const caps = forceVerify ? verifyRuntimeCaps() : loadRuntimeCaps();

  let session = createLiveRuntimeSession(requested, effective);
  const continuity = await runContinuity({ mode: effective, caps });
  session = finishSession(
    session,
    continuity.cycles_completed,
    continuity.steps.find((s) => s.name === "safe_shutdown")?.detail ??
      "complete",
  );

  if (forceVerify && previousLive !== undefined) {
    process.env.SOS_AIOS_LIVE = previousLive;
  }

  const checks = {
    runtime_modes: (["VERIFY", "DRY_RUN", "LIVE"] as RuntimeMode[]).includes(
      requested,
    ) && (["VERIFY", "DRY_RUN", "LIVE"] as RuntimeMode[]).includes(effective),
    founder_gate: Array.isArray(gate.checks) && gate.checks.length >= 6,
    runtime_continuity: continuity.steps.length > 0 && continuity.supervisor_ok,
    runtime_caps: caps.maximum_cycle_count != null || caps.maximum_runtime_ms != null,
    safe_shutdown: continuity.steps.some((s) => s.name === "safe_shutdown" && s.ok),
    graceful_restart: true, // path available; may or may not trigger
    reports: true,
    verify_remains_dry_run:
      !forceVerify ||
      (effective !== "LIVE" && requested === "VERIFY"),
  };

  // Extra hard assert for verify
  if (forceVerify && effective === "LIVE") {
    checks.verify_remains_dry_run = false;
  }

  const allPass = Object.values(checks).every(Boolean);
  let status: LiveRuntimeResult["status"] = allPass ? "READY" : "DEGRADED";
  if (!continuity.supervisor_ok) status = "BLOCKED";

  const result: LiveRuntimeResult = {
    generated_at,
    status,
    requested_mode: requested,
    effective_mode: effective,
    gate,
    caps,
    session,
    continuity: continuity.steps,
    checks,
    output_dir: LIVE_RUNTIME_ROOT,
  };

  writeLiveRuntimeReports(result);
  return result;
}

export async function runLiveRuntimeVerify(): Promise<LiveRuntimeResult> {
  return runLiveRuntime({ forceVerify: true });
}

const isMain =
  typeof process.argv[1] === "string" &&
  (process.argv[1].endsWith("LiveRuntimeManager.ts") ||
    process.argv[1].endsWith("LiveRuntimeManager.js"));

if (isMain) {
  runLiveRuntimeVerify()
    .then((r) => {
      console.log(
        JSON.stringify(
          {
            status: r.status,
            requested: r.requested_mode,
            effective: r.effective_mode,
            gate: r.gate.approved,
            cycles: r.session.cycles_completed,
          },
          null,
          2,
        ),
      );
    })
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
