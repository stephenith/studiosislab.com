/**
 * One runtime cycle — orchestration steps only.
 */
import { EventBus } from "../event-bus/EventBus.js";
import { runDepartmentHealthLoop } from "./DepartmentHealthLoop.js";
import { DepartmentRecoveryLoop } from "./DepartmentRecoveryLoop.js";
import type { DepartmentRunner } from "./DepartmentRunner.js";
import type { RuntimeClock } from "./RuntimeClock.js";
import { runSchedulerBridgeTick } from "./RuntimeSchedulerBridge.js";
import { refreshDepartmentProbe, runHeartbeatTick } from "./RuntimeTick.js";
import type {
  CycleStepResult,
  LoopConfiguration,
  RuntimeCycleResult,
} from "./types.js";

async function step(
  num: number,
  name: string,
  fn: () => Promise<string> | string,
): Promise<CycleStepResult> {
  const t0 = Date.now();
  try {
    const detail = await fn();
    return { step: num, name, ok: true, detail, duration_ms: Date.now() - t0 };
  } catch (e) {
    return {
      step: num,
      name,
      ok: false,
      detail: e instanceof Error ? e.message : String(e),
      duration_ms: Date.now() - t0,
    };
  }
}

export async function runRuntimeCycle(input: {
  cycle: number;
  config: LoopConfiguration;
  clock: RuntimeClock;
  runner: DepartmentRunner;
  bus: EventBus;
  recovery: DepartmentRecoveryLoop;
  previousHeartbeatAt: string | null;
}): Promise<RuntimeCycleResult> {
  const started_at = input.clock.nowIso();
  const departments = input.runner.refresh();
  const steps: CycleStepResult[] = [];
  let heartbeat_at = started_at;
  let scheduler_tick_at: string | null = null;
  let dashboard_refresh_at: string | null = null;
  let events_published = 0;

  // 1. Heartbeat
  steps.push(
    await step(1, "runtime_heartbeat", () => {
      const hb = runHeartbeatTick(
        input.clock,
        departments,
        input.previousHeartbeatAt,
      );
      heartbeat_at = hb.at;
      return hb.detail;
    }),
  );

  // 2. Department health
  let health = runDepartmentHealthLoop(departments);
  steps.push(
    await step(2, "department_health", () => {
      const failed = health.filter((h) => h.health === "failed").length;
      const degraded = health.filter((h) => h.health === "degraded").length;
      return `${health.length} checked · failed=${failed} · degraded=${degraded}`;
    }),
  );

  // 3–9 named refresh probes (lookup by discovery id — no hardcoded runner list)
  const refreshIds = [
    ["website-department", "website_department"],
    ["security-department", "security_department"],
    ["timeline-department", "timeline_department"],
    ["notification-department", "notification_department"],
    ["production-dashboard", "production_dashboard"],
    ["founder-dashboard", "founder_dashboard"],
    ["founder-control-center", "founder_control_center"],
  ] as const;

  let stepNum = 3;
  for (const [id, name] of refreshIds) {
    const n = stepNum;
    steps.push(
      await step(n, name, () => {
        const probe = refreshDepartmentProbe(
          input.runner.find(id),
          id,
          input.config,
        );
        if (name.includes("dashboard") || name.includes("founder_control")) {
          dashboard_refresh_at = input.clock.nowIso();
        }
        if (!probe.ok) throw new Error(probe.detail);
        return probe.detail;
      }),
    );
    stepNum += 1;
  }

  // 10. Event Bus dispatch
  steps.push(
    await step(10, "event_bus_dispatch", async () => {
      await input.bus.publish("SYSTEM_HEALTHY", "runtime-loop", {
        cycle: input.cycle,
        dry_run: input.config.dry_run,
        departments: departments.length,
      });
      events_published += 1;
      // Also publish warning if any degraded
      if (health.some((h) => h.health === "degraded" || h.health === "failed")) {
        await input.bus.publish("SYSTEM_WARNING", "runtime-loop", {
          cycle: input.cycle,
          unhealthy: health
            .filter((h) => h.health !== "ok" && h.health !== "unknown")
            .map((h) => h.id),
        });
        events_published += 1;
      }
      return `published ${events_published} event(s)`;
    }),
  );

  // 11. Scheduler tick
  steps.push(
    await step(11, "scheduler_tick", () => {
      const tick = runSchedulerBridgeTick(input.config);
      scheduler_tick_at = tick.at;
      if (!tick.ok) throw new Error(tick.detail);
      return tick.detail;
    }),
  );

  // 12. Recovery check
  const recoveries = await input.recovery.recoverUnhealthy(health);
  steps.push(
    await step(12, "recovery_check", () => {
      events_published += recoveries.filter((r) => r.event_published).length;
      return `${recoveries.length} recovery attempt(s) · dry_run=${input.config.dry_run}`;
    }),
  );

  // 13. Write runtime snapshot — handled by reporter after cycle
  steps.push(
    await step(13, "runtime_snapshot", () => "snapshot pending reporter write"),
  );

  // 14. Sleep — handled by outer loop
  steps.push(
    await step(14, "sleep_marker", () => {
      const ms =
        input.config.sleep_ms_override ??
        (input.config.dry_run ? 0 : input.config.runtime_interval_ms);
      return `next sleep ${ms}ms`;
    }),
  );

  return {
    cycle: input.cycle,
    started_at,
    finished_at: input.clock.nowIso(),
    mode: input.config.dry_run ? "dry_run" : "live",
    steps,
    health,
    recoveries,
    events_published,
    heartbeat_at,
    scheduler_tick_at,
    dashboard_refresh_at,
  };
}
