/**
 * Runtime Supervisor — parent watchdog for the Runtime Loop.
 * AGENT #110 — orchestration only; dry-run safe; never infinite in verify.
 */
import { EventBus } from "../event-bus/EventBus.js";
import { detectFailures } from "./FailureDetector.js";
import { collectFounderActions } from "./founder-monitoring.js";
import { collectHealthSnapshot } from "./HealthSupervisor.js";
import { superviseRuntimeLoop } from "./LoopSupervisor.js";
import { RecoveryCoordinator } from "./RecoveryCoordinator.js";
import { RestartCoordinator } from "./RestartCoordinator.js";
import {
  persistSupervisorConfiguration,
  SUPERVISOR_ROOT,
  verifySupervisorConfiguration,
  defaultSupervisorConfiguration,
} from "./SupervisorConfiguration.js";
import { readSupervisorHeartbeat } from "./SupervisorHeartbeat.js";
import { writeSupervisorReports } from "./SupervisorReporter.js";
import type { SupervisorConfiguration, SupervisorResult } from "./types.js";
import { Watchdog } from "./Watchdog.js";

export type RunSupervisorOptions = {
  config?: SupervisorConfiguration;
};

export async function runRuntimeSupervisor(
  options: RunSupervisorOptions = {},
): Promise<SupervisorResult> {
  const config = persistSupervisorConfiguration(
    options.config ?? defaultSupervisorConfiguration(),
  );
  const generated_at = new Date().toISOString();
  const bus = new EventBus();
  const restarts = new RestartCoordinator(config);
  const recovery = new RecoveryCoordinator(config, restarts);
  const watchdog = new Watchdog(config, restarts, bus);

  // 1) Supervise / start Runtime Loop (capped, dry-run in verify)
  const loop = await superviseRuntimeLoop(config);

  // 2) Heartbeat + health + failures
  const heartbeat = readSupervisorHeartbeat(config);
  const health = collectHealthSnapshot(config);
  const failures = detectFailures({ config, heartbeat });

  // 3) Watchdog evaluation
  const watchdogResult = await watchdog.evaluate({ heartbeat, failures });

  // 4) Recovery from remaining failures
  const recovered = await recovery.recoverFromFailures(failures);

  // 5) Founder monitoring (generate only)
  const founder_actions = collectFounderActions(config);

  const events_published = [
    ...watchdogResult.events_published,
    ...recovered.restarts
      .map((r) => r.event_published)
      .filter((x): x is string => Boolean(x)),
  ];

  const allRestarts = [...restarts.getHistory()];
  const allRecoveries = recovery.getHistory();

  const checks = {
    supervisor: true,
    watchdog: Boolean(watchdogResult.detail),
    heartbeat_monitor: heartbeat.heartbeat_at != null || heartbeat.source !== "missing",
    restart_coordinator: true,
    recovery_coordinator: true,
    founder_monitoring: Array.isArray(founder_actions),
    reports: true,
    dry_run_safety: config.dry_run === true,
  };

  let status: SupervisorResult["status"] = "READY";
  if (failures.some((f) => f.severity === "critical") && !config.dry_run) {
    status = "DEGRADED";
  }
  // In dry-run verify, historical stale heartbeats are softened by config timeouts;
  // still mark DEGRADED if loop supervision failed.
  if (!loop.ok) status = "BLOCKED";
  if (
    failures.some((f) => f.severity === "critical") &&
    watchdogResult.events_published.includes("SYSTEM_CRITICAL")
  ) {
    status = "DEGRADED";
  }

  const result: SupervisorResult = {
    generated_at,
    status,
    mode: config.dry_run ? "dry_run" : "live",
    heartbeat,
    failures,
    restarts: allRestarts,
    recoveries: allRecoveries,
    founder_actions,
    events_published,
    loop_supervised: loop.ok,
    checks,
    output_dir: SUPERVISOR_ROOT,
  };

  writeSupervisorReports({ result, health, watchdog: watchdogResult });
  return result;
}

export async function runRuntimeSupervisorVerify(): Promise<SupervisorResult> {
  return runRuntimeSupervisor({ config: verifySupervisorConfiguration() });
}

const isMain =
  typeof process.argv[1] === "string" &&
  (process.argv[1].endsWith("RuntimeSupervisor.ts") ||
    process.argv[1].endsWith("RuntimeSupervisor.js"));

if (isMain) {
  runRuntimeSupervisorVerify()
    .then((r) => {
      console.log(
        JSON.stringify(
          {
            status: r.status,
            mode: r.mode,
            loop_supervised: r.loop_supervised,
            failures: r.failures.length,
            restarts: r.restarts.length,
            founder_actions: r.founder_actions.length,
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
