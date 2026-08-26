/**
 * Canonical Adaptive Scheduling Policy verify — Agent #220.
 * Isolated fixtures. No production. No OpenAI.
 */
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { CYCLE_LOG } from "./runFirstProductionCycle.js";
import {
  AutonomousProductionService,
} from "./AutonomousProductionService.js";
import {
  DEFAULT_ADAPTIVE_SCHEDULE_POLICY,
  boundIntervalMs,
  defaultScheduleState,
  evaluateAdaptiveSchedule,
  minutesToMs,
  scheduleDecisionFingerprint,
  type ScheduleSignals,
} from "./AdaptiveSchedulingPolicy.js";

const REPO = resolve(import.meta.dirname, "../../../..");
const OUT = join(CYCLE_LOG, "schedule-verify.json");
const GUARD = join(REPO, "SOS/SAIOS/architecture/runtime-guard.ts");
const POL_SRC = join(import.meta.dirname, "AdaptiveSchedulingPolicy.ts");
const SVC_SRC = join(import.meta.dirname, "AutonomousProductionService.ts");

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(msg);
}

function forceMock(): void {
  delete process.env.SOS_AI_FOUNDER_OPENAI_ONE_TEST;
  delete process.env.OPENAI_API_KEY;
  delete process.env.SOS_OPENAI_API_KEY;
  process.env.SOS_AIOS_LIVE = "0";
}

function healthyIdleOverrides(
  extra?: Partial<ScheduleSignals>,
): Partial<ScheduleSignals> {
  return {
    system_health_status: "HEALTHY",
    system_health_available: true,
    budget_decision: "ALLOW",
    budget_available: true,
    founder_queue_waiting: 2,
    founder_queue_capacity: 20,
    today_cycles: 1,
    today_candidates: 3,
    last_execution_stop_reason: "completed",
    last_execution_available: true,
    last_failure_available: false,
    consecutive_recent_failures: 0,
    recent_failure_execution_ids: [],
    portfolio_score: 80,
    strategy_recommendation_count: 5,
    dashboard_available: true,
    dashboard_generated_at: "2026-07-21T12:00:00.000Z",
    dashboard_age_minutes: 1,
    dashboard_stale: false,
    operational_pause: false,
    missing_signals: [],
    ...extra,
  };
}

async function main(): Promise<void> {
  forceMock();
  mkdirSync(CYCLE_LOG, { recursive: true });
  const now = new Date("2026-07-21T12:00:00.000Z");
  const fixtureRoot = mkdtempSync(join(tmpdir(), "aios-sched-"));

  // 1. Healthy idle → RUN_SOON
  const idle = evaluateAdaptiveSchedule({
    cycleLog: fixtureRoot,
    now,
    persist: true,
    persist_state: true,
    state: defaultScheduleState(now),
    signal_overrides: healthyIdleOverrides(),
  });
  assert(idle.decision === "RUN_SOON", `idle got ${idle.decision}`);
  assert(
    idle.next_interval_ms ===
      minutesToMs(DEFAULT_ADAPTIVE_SCHEDULE_POLICY.idle_acceleration_interval_minutes),
    "accelerated interval",
  );

  // 2. Normal — near but not accelerate (no recommendations, no portfolio)
  const normal = evaluateAdaptiveSchedule({
    cycleLog: fixtureRoot,
    now,
    persist: true,
    state: defaultScheduleState(now),
    signal_overrides: healthyIdleOverrides({
      strategy_recommendation_count: 0,
      portfolio_score: null,
    }),
  });
  assert(normal.decision === "NORMAL", `normal got ${normal.decision}`);

  // 3. Unhealthy → SLOW_DOWN
  const unhealthy = evaluateAdaptiveSchedule({
    cycleLog: fixtureRoot,
    now,
    persist: true,
    state: defaultScheduleState(now),
    signal_overrides: healthyIdleOverrides({
      system_health_status: "UNHEALTHY",
    }),
  });
  assert(unhealthy.decision === "SLOW_DOWN", "unhealthy slow");
  assert(
    unhealthy.reason_codes.includes("system_unhealthy"),
    "unhealthy reason",
  );

  // 4. Budget deny → longer interval
  const deny = evaluateAdaptiveSchedule({
    cycleLog: fixtureRoot,
    now,
    persist: true,
    state: defaultScheduleState(now),
    signal_overrides: healthyIdleOverrides({
      budget_decision: "DENY",
    }),
  });
  assert(deny.decision === "SLOW_DOWN", "budget deny");
  assert(
    deny.next_interval_ms ===
      minutesToMs(
        DEFAULT_ADAPTIVE_SCHEDULE_POLICY.budget_denied_interval_minutes,
      ),
    "budget interval",
  );

  // 5. Near capacity → SLOW_DOWN
  const near = evaluateAdaptiveSchedule({
    cycleLog: fixtureRoot,
    now,
    persist: true,
    state: defaultScheduleState(now),
    signal_overrides: healthyIdleOverrides({
      founder_queue_waiting: 16,
      founder_queue_capacity: 20,
    }),
  });
  assert(near.decision === "SLOW_DOWN", "near capacity");
  assert(near.reason_codes.includes("founder_queue_near_capacity"), "near code");

  // 6. Queue full → PAUSE / max safe
  const full = evaluateAdaptiveSchedule({
    cycleLog: fixtureRoot,
    now,
    persist: true,
    state: defaultScheduleState(now),
    signal_overrides: healthyIdleOverrides({
      founder_queue_waiting: 20,
      founder_queue_capacity: 20,
    }),
  });
  assert(full.decision === "PAUSE", "queue full pause");
  assert(
    full.next_interval_ms ===
      minutesToMs(
        DEFAULT_ADAPTIVE_SCHEDULE_POLICY.founder_queue_full_interval_minutes,
      ),
    "full interval",
  );

  // 7–8. Failure cooldown + expiry
  const coolRoot = mkdtempSync(join(tmpdir(), "aios-cool-"));
  const failState = defaultScheduleState(now);
  const cool = evaluateAdaptiveSchedule({
    cycleLog: coolRoot,
    now,
    persist: true,
    persist_state: true,
    state: failState,
    signal_overrides: healthyIdleOverrides({
      consecutive_recent_failures: 3,
      recent_failure_execution_ids: ["e1", "e2", "e3"],
      system_health_status: "HEALTHY",
    }),
  });
  assert(cool.decision === "PAUSE", "cooldown pause");
  assert(cool.cooldown_state.active === true, "cooldown active");
  assert(cool.reason_codes.includes("failure_cooldown_triggered") ||
    cool.reason_codes.includes("failure_cooldown_active"), "cooldown reason");

  const afterExpiry = evaluateAdaptiveSchedule({
    cycleLog: coolRoot,
    now: new Date("2026-07-21T14:00:00.000Z"), // > 90 min later
    persist: true,
    persist_state: true,
    signal_overrides: healthyIdleOverrides({
      consecutive_recent_failures: 0,
      recent_failure_execution_ids: [],
    }),
  });
  assert(
    afterExpiry.decision === "RUN_SOON" || afterExpiry.decision === "NORMAL",
    `after cooldown ${afterExpiry.decision}`,
  );
  assert(afterExpiry.cooldown_state.active === false, "cooldown cleared");

  // 9. Fast-cycle protection
  const fastRoot = mkdtempSync(join(tmpdir(), "aios-fast-"));
  let st = defaultScheduleState(now);
  for (let i = 0; i < 4; i++) {
    const r = evaluateAdaptiveSchedule({
      cycleLog: fastRoot,
      now,
      persist: true,
      persist_state: true,
      state: st,
      signal_overrides: healthyIdleOverrides(),
    });
    assert(r.decision === "RUN_SOON", `fast ${i} RUN_SOON`);
    st = {
      ...st,
      consecutive_fast_cycles: r.fast_cycle_state.consecutive_fast_cycles,
      last_decision: r.decision,
    };
  }
  const protectedRun = evaluateAdaptiveSchedule({
    cycleLog: fastRoot,
    now,
    persist: true,
    persist_state: true,
    state: st,
    signal_overrides: healthyIdleOverrides(),
  });
  assert(protectedRun.decision === "NORMAL", "fast protection NORMAL");
  assert(
    protectedRun.fast_cycle_state.fast_cycle_protection_applied,
    "protection flag",
  );

  // 10. Bounds
  const huge = evaluateAdaptiveSchedule({
    cycleLog: fixtureRoot,
    now,
    persist: false,
    persist_state: false,
    state: defaultScheduleState(now),
    policy: { maximum_interval_minutes: 180, minimum_interval_minutes: 15 },
    signal_overrides: healthyIdleOverrides({
      founder_queue_waiting: 20,
      founder_queue_capacity: 20,
    }),
  });
  assert(
    huge.next_interval_ms >=
      minutesToMs(DEFAULT_ADAPTIVE_SCHEDULE_POLICY.minimum_interval_minutes),
    "min bound",
  );
  assert(
    huge.next_interval_ms <=
      minutesToMs(DEFAULT_ADAPTIVE_SCHEDULE_POLICY.maximum_interval_minutes),
    "max bound",
  );
  assert(
    boundIntervalMs(1, DEFAULT_ADAPTIVE_SCHEDULE_POLICY) ===
      minutesToMs(15),
    "bound helper min",
  );

  // 11. Missing dashboard safe
  const emptyRoot = mkdtempSync(join(tmpdir(), "aios-empty-"));
  const missing = evaluateAdaptiveSchedule({
    cycleLog: emptyRoot,
    now,
    persist: true,
    state: defaultScheduleState(now),
  });
  assert(
    missing.decision === "PAUSE" ||
      missing.decision === "NORMAL" ||
      missing.decision === "SLOW_DOWN",
    "missing dashboard safe",
  );
  assert(missing.safety.production_triggered === false, "no production");

  // 12. Stale dashboard
  const stale = evaluateAdaptiveSchedule({
    cycleLog: fixtureRoot,
    now,
    persist: true,
    state: defaultScheduleState(now),
    signal_overrides: healthyIdleOverrides({
      dashboard_stale: true,
      dashboard_age_minutes: 120,
    }),
  });
  assert(stale.decision === "SLOW_DOWN", "stale slow");
  assert(stale.reason_codes.includes("dashboard_stale"), "stale reason");

  // 13. Deterministic
  const d1 = evaluateAdaptiveSchedule({
    cycleLog: fixtureRoot,
    now,
    persist: false,
    persist_state: false,
    state: defaultScheduleState(now),
    signal_overrides: healthyIdleOverrides(),
  });
  const d2 = evaluateAdaptiveSchedule({
    cycleLog: fixtureRoot,
    now,
    persist: false,
    persist_state: false,
    state: defaultScheduleState(now),
    signal_overrides: healthyIdleOverrides(),
  });
  assert(
    scheduleDecisionFingerprint(d1) === scheduleDecisionFingerprint(d2),
    "deterministic",
  );

  // 14–15. Report + history
  assert(
    existsSync(join(fixtureRoot, "scheduling", "adaptive-schedule-report.json")),
    "report written",
  );
  const hist = readdirSync(join(fixtureRoot, "scheduling", "history")).filter(
    (f) => f.endsWith(".json"),
  );
  assert(hist.length >= 1, "history retained");

  // 16. Autonomous consumes adaptive interval
  const sleeps: number[] = [];
  const svc = new AutonomousProductionService();
  svc.start({
    adaptive_scheduling_enabled: true,
    interval_ms: 30 * 60 * 1000,
    max_iterations: 2,
    force_mock: true,
    queue_max: 100,
    sleep: async (ms) => {
      sleeps.push(ms);
    },
    runProductionFn: async () => {
      throw new Error("should not produce in schedule consume test");
    },
    evaluateScheduleFn: () =>
      ({
        ...idle,
        next_interval_ms: 12345,
        decision: "RUN_SOON" as const,
      }),
    health_simulate: { queue_over_limit: true },
  });
  const t0 = Date.now();
  while ((svc.status().running || svc.status().busy) && Date.now() - t0 < 5000) {
    await new Promise((r) => setTimeout(r, 20));
  }
  assert(sleeps.includes(12345), `adaptive sleep used ${sleeps.join(",")}`);
  assert(
    svc.status().adaptive_scheduling_enabled === true,
    "status adaptive flag",
  );

  // 17. Fixed-interval compatibility
  const sleepsFixed: number[] = [];
  const svcF = new AutonomousProductionService();
  svcF.start({
    interval_ms: 42,
    adaptive_scheduling_enabled: false,
    max_iterations: 2,
    force_mock: true,
    queue_max: 100,
    sleep: async (ms) => {
      sleepsFixed.push(ms);
    },
    runProductionFn: async () => {
      throw new Error("no produce");
    },
    health_simulate: { queue_over_limit: true },
  });
  const t1 = Date.now();
  while ((svcF.status().running || svcF.status().busy) && Date.now() - t1 < 5000) {
    await new Promise((r) => setTimeout(r, 20));
  }
  assert(sleepsFixed.includes(42), "fixed interval preserved");

  // 18. Graceful stop unchanged — covered by autonomous verify; light check
  assert(typeof svc.stop === "function", "stop exists");

  const polSrc = readFileSync(POL_SRC, "utf8");
  const svcSrc = readFileSync(SVC_SRC, "utf8");
  assert(!/from\s+["'].*openai/i.test(polSrc), "no openai in policy");
  assert(!/runCanonicalBatch\s*\(/.test(polSrc), "no batch in policy");
  assert(!/runProduction\s*\(/.test(polSrc), "no controller in policy");
  assert(/runProduction/.test(svcSrc), "service uses controller");
  assert(!/runCanonicalBatch\s*\(/.test(svcSrc), "service no direct batch");
  assert(/evaluateAdaptiveSchedule/.test(svcSrc), "service consumes schedule");
  assert(
    existsSync(GUARD) && readFileSync(GUARD, "utf8").includes("ENGINES"),
    "runtime guard",
  );
  assert(process.env.SOS_AIOS_LIVE !== "1", "LIVE off");
  assert(idle.safety.publication_allowed === false, "publication false");

  const checks = {
    healthy_idle_run_soon: true,
    normal_path: true,
    unhealthy_slow_or_pause: true,
    budget_denial_slows: true,
    queue_near_slows: true,
    queue_full_pause: true,
    failure_cooldown: true,
    cooldown_expiry: true,
    fast_cycle_protection: true,
    interval_bounds: true,
    missing_dashboard_safe: true,
    stale_dashboard_safe: true,
    deterministic: true,
    report_written: true,
    history_retained: true,
    autonomous_consumes_interval: true,
    fixed_interval_compat: true,
    controller_sole_entry: true,
    no_batchrunner_from_policy: true,
    no_openai: true,
    no_production_from_schedule: true,
    no_publication: true,
    live_off: true,
    runtime_guard: true,
  };

  const overall = Object.values(checks).every(Boolean);
  writeFileSync(
    OUT,
    `${JSON.stringify(
      {
        generated_at: new Date().toISOString(),
        agent: "220",
        overall: overall ? "PASS" : "FAIL",
        checks,
        sample_idle: idle.decision,
        sample_deny_ms: deny.next_interval_ms,
        adaptive_sleep: sleeps,
        fixed_sleep: sleepsFixed,
      },
      null,
      2,
    )}\n`,
  );

  console.log("Canonical Adaptive Scheduling Policy Verify");
  console.log("==========================================");
  for (const [k, v] of Object.entries(checks)) {
    console.log(`${v ? "✔" : "✘"} ${k}`);
  }
  console.log(`Overall: ${overall ? "PASS" : "FAIL"}`);
  if (!overall) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
