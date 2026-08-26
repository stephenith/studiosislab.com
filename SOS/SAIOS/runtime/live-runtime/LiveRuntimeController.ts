/**
 * Live runtime controller — continuity orchestration around Supervisor.
 * Does not modify Supervisor / Loop / departments.
 */
import {
  runRuntimeSupervisor,
  verifySupervisorConfiguration,
} from "../runtime-supervisor/index.js";
import { gracefulRestart } from "./GracefulRestart.js";
import { gracefulStartup } from "./GracefulStartup.js";
import { safeShutdown } from "./SafeShutdown.js";
import type {
  ContinuityStep,
  RuntimeCaps,
  RuntimeMode,
} from "./types.js";

export type ContinuityResult = {
  steps: ContinuityStep[];
  cycles_completed: number;
  supervisor_ok: boolean;
  detail: string;
};

export async function runContinuity(input: {
  mode: RuntimeMode;
  caps: RuntimeCaps;
}): Promise<ContinuityResult> {
  const steps: ContinuityStep[] = [...gracefulStartup(input.mode)];
  let cycles_completed = 0;
  let supervisor_ok = false;

  // Notification bridge remains gated — never set SOS_AIOS_NOTIFY_LIVE here
  steps.push({
    step: 4,
    name: "notification_bridge_gated",
    ok: true,
    detail: "notification bridge remains gated (no live send from continuity)",
  });

  const maxCycles = input.caps.maximum_cycle_count ?? 1;
  const started = Date.now();

  for (let i = 0; i < maxCycles; i++) {
    if (
      input.caps.maximum_runtime_ms != null &&
      Date.now() - started >= input.caps.maximum_runtime_ms
    ) {
      steps.push({
        step: 10 + i,
        name: "max_runtime_reached",
        ok: true,
        detail: `stopped at max runtime ${input.caps.maximum_runtime_ms}ms`,
      });
      break;
    }

    // VERIFY / DRY_RUN: always use supervisor verify-safe config
    // LIVE: still capped; supervisor dry_run false only when mode is LIVE
    const supervisorConfig = {
      ...verifySupervisorConfiguration(),
      dry_run: input.mode !== "LIVE",
      max_cycles: 1,
      max_runtime_ms: Math.min(
        input.caps.maximum_runtime_ms ?? 60_000,
        60_000,
      ),
      max_restart_attempts: input.caps.maximum_restart_attempts,
      max_recovery_attempts: input.caps.maximum_recovery_attempts,
      heartbeat_timeout_ms: input.caps.heartbeat_timeout_ms,
      shutdown_timeout_ms: input.caps.shutdown_timeout_ms,
      startup_timeout_ms: input.caps.startup_timeout_ms,
    };

    try {
      const result = await runRuntimeSupervisor({ config: supervisorConfig });
      cycles_completed += 1;
      supervisor_ok = result.status !== "BLOCKED";
      steps.push({
        step: 20 + i,
        name: "supervisor_cycle",
        ok: supervisor_ok,
        detail: `supervisor ${result.status} · mode=${result.mode} · loop=${result.loop_supervised}`,
      });
      steps.push({
        step: 21 + i,
        name: "founder_dashboard_refresh",
        ok: true,
        detail: "FCC freshness observed via supervisor founder monitoring",
      });
    } catch (e) {
      steps.push({
        step: 20 + i,
        name: "supervisor_cycle",
        ok: false,
        detail: e instanceof Error ? e.message : String(e),
      });
      steps.push(gracefulRestart("supervisor cycle failure"));
      break;
    }
  }

  steps.push(
    safeShutdown({
      reason:
        cycles_completed >= maxCycles
          ? "maximum cycle count"
          : "continuity complete",
      caps: input.caps,
    }),
  );

  return {
    steps,
    cycles_completed,
    supervisor_ok,
    detail: `continuity complete · cycles=${cycles_completed} · mode=${input.mode}`,
  };
}
