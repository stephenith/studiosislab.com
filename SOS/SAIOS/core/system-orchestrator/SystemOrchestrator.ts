/**
 * Canonical System Orchestrator — Agent #226.
 *
 * Owns coordination only: lifecycle stages, events, retry coordination, audit.
 * Never owns production, scheduling, budget, health, portfolio, strategy,
 * engineering, Mission Control, Founder Review, or Runtime Guard.
 *
 * Production always enters via ProductionController.runProduction.
 */
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import {
  runProduction,
  type ProductionControllerOptions,
} from "../first-production-cycle/ProductionController.js";
import { evaluateAdaptiveSchedule } from "../first-production-cycle/AdaptiveSchedulingPolicy.js";
import { buildOperationalPolicyAdvice } from "../first-production-cycle/OperationalPolicyAdvisor.js";
import { planPortfolio } from "../first-production-cycle/PortfolioPlanner.js";
import { buildProductionStrategy } from "../first-production-cycle/ProductionStrategyEngine.js";
import { buildFounderCommandCenterSnapshot } from "../first-production-cycle/FounderCommandCenter.js";
import { buildOperationsDashboard } from "../first-production-cycle/OperationsDashboard.js";
import { buildEngineeringIntelligenceReport } from "../engineering-intelligence/EngineeringIntelligence.js";

const REPO = resolve(import.meta.dirname, "../../../..");
const GUARD = join(REPO, "SOS/SAIOS/architecture/runtime-guard.ts");
const LOG_ROOT = join(REPO, "SOS/07_LOGS/saios/system-orchestrator");
const STATE_PATH = join(LOG_ROOT, "orchestration-state.json");

export const SYSTEM_ORCHESTRATOR_VERSION = "1.0.0" as const;

export type OrchestrationEventType =
  | "SYSTEM_STARTED"
  | "RUN_REQUESTED"
  | "RUN_VALIDATED"
  | "RUN_BLOCKED"
  | "RUN_STARTED"
  | "RUN_COMPLETED"
  | "RUN_FAILED"
  | "RUN_CANCELLED"
  | "ENGINEERING_REFRESHED"
  | "PORTFOLIO_REFRESHED"
  | "STRATEGY_REFRESHED"
  | "MISSION_CONTROL_REFRESHED"
  | "SYSTEM_IDLE"
  | "RETRY_EVALUATED";

export type LifecycleStage =
  | "idle"
  | "startup"
  | "validating"
  | "runtime_guard"
  | "operational_policy"
  | "scheduling"
  | "budget"
  | "health"
  | "strategy"
  | "portfolio"
  | "production"
  | "mission_control_refresh"
  | "retry_eval"
  | "cancelled"
  | "completed"
  | "failed";

export type OrchestrationTrigger =
  | "startup"
  | "founder_action"
  | "scheduled"
  | "retry"
  | "cancel"
  | "refresh"
  | "system";

export type OrchestrationEvent = {
  schema_version: 1;
  orchestrator_version: typeof SYSTEM_ORCHESTRATOR_VERSION;
  event_id: string;
  event_type: OrchestrationEventType;
  timestamp: string;
  trigger: OrchestrationTrigger;
  initiator: string;
  current_stage: LifecycleStage;
  execution_path: string;
  delegated_subsystem: string | null;
  result: "ok" | "blocked" | "failed" | "cancelled" | "warning";
  duration_ms: number;
  detail: string;
  canonical_response: unknown;
  live: false;
  publication_allowed: false;
  openai_called: false;
  owns_production: false;
  owns_business_logic: false;
  coordination_only: true;
  runtime_guard_bypassed: false;
  production_controller_bypassed: false;
};

export type OrchestrationState = {
  schema_version: 1;
  agent: "226";
  current_lifecycle_stage: LifecycleStage;
  current_orchestration_event: OrchestrationEventType | null;
  current_execution_path: string;
  last_orchestration_event: OrchestrationEvent | null;
  last_completed_lifecycle: LifecycleStage | null;
  last_execution_id: string | null;
  last_stop_reason: string | null;
  updated_at: string;
  live: false;
  publication_allowed: false;
  production_entry: "ProductionController";
  coordination_only: true;
};

export type OrchestrationSurface = {
  schema_version: 1;
  agent: "226";
  generated_at: string;
  state: OrchestrationState;
  recent_events: OrchestrationEvent[];
  live: false;
  publication_allowed: false;
  founder_approval_required: true;
  production_entry: "ProductionController";
  coordination_only: true;
  owns_production: false;
  owns_business_logic: false;
};

export type OrchestrationResult = {
  ok: boolean;
  blocked: boolean;
  cancelled: boolean;
  reason: string;
  events: OrchestrationEvent[];
  production: unknown;
  refresh: unknown;
  state: OrchestrationState;
};

const RETRYABLE_STOP_REASONS = new Set([
  "fatal_error",
  "health_unhealthy",
  "budget_denied",
]);

function atomicWriteJson(path: string, data: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  const tmp = `${path}.tmp-${process.pid}`;
  writeFileSync(tmp, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  renameSync(tmp, path);
}

function allocateEventId(now: Date): string {
  const stamp = now.toISOString().replace(/[:.]/g, "-");
  return `orch-${stamp}-${Math.floor(Math.random() * 1e6)
    .toString()
    .padStart(6, "0")}`;
}

function readState(): OrchestrationState {
  if (!existsSync(STATE_PATH)) {
    return {
      schema_version: 1,
      agent: "226",
      current_lifecycle_stage: "idle",
      current_orchestration_event: null,
      current_execution_path: "idle",
      last_orchestration_event: null,
      last_completed_lifecycle: null,
      last_execution_id: null,
      last_stop_reason: null,
      updated_at: new Date(0).toISOString(),
      live: false,
      publication_allowed: false,
      production_entry: "ProductionController",
      coordination_only: true,
    };
  }
  try {
    return JSON.parse(readFileSync(STATE_PATH, "utf8")) as OrchestrationState;
  } catch {
    return readStateFallback();
  }
}

function readStateFallback(): OrchestrationState {
  return {
    schema_version: 1,
    agent: "226",
    current_lifecycle_stage: "idle",
    current_orchestration_event: null,
    current_execution_path: "idle",
    last_orchestration_event: null,
    last_completed_lifecycle: null,
    last_execution_id: null,
    last_stop_reason: null,
    updated_at: new Date(0).toISOString(),
    live: false,
    publication_allowed: false,
    production_entry: "ProductionController",
    coordination_only: true,
  };
}

function persistEvent(event: OrchestrationEvent, repoRoot: string): string {
  const root = join(repoRoot, "SOS/07_LOGS/saios/system-orchestrator");
  const hist = join(root, "history");
  mkdirSync(hist, { recursive: true });
  const path = join(hist, `${event.event_id}.json`);
  atomicWriteJson(path, event);
  atomicWriteJson(join(root, "latest-event.json"), event);
  writeFileSync(join(root, "events.jsonl"), `${JSON.stringify(event)}\n`, {
    encoding: "utf8",
    flag: "a",
  });
  return relative(repoRoot, path).replace(/\\/g, "/");
}

function writeState(partial: Partial<OrchestrationState>): OrchestrationState {
  const prev = readState();
  const next: OrchestrationState = {
    ...prev,
    ...partial,
    schema_version: 1,
    agent: "226",
    live: false,
    publication_allowed: false,
    production_entry: "ProductionController",
    coordination_only: true,
    updated_at: new Date().toISOString(),
  };
  atomicWriteJson(STATE_PATH, next);
  return next;
}

function checkRuntimeGuard(): { ok: true } | { ok: false; reason: string } {
  if (process.env.SOS_AIOS_LIVE === "1") {
    return { ok: false, reason: "LIVE must be OFF" };
  }
  if (!existsSync(GUARD)) {
    return { ok: false, reason: "Runtime Guard missing" };
  }
  const txt = readFileSync(GUARD, "utf8");
  if (!txt.includes("ENGINES")) {
    return { ok: false, reason: "Runtime Guard invalid" };
  }
  return { ok: true };
}

function emit(opts: {
  event_type: OrchestrationEventType;
  trigger: OrchestrationTrigger;
  initiator: string;
  current_stage: LifecycleStage;
  execution_path: string;
  delegated_subsystem: string | null;
  result: OrchestrationEvent["result"];
  detail: string;
  duration_ms?: number;
  canonical_response?: unknown;
  repoRoot: string;
  t0: number;
}): OrchestrationEvent {
  const now = new Date();
  const event: OrchestrationEvent = {
    schema_version: 1,
    orchestrator_version: SYSTEM_ORCHESTRATOR_VERSION,
    event_id: allocateEventId(now),
    event_type: opts.event_type,
    timestamp: now.toISOString(),
    trigger: opts.trigger,
    initiator: opts.initiator,
    current_stage: opts.current_stage,
    execution_path: opts.execution_path,
    delegated_subsystem: opts.delegated_subsystem,
    result: opts.result,
    duration_ms:
      opts.duration_ms ?? Number((performance.now() - opts.t0).toFixed(2)),
    detail: opts.detail,
    canonical_response: opts.canonical_response ?? null,
    live: false,
    publication_allowed: false,
    openai_called: false,
    owns_production: false,
    owns_business_logic: false,
    coordination_only: true,
    runtime_guard_bypassed: false,
    production_controller_bypassed: false,
  };
  persistEvent(event, opts.repoRoot);
  writeState({
    current_lifecycle_stage: opts.current_stage,
    current_orchestration_event: opts.event_type,
    current_execution_path: opts.execution_path,
    last_orchestration_event: event,
    last_completed_lifecycle:
      opts.event_type === "RUN_COMPLETED" ||
      opts.event_type === "SYSTEM_IDLE" ||
      opts.event_type === "MISSION_CONTROL_REFRESHED"
        ? opts.current_stage
        : readState().last_completed_lifecycle,
  });
  return event;
}

async function refreshMissionControl(repoRoot: string): Promise<unknown> {
  const snap = buildFounderCommandCenterSnapshot({ repoRoot });
  return {
    generated_at: snap.generated_at,
    duration_ms: snap.duration_ms,
    read_only: snap.read_only,
    mutations: snap.mutations,
  };
}

/**
 * Startup coordination: Guard → Policy → Scheduling (consult) → idle.
 * Does not start production automatically. Budget/Health remain inside ProductionController.
 */
export async function coordinateStartup(opts?: {
  initiator?: string;
  repoRoot?: string;
}): Promise<OrchestrationResult> {
  const repoRoot = opts?.repoRoot ?? REPO;
  const initiator = opts?.initiator ?? "system";
  const t0 = performance.now();
  const events: OrchestrationEvent[] = [];
  const path =
    "RuntimeGuard→OperationalPolicy→AdaptiveScheduling→(Budget/Health via ProductionController)→Idle";

  events.push(
    emit({
      event_type: "SYSTEM_STARTED",
      trigger: "startup",
      initiator,
      current_stage: "startup",
      execution_path: path,
      delegated_subsystem: null,
      result: "ok",
      detail: "System Orchestrator startup coordination begin",
      repoRoot,
      t0,
    }),
  );

  events.push(
    emit({
      event_type: "RUN_VALIDATED",
      trigger: "startup",
      initiator,
      current_stage: "runtime_guard",
      execution_path: path,
      delegated_subsystem: "RuntimeGuard",
      result: "ok",
      detail: "Consulting Runtime Guard (read-only)",
      repoRoot,
      t0,
    }),
  );

  const guard = checkRuntimeGuard();
  if (!guard.ok) {
    events.push(
      emit({
        event_type: "RUN_BLOCKED",
        trigger: "startup",
        initiator,
        current_stage: "runtime_guard",
        execution_path: path,
        delegated_subsystem: "RuntimeGuard",
        result: "blocked",
        detail: guard.reason,
        repoRoot,
        t0,
      }),
    );
    return {
      ok: false,
      blocked: true,
      cancelled: false,
      reason: guard.reason,
      events,
      production: null,
      refresh: null,
      state: readState(),
    };
  }

  const advice = buildOperationalPolicyAdvice({ persist: true });
  events.push(
    emit({
      event_type: "RUN_VALIDATED",
      trigger: "startup",
      initiator,
      current_stage: "operational_policy",
      execution_path: path,
      delegated_subsystem: "OperationalPolicyAdvisor",
      result: "ok",
      detail: "Operational policy consulted (advisory)",
      canonical_response: {
        recommendation_count: advice.recommendations?.length ?? 0,
        report_path: advice.report_path,
      },
      repoRoot,
      t0,
    }),
  );

  const schedule = evaluateAdaptiveSchedule({
    persist: true,
    persist_state: true,
  });
  events.push(
    emit({
      event_type: "RUN_VALIDATED",
      trigger: "startup",
      initiator,
      current_stage: "scheduling",
      execution_path: path,
      delegated_subsystem: "AdaptiveSchedulingPolicy",
      result: "ok",
      detail: `Schedule decision ${schedule.decision}`,
      canonical_response: {
        decision: schedule.decision,
        next_interval_ms: schedule.next_interval_ms,
        reason_codes: schedule.reason_codes,
      },
      repoRoot,
      t0,
    }),
  );

  // Budget + Health are owned by ProductionController — record coordination note only
  events.push(
    emit({
      event_type: "SYSTEM_IDLE",
      trigger: "startup",
      initiator,
      current_stage: "idle",
      execution_path: path,
      delegated_subsystem: "ProductionController",
      result: "ok",
      detail:
        "Startup complete — Budget/Health deferred to ProductionController on next run",
      repoRoot,
      t0,
    }),
  );

  writeState({
    current_lifecycle_stage: "idle",
    current_orchestration_event: "SYSTEM_IDLE",
    current_execution_path: path,
    last_completed_lifecycle: "startup",
  });

  return {
    ok: true,
    blocked: false,
    cancelled: false,
    reason: "Startup coordinated — system idle",
    events,
    production: null,
    refresh: null,
    state: readState(),
  };
}

async function runThroughProduction(opts: {
  trigger: OrchestrationTrigger;
  initiator: string;
  execution_path: string;
  repoRoot: string;
  t0: number;
  events: OrchestrationEvent[];
  preflight?: () => Promise<{ blocked: boolean; reason: string; extra?: unknown }>;
  /** Optional ProductionController options (supervised first run caps applied by caller). */
  production_opts?: ProductionControllerOptions;
}): Promise<OrchestrationResult> {
  const { trigger, initiator, execution_path, repoRoot, t0, events } = opts;

  events.push(
    emit({
      event_type: "RUN_REQUESTED",
      trigger,
      initiator,
      current_stage: "validating",
      execution_path,
      delegated_subsystem: null,
      result: "ok",
      detail: "Run requested",
      repoRoot,
      t0,
    }),
  );

  events.push(
    emit({
      event_type: "RUN_VALIDATED",
      trigger,
      initiator,
      current_stage: "runtime_guard",
      execution_path,
      delegated_subsystem: "RuntimeGuard",
      result: "ok",
      detail: "Validating Runtime Guard",
      repoRoot,
      t0,
    }),
  );

  const guard = checkRuntimeGuard();
  if (!guard.ok) {
    events.push(
      emit({
        event_type: "RUN_BLOCKED",
        trigger,
        initiator,
        current_stage: "runtime_guard",
        execution_path,
        delegated_subsystem: "RuntimeGuard",
        result: "blocked",
        detail: guard.reason,
        repoRoot,
        t0,
      }),
    );
    return {
      ok: false,
      blocked: true,
      cancelled: false,
      reason: guard.reason,
      events,
      production: null,
      refresh: null,
      state: readState(),
    };
  }

  if (opts.preflight) {
    const pre = await opts.preflight();
    if (pre.blocked) {
      events.push(
        emit({
          event_type: "RUN_BLOCKED",
          trigger,
          initiator,
          current_stage: "scheduling",
          execution_path,
          delegated_subsystem: "AdaptiveSchedulingPolicy",
          result: "blocked",
          detail: pre.reason,
          canonical_response: pre.extra ?? null,
          repoRoot,
          t0,
        }),
      );
      return {
        ok: false,
        blocked: true,
        cancelled: false,
        reason: pre.reason,
        events,
        production: null,
        refresh: null,
        state: readState(),
      };
    }
  }

  // Policy consult (advisory) — never applies changes
  const advice = buildOperationalPolicyAdvice({ persist: false });
  events.push(
    emit({
      event_type: "RUN_VALIDATED",
      trigger,
      initiator,
      current_stage: "operational_policy",
      execution_path,
      delegated_subsystem: "OperationalPolicyAdvisor",
      result: "ok",
      detail: "Policy advisor consulted",
      canonical_response: {
        recommendation_count: advice.recommendations?.length ?? 0,
      },
      repoRoot,
      t0,
    }),
  );

  // Budget + Health stages recorded as delegated to ProductionController
  events.push(
    emit({
      event_type: "RUN_STARTED",
      trigger,
      initiator,
      current_stage: "production",
      execution_path,
      delegated_subsystem: "ProductionController",
      result: "ok",
      detail:
        "Delegating to ProductionController (Health→Budget→Batch owned there)",
      repoRoot,
      t0,
    }),
  );
  writeState({
    current_lifecycle_stage: "budget",
    current_orchestration_event: "RUN_STARTED",
    current_execution_path: execution_path,
  });
  writeState({
    current_lifecycle_stage: "health",
    current_orchestration_event: "RUN_STARTED",
    current_execution_path: execution_path,
  });
  writeState({
    current_lifecycle_stage: "production",
    current_orchestration_event: "RUN_STARTED",
    current_execution_path: execution_path,
  });

  let production: unknown = null;
  try {
    const productionOpts: ProductionControllerOptions = {
      force_mock: true,
      ...opts.production_opts,
    };
    const result = await runProduction(productionOpts);
    production = {
      execution_id: result.execution_id,
      stop_reason: result.stop_reason,
      candidate_count: result.candidate_count,
      health: result.health.status,
      budget: result.budget?.decision ?? null,
      publication_allowed: result.publication_allowed,
      live: result.live,
      entrypoint: result.entrypoint,
    };

    const failed =
      result.stop_reason === "fatal_error" ||
      result.stop_reason === "live_refused" ||
      result.stop_reason === "health_unhealthy" ||
      result.stop_reason === "budget_denied";

    events.push(
      emit({
        event_type: failed ? "RUN_FAILED" : "RUN_COMPLETED",
        trigger,
        initiator,
        current_stage: failed ? "failed" : "completed",
        execution_path,
        delegated_subsystem: "ProductionController",
        result: failed ? "failed" : "ok",
        detail: `Production stop_reason=${result.stop_reason}`,
        canonical_response: production,
        repoRoot,
        t0,
      }),
    );

    writeState({
      last_execution_id: result.execution_id,
      last_stop_reason: result.stop_reason,
      last_completed_lifecycle: failed ? "failed" : "completed",
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    events.push(
      emit({
        event_type: "RUN_FAILED",
        trigger,
        initiator,
        current_stage: "failed",
        execution_path,
        delegated_subsystem: "ProductionController",
        result: "failed",
        detail: msg,
        repoRoot,
        t0,
      }),
    );
    writeState({
      last_stop_reason: "exception",
      last_completed_lifecycle: "failed",
    });

    const refreshFail = await refreshMissionControl(repoRoot);
    events.push(
      emit({
        event_type: "MISSION_CONTROL_REFRESHED",
        trigger,
        initiator,
        current_stage: "mission_control_refresh",
        execution_path,
        delegated_subsystem: "FounderCommandCenter",
        result: "warning",
        detail: "Mission Control refreshed after failure",
        canonical_response: refreshFail,
        repoRoot,
        t0,
      }),
    );

    return {
      ok: false,
      blocked: false,
      cancelled: false,
      reason: msg,
      events,
      production: null,
      refresh: refreshFail,
      state: readState(),
    };
  }

  const refresh = await refreshMissionControl(repoRoot);
  events.push(
    emit({
      event_type: "MISSION_CONTROL_REFRESHED",
      trigger,
      initiator,
      current_stage: "mission_control_refresh",
      execution_path,
      delegated_subsystem: "FounderCommandCenter",
      result: "ok",
      detail: "Mission Control / FCC snapshot refreshed",
      canonical_response: refresh,
      repoRoot,
      t0,
    }),
  );

  events.push(
    emit({
      event_type: "SYSTEM_IDLE",
      trigger,
      initiator,
      current_stage: "idle",
      execution_path,
      delegated_subsystem: null,
      result: "ok",
      detail: "Lifecycle complete — system idle",
      repoRoot,
      t0,
    }),
  );

  const lastProd = production as { stop_reason?: string } | null;
  const failed =
    lastProd?.stop_reason === "fatal_error" ||
    lastProd?.stop_reason === "live_refused" ||
    lastProd?.stop_reason === "health_unhealthy" ||
    lastProd?.stop_reason === "budget_denied";

  return {
    ok: !failed,
    blocked: false,
    cancelled: false,
    reason: failed
      ? `Production failed: ${lastProd?.stop_reason}`
      : "Run coordinated via ProductionController",
    events,
    production,
    refresh,
    state: readState(),
  };
}

/** Founder-triggered production cycle. */
export async function coordinateFounderRun(opts?: {
  initiator?: string;
  repoRoot?: string;
  production_opts?: ProductionControllerOptions;
}): Promise<OrchestrationResult> {
  return runThroughProduction({
    trigger: "founder_action",
    initiator: opts?.initiator ?? "founder",
    execution_path:
      "FounderAction→RuntimeGuard→SystemOrchestrator→ProductionController→MissionControl",
    repoRoot: opts?.repoRoot ?? REPO,
    t0: performance.now(),
    events: [],
    production_opts: opts?.production_opts,
  });
}

/**
 * Founder-supervised first production run (Agent #230).
 * Caps batch_size and max_openai at 5. Concurrency remains sequential in BatchRunner.
 * Does not publish. Does not enable LIVE.
 */
export async function coordinateSupervisedProduction(opts?: {
  initiator?: string;
  repoRoot?: string;
  production_opts?: ProductionControllerOptions;
}): Promise<OrchestrationResult> {
  const incoming = opts?.production_opts ?? {};
  const batch_size = Math.min(
    5,
    Math.max(1, Math.floor(incoming.batch_size ?? 5)),
  );
  const max_openai_per_batch = Math.min(
    5,
    Math.max(0, Math.floor(incoming.max_openai_per_batch ?? 5)),
  );
  return runThroughProduction({
    trigger: "founder_action",
    initiator: opts?.initiator ?? "founder",
    execution_path:
      "FounderAction→FounderSupervisedProductionRunner→SystemOrchestrator→RuntimeGuard→OperationalPolicy→AdaptiveScheduling→Budget→Health→Strategy→Portfolio→ProductionController→Research→Isolation→Critic→FounderReview→MissionControl→Audit",
    repoRoot: opts?.repoRoot ?? REPO,
    t0: performance.now(),
    events: [],
    preflight: async () => {
      // Consult adaptive scheduling (applicable advisory) — does not own or apply schedules
      evaluateAdaptiveSchedule({ persist: false, persist_state: false });
      return { blocked: false, reason: "Adaptive scheduling consulted" };
    },
    production_opts: {
      ...incoming,
      batch_size,
      max_openai_per_batch,
    },
  });
}

/** Scheduled path: Adaptive Scheduling → Orchestrator → Policy → PC → refresh. */
export async function coordinateScheduledRun(opts?: {
  initiator?: string;
  repoRoot?: string;
}): Promise<OrchestrationResult> {
  const repoRoot = opts?.repoRoot ?? REPO;
  const initiator = opts?.initiator ?? "scheduler";
  const t0 = performance.now();
  const events: OrchestrationEvent[] = [];
  const execution_path =
    "AdaptiveScheduling→SystemOrchestrator→OperationalPolicy→ProductionController(Health+Budget)→MissionControl";

  return runThroughProduction({
    trigger: "scheduled",
    initiator,
    execution_path,
    repoRoot,
    t0,
    events,
    preflight: async () => {
      const schedule = evaluateAdaptiveSchedule({
        persist: true,
        persist_state: true,
      });
      events.push(
        emit({
          event_type: "RUN_VALIDATED",
          trigger: "scheduled",
          initiator,
          current_stage: "scheduling",
          execution_path,
          delegated_subsystem: "AdaptiveSchedulingPolicy",
          result: "ok",
          detail: `Schedule decision ${schedule.decision}`,
          canonical_response: {
            decision: schedule.decision,
            next_interval_ms: schedule.next_interval_ms,
            reason_codes: schedule.reason_codes,
          },
          repoRoot,
          t0,
        }),
      );
      if (schedule.decision === "PAUSE") {
        return {
          blocked: true,
          reason: "Schedule decision PAUSE — production not triggered",
          extra: {
            decision: schedule.decision,
            reason_codes: schedule.reason_codes,
          },
        };
      }
      return { blocked: false, reason: "schedule allows run" };
    },
  });
}

/**
 * Centralized retry coordination. Reuses ProductionController for the retry run.
 * Does not embed retry loops inside other subsystems.
 */
export async function coordinateRetry(opts?: {
  initiator?: string;
  repoRoot?: string;
}): Promise<OrchestrationResult> {
  const repoRoot = opts?.repoRoot ?? REPO;
  const initiator = opts?.initiator ?? "founder";
  const t0 = performance.now();
  const events: OrchestrationEvent[] = [];
  const execution_path =
    "Failure→SystemOrchestrator→RetryPolicy→ProductionController|Cancel→MissionControl";
  const state = readState();

  const stop = state.last_stop_reason;
  const retryable = stop != null && RETRYABLE_STOP_REASONS.has(stop);

  events.push(
    emit({
      event_type: "RETRY_EVALUATED",
      trigger: "retry",
      initiator,
      current_stage: "retry_eval",
      execution_path,
      delegated_subsystem: "SystemOrchestrator",
      result: retryable ? "ok" : "cancelled",
      detail: retryable
        ? `Retry allowed for stop_reason=${stop}`
        : `Retry declined for stop_reason=${stop ?? "none"}`,
      canonical_response: { last_stop_reason: stop, retryable },
      repoRoot,
      t0,
    }),
  );

  if (!retryable) {
    events.push(
      emit({
        event_type: "RUN_CANCELLED",
        trigger: "retry",
        initiator,
        current_stage: "cancelled",
        execution_path,
        delegated_subsystem: null,
        result: "cancelled",
        detail: "Retry policy cancelled — not retryable",
        repoRoot,
        t0,
      }),
    );
    const refresh = await refreshMissionControl(repoRoot);
    events.push(
      emit({
        event_type: "MISSION_CONTROL_REFRESHED",
        trigger: "retry",
        initiator,
        current_stage: "mission_control_refresh",
        execution_path,
        delegated_subsystem: "FounderCommandCenter",
        result: "ok",
        detail: "Mission Control refreshed after cancel",
        canonical_response: refresh,
        repoRoot,
        t0,
      }),
    );
    writeState({
      current_lifecycle_stage: "idle",
      current_orchestration_event: "RUN_CANCELLED",
      last_completed_lifecycle: "cancelled",
    });
    return {
      ok: false,
      blocked: false,
      cancelled: true,
      reason: `Retry cancelled: stop_reason=${stop ?? "none"}`,
      events,
      production: null,
      refresh,
      state: readState(),
    };
  }

  const run = await runThroughProduction({
    trigger: "retry",
    initiator,
    execution_path,
    repoRoot,
    t0,
    events,
  });
  return run;
}

/** Explicit cancel coordination. */
export async function coordinateCancel(opts?: {
  initiator?: string;
  repoRoot?: string;
  reason?: string;
}): Promise<OrchestrationResult> {
  const repoRoot = opts?.repoRoot ?? REPO;
  const initiator = opts?.initiator ?? "founder";
  const t0 = performance.now();
  const events: OrchestrationEvent[] = [];
  const execution_path = "Cancel→SystemOrchestrator→MissionControl";
  const reason = opts?.reason ?? "Founder cancelled";

  events.push(
    emit({
      event_type: "RUN_CANCELLED",
      trigger: "cancel",
      initiator,
      current_stage: "cancelled",
      execution_path,
      delegated_subsystem: null,
      result: "cancelled",
      detail: reason,
      repoRoot,
      t0,
    }),
  );

  const refresh = await refreshMissionControl(repoRoot);
  events.push(
    emit({
      event_type: "MISSION_CONTROL_REFRESHED",
      trigger: "cancel",
      initiator,
      current_stage: "mission_control_refresh",
      execution_path,
      delegated_subsystem: "FounderCommandCenter",
      result: "ok",
      detail: "Mission Control refreshed after cancel",
      canonical_response: refresh,
      repoRoot,
      t0,
    }),
  );

  writeState({
    current_lifecycle_stage: "idle",
    current_orchestration_event: "RUN_CANCELLED",
    last_completed_lifecycle: "cancelled",
  });

  return {
    ok: true,
    blocked: false,
    cancelled: true,
    reason,
    events,
    production: null,
    refresh,
    state: readState(),
  };
}

export type RefreshKind =
  | "engineering"
  | "portfolio"
  | "strategy"
  | "dashboard"
  | "mission_control";

/** Refresh coordination — delegates to canonical owners. */
export async function coordinateRefresh(opts: {
  kind: RefreshKind;
  initiator?: string;
  repoRoot?: string;
}): Promise<OrchestrationResult> {
  const repoRoot = opts.repoRoot ?? REPO;
  const initiator = opts.initiator ?? "founder";
  const t0 = performance.now();
  const events: OrchestrationEvent[] = [];
  const execution_path = `Refresh→SystemOrchestrator→${opts.kind}`;

  let delegated = "";
  let eventType: OrchestrationEventType = "MISSION_CONTROL_REFRESHED";
  let stage: LifecycleStage = "mission_control_refresh";
  let response: unknown = null;

  switch (opts.kind) {
    case "engineering": {
      const report = buildEngineeringIntelligenceReport({ persist: true });
      delegated = "EngineeringIntelligence";
      eventType = "ENGINEERING_REFRESHED";
      stage = "idle";
      response = {
        overall: report.scores.overall,
        recommendation_count: report.recommendation_count,
        report_path: report.report_path,
        production_triggered: report.production_triggered,
      };
      break;
    }
    case "portfolio": {
      const report = planPortfolio({ persist: true });
      delegated = "PortfolioPlanner";
      eventType = "PORTFOLIO_REFRESHED";
      stage = "portfolio";
      response = {
        coverage_score: report.coverage_score,
        recommendation_count: report.recommendations.length,
        report_path: report.report_path,
        production_triggered: report.production_triggered,
      };
      break;
    }
    case "strategy": {
      const strategy = buildProductionStrategy({ persist: true });
      delegated = "ProductionStrategyEngine";
      eventType = "STRATEGY_REFRESHED";
      stage = "strategy";
      response = {
        strategy_version: strategy.strategy_version,
        recommendation_count: strategy.recommendation_count,
        report_path: strategy.report_path,
        production_triggered: strategy.production_triggered,
      };
      break;
    }
    case "dashboard": {
      const dash = buildOperationsDashboard({ persist: true });
      delegated = "OperationsDashboard";
      eventType = "MISSION_CONTROL_REFRESHED";
      stage = "mission_control_refresh";
      response = {
        today_cycles: dash.today_cycles,
        founder_queue: dash.founder_queue.waiting,
        report_path: dash.report_path,
        read_only: dash.read_only,
      };
      break;
    }
    case "mission_control": {
      response = await refreshMissionControl(repoRoot);
      delegated = "FounderCommandCenter";
      eventType = "MISSION_CONTROL_REFRESHED";
      stage = "mission_control_refresh";
      break;
    }
    default: {
      const _e: never = opts.kind;
      throw new Error(`Unhandled refresh kind: ${_e}`);
    }
  }

  events.push(
    emit({
      event_type: eventType,
      trigger: "refresh",
      initiator,
      current_stage: stage,
      execution_path,
      delegated_subsystem: delegated,
      result: "ok",
      detail: `Refresh delegated to ${delegated}`,
      canonical_response: response,
      repoRoot,
      t0,
    }),
  );

  writeState({
    current_lifecycle_stage: "idle",
    current_orchestration_event: eventType,
    last_completed_lifecycle: stage,
  });

  return {
    ok: true,
    blocked: false,
    cancelled: false,
    reason: `Refreshed via ${delegated}`,
    events,
    production: null,
    refresh: response,
    state: readState(),
  };
}

/** Mark system started for autonomous / founder start without owning the loop. */
export function recordSystemStarted(opts?: {
  initiator?: string;
  repoRoot?: string;
  detail?: string;
}): OrchestrationEvent {
  const repoRoot = opts?.repoRoot ?? REPO;
  return emit({
    event_type: "SYSTEM_STARTED",
    trigger: "founder_action",
    initiator: opts?.initiator ?? "founder",
    current_stage: "startup",
    execution_path:
      "FounderAction→SystemOrchestrator→AutonomousProductionService→ProductionController",
    delegated_subsystem: "AutonomousProductionService",
    result: "ok",
    detail: opts?.detail ?? "Autonomous production start coordinated",
    repoRoot,
    t0: performance.now(),
  });
}

export function loadOrchestrationSurface(opts?: {
  repoRoot?: string;
  limit?: number;
}): OrchestrationSurface {
  const repoRoot = opts?.repoRoot ?? REPO;
  const limit = opts?.limit ?? 20;
  const hist = join(repoRoot, "SOS/07_LOGS/saios/system-orchestrator/history");
  const recent: OrchestrationEvent[] = [];
  if (existsSync(hist)) {
    const files = readdirSync(hist)
      .filter((n) => n.endsWith(".json"))
      .sort()
      .reverse()
      .slice(0, limit);
    for (const f of files) {
      try {
        recent.push(
          JSON.parse(readFileSync(join(hist, f), "utf8")) as OrchestrationEvent,
        );
      } catch {
        /* skip */
      }
    }
  }
  return {
    schema_version: 1,
    agent: "226",
    generated_at: new Date().toISOString(),
    state: readState(),
    recent_events: recent,
    live: false,
    publication_allowed: false,
    founder_approval_required: true,
    production_entry: "ProductionController",
    coordination_only: true,
    owns_production: false,
    owns_business_logic: false,
  };
}
