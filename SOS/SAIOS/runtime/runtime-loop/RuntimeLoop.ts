/**
 * Runtime Loop — continuous AI OS orchestration.
 * AGENT #109 — verify uses dry-run + max_cycles=1 (never infinite).
 */
import { EventBus } from "../event-bus/EventBus.js";
import { DepartmentRecoveryLoop } from "./DepartmentRecoveryLoop.js";
import { DepartmentRunner } from "./DepartmentRunner.js";
import {
  persistLoopConfiguration,
  RUNTIME_LOOP_ROOT,
  verifyLoopConfiguration,
  defaultLoopConfiguration,
} from "./LoopConfiguration.js";
import { writeRuntimeLoopReports } from "./LoopReporter.js";
import { RuntimeClock } from "./RuntimeClock.js";
import { runRuntimeCycle } from "./RuntimeCycle.js";
import { runtimeSleep } from "./RuntimeSleep.js";
import type { LoopConfiguration, RuntimeLoopResult } from "./types.js";

export type RunRuntimeLoopOptions = {
  /** Verify must pass config from verifyLoopConfiguration() */
  config?: LoopConfiguration;
};

export async function runRuntimeLoop(
  options: RunRuntimeLoopOptions = {},
): Promise<RuntimeLoopResult> {
  const config = persistLoopConfiguration(
    options.config ?? defaultLoopConfiguration(),
  );
  const clock = new RuntimeClock();
  const runner = new DepartmentRunner();
  const bus = new EventBus();
  const recovery = new DepartmentRecoveryLoop(config, bus);

  let cycle = 0;
  let lastCycle = null as Awaited<ReturnType<typeof runRuntimeCycle>> | null;
  let previousHeartbeatAt: string | null = null;
  const started = Date.now();

  // BOOT markers
  await bus.publish("SYSTEM_START", "runtime-loop", {
    dry_run: config.dry_run,
    max_cycles: config.max_cycles,
  });

  while (true) {
    cycle += 1;
    lastCycle = await runRuntimeCycle({
      cycle,
      config,
      clock,
      runner,
      bus,
      recovery,
      previousHeartbeatAt,
    });
    previousHeartbeatAt = lastCycle.heartbeat_at;

    // Write snapshots every cycle
    const partial: RuntimeLoopResult = {
      generated_at: clock.nowIso(),
      status: "READY",
      mode: config.dry_run ? "dry_run" : "live",
      uptime_ms: clock.uptimeMs(),
      cycle_count: cycle,
      departments: runner.list(),
      last_cycle: lastCycle,
      recoveries: recovery.getAttempts(),
      checks: {},
      output_dir: RUNTIME_LOOP_ROOT,
    };
    writeRuntimeLoopReports({
      result: partial,
      config,
      lastCycle,
      recoveries: recovery.getAttempts(),
      heartbeatAt: previousHeartbeatAt,
    });

    const hitMaxCycles =
      config.max_cycles != null && cycle >= config.max_cycles;
    const hitMaxRuntime =
      config.max_runtime_ms != null &&
      Date.now() - started >= config.max_runtime_ms;
    if (hitMaxCycles || hitMaxRuntime) break;

    await runtimeSleep(config);
  }

  await bus.publish("SYSTEM_STOP", "runtime-loop", {
    cycles: cycle,
    dry_run: config.dry_run,
  });

  const departments = runner.list();
  const checks = {
    runtime_loop: cycle >= 1 && lastCycle != null,
    heartbeat: Boolean(lastCycle?.heartbeat_at),
    scheduler_bridge: Boolean(lastCycle?.scheduler_tick_at),
    department_discovery: departments.length > 0,
    health_checks: (lastCycle?.health.length ?? 0) > 0,
    recovery: true, // recovery loop executed (may be zero attempts)
    snapshots: true,
    reports: true,
  };

  const failed = (lastCycle?.health ?? []).filter((h) => h.health === "failed");
  let status: RuntimeLoopResult["status"] = "READY";
  if (failed.length > 0) status = "DEGRADED";
  if (!checks.runtime_loop || !checks.department_discovery) status = "BLOCKED";

  const result: RuntimeLoopResult = {
    generated_at: clock.nowIso(),
    status,
    mode: config.dry_run ? "dry_run" : "live",
    uptime_ms: clock.uptimeMs(),
    cycle_count: cycle,
    departments,
    last_cycle: lastCycle,
    recoveries: recovery.getAttempts(),
    checks,
    output_dir: RUNTIME_LOOP_ROOT,
  };

  writeRuntimeLoopReports({
    result,
    config,
    lastCycle,
    recoveries: recovery.getAttempts(),
    heartbeatAt: previousHeartbeatAt,
  });

  return result;
}

/** Verify entry — always dry-run, single cycle */
export async function runRuntimeLoopVerify(): Promise<RuntimeLoopResult> {
  return runRuntimeLoop({ config: verifyLoopConfiguration() });
}

const isMain =
  typeof process.argv[1] === "string" &&
  (process.argv[1].endsWith("RuntimeLoop.ts") ||
    process.argv[1].endsWith("RuntimeLoop.js"));

if (isMain) {
  runRuntimeLoopVerify()
    .then((r) => {
      console.log(
        JSON.stringify(
          {
            status: r.status,
            mode: r.mode,
            cycles: r.cycle_count,
            departments: r.departments.length,
            recoveries: r.recoveries.length,
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
