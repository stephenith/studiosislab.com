/**
 * Canonical Autonomous Production Service — Agent #214.
 * Long-running orchestrator only. Never bypasses ProductionController.
 * Flow: decide → (skip | runProduction) → sleep → repeat.
 */
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import {
  DEFAULT_BATCH_SIZE,
  DEFAULT_MAX_OPENAI_PER_BATCH,
  DEFAULT_QUEUE_MAX,
} from "./BatchRunner.js";
import {
  evaluateProductionHealth,
  type ProductionHealthResult,
  type ProductionHealthSimulate,
} from "./ProductionHealthGate.js";
import {
  runProduction,
  type ProductionControllerOptions,
  type ProductionExecutionResult,
} from "./ProductionController.js";
import { listCandidateManifests } from "./CandidateStore.js";
import { countFounderReviewWaiting } from "../founder-review/FounderReviewProjection.js";
import {
  evaluateAdaptiveSchedule,
  type AdaptiveScheduleResult,
  type ScheduleDecision,
} from "./AdaptiveSchedulingPolicy.js";

const REPO = resolve(import.meta.dirname, "../../../..");
const CYCLE_LOG = join(REPO, "SOS/07_LOGS/saios/first-production-cycle");
export const AUTONOMOUS_LOG_ROOT = join(CYCLE_LOG, "autonomous");

/** Default sleep between ticks: 30 minutes */
export const DEFAULT_AUTONOMOUS_INTERVAL_MS = 30 * 60 * 1000;

export type AutonomousServiceState =
  | "stopped"
  | "starting"
  | "running"
  | "stopping"
  | "busy";

export type AutonomousSkipReason =
  | "health_unhealthy"
  | "queue_capacity"
  | "openai_batch_cap"
  | "registry_inaccessible"
  | "live_refused"
  | "stop_requested";

export type AutonomousDecision = {
  should_produce: boolean;
  skip_reason: AutonomousSkipReason | null;
  health: ProductionHealthResult | null;
  queue_waiting: number;
  queue_max: number;
  openai_cap_available: boolean;
  registry_ok: boolean;
  checked_at: string;
  detail: string;
};

export type AutonomousHistoryEvent = {
  at: string;
  type:
    | "session_start"
    | "session_stop"
    | "decision_skip"
    | "decision_produce"
    | "controller_complete"
    | "sleep"
    | "error";
  skip_reason?: AutonomousSkipReason | null;
  execution_id?: string | null;
  sleep_ms?: number;
  detail?: string;
  health_status?: string | null;
  failed_checks?: string[];
};

export type AutonomousStatus = {
  state: AutonomousServiceState;
  session_id: string | null;
  running: boolean;
  stopping: boolean;
  busy: boolean;
  iterations: number;
  last_decision: AutonomousDecision | null;
  last_execution_id: string | null;
  interval_ms: number;
  adaptive_scheduling_enabled: boolean;
  scheduling: {
    decision: ScheduleDecision | null;
    next_interval_ms: number | null;
    next_evaluation_at: string | null;
    reason_codes: string[];
    cooldown_active: boolean;
    consecutive_fast_cycles: number;
    policy_version: string | null;
  } | null;
  publication_allowed: false;
  live: false;
  updated_at: string;
};

export type AutonomousServiceOptions = {
  interval_ms?: number;
  /**
   * When true, sleep interval comes from AdaptiveSchedulingPolicy.
   * Default: true only when interval_ms is omitted (explicit interval = fixed compat).
   */
  adaptive_scheduling_enabled?: boolean;
  batch_size?: number;
  queue_max?: number;
  max_openai_per_batch?: number;
  force_mock?: boolean;
  select_target?: boolean;
  /** Bound loop for verify / maintenance */
  max_iterations?: number;
  health_simulate?: ProductionHealthSimulate;
  controller?: ProductionControllerOptions;
  /** Injectable sleep (verify). Must honor AbortSignal when possible. */
  sleep?: (ms: number, signal: AbortSignal) => Promise<void>;
  /** Injectable ProductionController entry (defaults to runProduction). */
  runProductionFn?: (
    opts?: ProductionControllerOptions,
  ) => Promise<ProductionExecutionResult>;
  /** Injectable schedule evaluator (verify). */
  evaluateScheduleFn?: typeof evaluateAdaptiveSchedule;
};

function atomicWriteJson(path: string, data: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  const tmp = `${path}.${process.pid}.${Date.now()}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  renameSync(tmp, path);
}

function appendJsonl(path: string, event: AutonomousHistoryEvent): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(event)}\n`, {
    encoding: "utf8",
    flag: "a",
  });
}

function openaiEligible(): boolean {
  const key =
    process.env.OPENAI_API_KEY?.trim() ||
    process.env.SOS_OPENAI_API_KEY?.trim();
  if (!key) return false;
  return (
    process.env.SOS_AI_FOUNDER_OPENAI_BOUNDED === "1" ||
    process.env.SOS_AI_FOUNDER_OPENAI_ONE_TEST === "1"
  );
}

function defaultSleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolveSleep, reject) => {
    if (signal.aborted) {
      resolveSleep();
      return;
    }
    const t = setTimeout(() => resolveSleep(), ms);
    const onAbort = () => {
      clearTimeout(t);
      resolveSleep();
    };
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

export function allocateAutonomousSessionId(now: Date = new Date()): string {
  mkdirSync(AUTONOMOUS_LOG_ROOT, { recursive: true });
  const day = now.toISOString().slice(0, 10).replace(/-/g, "");
  const prefix = `auto-${day}-`;
  let max = 0;
  const sessions = join(AUTONOMOUS_LOG_ROOT, "sessions");
  mkdirSync(sessions, { recursive: true });
  for (const name of readdirSync(sessions)) {
    if (!name.startsWith(prefix)) continue;
    const n = Number(name.slice(prefix.length));
    if (Number.isFinite(n) && n > max) max = n;
  }
  return `${prefix}${String(max + 1).padStart(3, "0")}`;
}

/**
 * Pre-production decision (does not call BatchRunner / Controller).
 */
export function evaluateAutonomousProductionDecision(opts: {
  cycleLog?: string;
  queue_max: number;
  max_openai_per_batch: number;
  force_mock?: boolean;
  health_simulate?: ProductionHealthSimulate;
}): AutonomousDecision {
  const checked_at = new Date().toISOString();
  const cycleLog = opts.cycleLog ?? CYCLE_LOG;
  const queue_max = opts.queue_max;

  if (process.env.SOS_AIOS_LIVE === "1") {
    return {
      should_produce: false,
      skip_reason: "live_refused",
      health: null,
      queue_waiting: -1,
      queue_max,
      openai_cap_available: false,
      registry_ok: false,
      checked_at,
      detail: "SOS_AIOS_LIVE=1 — autonomous production refused",
    };
  }

  let registry_ok = true;
  try {
    listCandidateManifests(cycleLog);
  } catch (e) {
    registry_ok = false;
    return {
      should_produce: false,
      skip_reason: "registry_inaccessible",
      health: null,
      queue_waiting: -1,
      queue_max,
      openai_cap_available: false,
      registry_ok: false,
      checked_at,
      detail: e instanceof Error ? e.message : String(e),
    };
  }

  const health = evaluateProductionHealth({
    cycleLog,
    queue_max,
    persist: true,
    simulate: opts.health_simulate,
  });

  if (health.status !== "HEALTHY") {
    return {
      should_produce: false,
      skip_reason: "health_unhealthy",
      health,
      queue_waiting: health.queue_waiting,
      queue_max,
      openai_cap_available: true,
      registry_ok,
      checked_at,
      detail: `Health UNHEALTHY: ${health.failed_checks.join(", ")}`,
    };
  }

  const queue_waiting = countFounderReviewWaiting(REPO);
  if (queue_waiting >= queue_max) {
    return {
      should_produce: false,
      skip_reason: "queue_capacity",
      health,
      queue_waiting,
      queue_max,
      openai_cap_available: true,
      registry_ok,
      checked_at,
      detail: `waiting=${queue_waiting} >= queue_max=${queue_max}`,
    };
  }

  const mock = Boolean(opts.force_mock) || !openaiEligible();
  const openai_cap_available =
    mock || opts.max_openai_per_batch > 0;
  if (!openai_cap_available) {
    return {
      should_produce: false,
      skip_reason: "openai_batch_cap",
      health,
      queue_waiting,
      queue_max,
      openai_cap_available: false,
      registry_ok,
      checked_at,
      detail: "OpenAI eligible but max_openai_per_batch=0",
    };
  }

  return {
    should_produce: true,
    skip_reason: null,
    health,
    queue_waiting,
    queue_max,
    openai_cap_available: true,
    registry_ok: true,
    checked_at,
    detail: "decision=produce",
  };
}

export class AutonomousProductionService {
  private state: AutonomousServiceState = "stopped";
  private session_id: string | null = null;
  private stopping = false;
  private busy = false;
  private iterations = 0;
  private last_decision: AutonomousDecision | null = null;
  private last_execution_id: string | null = null;
  private interval_ms = DEFAULT_AUTONOMOUS_INTERVAL_MS;
  private adaptive_scheduling_enabled = false;
  private last_schedule: AdaptiveScheduleResult | null = null;
  private next_evaluation_at: string | null = null;
  private loopPromise: Promise<void> | null = null;
  private abort: AbortController | null = null;
  private historyPath: string | null = null;
  private sessionDir: string | null = null;
  private opts: AutonomousServiceOptions = {};

  start(opts?: AutonomousServiceOptions): AutonomousStatus {
    if (this.state === "running" || this.state === "busy" || this.state === "starting") {
      return this.status();
    }
    if (process.env.SOS_AIOS_LIVE === "1") {
      throw new Error("AutonomousProductionService refuses SOS_AIOS_LIVE=1");
    }

    this.opts = { ...(opts ?? {}) };
    if (this.opts.force_mock) {
      delete process.env.SOS_AI_FOUNDER_OPENAI_ONE_TEST;
      delete process.env.OPENAI_API_KEY;
      delete process.env.SOS_OPENAI_API_KEY;
    }

    const intervalExplicit = opts?.interval_ms != null;
    this.adaptive_scheduling_enabled =
      opts?.adaptive_scheduling_enabled ?? !intervalExplicit;

    this.interval_ms = Math.max(
      1,
      Math.floor(opts?.interval_ms ?? DEFAULT_AUTONOMOUS_INTERVAL_MS),
    );
    this.stopping = false;
    this.busy = false;
    this.iterations = 0;
    this.last_decision = null;
    this.last_execution_id = null;
    this.last_schedule = null;
    this.next_evaluation_at = null;
    this.state = "starting";
    this.session_id = allocateAutonomousSessionId();
    this.sessionDir = join(AUTONOMOUS_LOG_ROOT, "sessions", this.session_id);
    mkdirSync(this.sessionDir, { recursive: true });
    this.historyPath = join(this.sessionDir, "history.jsonl");
    this.abort = new AbortController();

    this.record({
      at: new Date().toISOString(),
      type: "session_start",
      detail: `interval_ms=${this.interval_ms} adaptive=${this.adaptive_scheduling_enabled}`,
    });
    this.persistStatus();

    this.state = "running";
    this.loopPromise = this.loop().finally(() => {
      this.state = "stopped";
      this.busy = false;
      this.stopping = false;
      this.persistStatus();
      this.loopPromise = null;
    });

    this.persistStatus();
    return this.status();
  }

  /**
   * Request stop. Waits for in-flight ProductionController to finish.
   * Does not interrupt a running candidate / controller execution.
   */
  async stop(): Promise<AutonomousStatus> {
    if (this.state === "stopped" && !this.loopPromise) {
      return this.status();
    }
    this.stopping = true;
    this.state = this.busy ? "busy" : "stopping";
    this.abort?.abort();
    this.persistStatus();
    if (this.loopPromise) {
      await this.loopPromise;
    }
    this.record({
      at: new Date().toISOString(),
      type: "session_stop",
      detail: "graceful stop complete",
      execution_id: this.last_execution_id,
    });
    this.persistStatus();
    return this.status();
  }

  status(): AutonomousStatus {
    const st: AutonomousStatus = {
      state: this.busy ? "busy" : this.state,
      session_id: this.session_id,
      running: this.state === "running" || this.state === "busy" || this.state === "stopping",
      stopping: this.stopping,
      busy: this.busy,
      iterations: this.iterations,
      last_decision: this.last_decision,
      last_execution_id: this.last_execution_id,
      interval_ms: this.interval_ms,
      adaptive_scheduling_enabled: this.adaptive_scheduling_enabled,
      scheduling: this.adaptive_scheduling_enabled
        ? {
            decision: this.last_schedule?.decision ?? null,
            next_interval_ms: this.last_schedule?.next_interval_ms ?? null,
            next_evaluation_at: this.next_evaluation_at,
            reason_codes: this.last_schedule?.reason_codes ?? [],
            cooldown_active: this.last_schedule?.cooldown_state.active ?? false,
            consecutive_fast_cycles:
              this.last_schedule?.fast_cycle_state.consecutive_fast_cycles ?? 0,
            policy_version: this.last_schedule?.policy_version ?? null,
          }
        : null,
      publication_allowed: false,
      live: false,
      updated_at: new Date().toISOString(),
    };
    return st;
  }

  private record(event: AutonomousHistoryEvent): void {
    if (!this.historyPath) return;
    appendJsonl(this.historyPath, event);
    // Flat dual-write of latest events index
    try {
      const idx = join(AUTONOMOUS_LOG_ROOT, "latest-history-event.json");
      atomicWriteJson(idx, { session_id: this.session_id, ...event });
    } catch {
      /* ignore */
    }
  }

  private persistStatus(): void {
    const st = this.status();
    atomicWriteJson(join(AUTONOMOUS_LOG_ROOT, "status.json"), st);
    if (this.sessionDir) {
      atomicWriteJson(join(this.sessionDir, "status.json"), st);
      atomicWriteJson(join(CYCLE_LOG, "autonomous-status.json"), st);
    }
    if (this.session_id) {
      atomicWriteJson(join(AUTONOMOUS_LOG_ROOT, "latest-session.json"), {
        session_id: this.session_id,
        session_directory: this.sessionDir
          ? relative(REPO, this.sessionDir).replace(/\\/g, "/")
          : null,
        history_path: this.historyPath
          ? relative(REPO, this.historyPath).replace(/\\/g, "/")
          : null,
        updated_at: st.updated_at,
        state: st.state,
        publication_allowed: false,
      });
    }
  }

  private async loop(): Promise<void> {
    const queue_max = Math.max(
      1,
      Math.floor(this.opts.queue_max ?? DEFAULT_QUEUE_MAX),
    );
    const max_openai = Math.max(
      0,
      Math.floor(
        this.opts.max_openai_per_batch ?? DEFAULT_MAX_OPENAI_PER_BATCH,
      ),
    );
    const batch_size = Math.max(
      1,
      Math.floor(this.opts.batch_size ?? DEFAULT_BATCH_SIZE),
    );
    const sleepFn = this.opts.sleep ?? defaultSleep;
    const produceFn = this.opts.runProductionFn ?? runProduction;
    const maxIter = this.opts.max_iterations;

    while (!this.stopping) {
      if (maxIter != null && this.iterations >= maxIter) {
        break;
      }
      this.iterations += 1;

      const decision = evaluateAutonomousProductionDecision({
        cycleLog: CYCLE_LOG,
        queue_max,
        max_openai_per_batch: max_openai,
        force_mock: this.opts.force_mock,
        health_simulate: this.opts.health_simulate,
      });
      this.last_decision = decision;
      this.persistStatus();

      if (!decision.should_produce) {
        this.record({
          at: new Date().toISOString(),
          type: "decision_skip",
          skip_reason: decision.skip_reason,
          detail: decision.detail,
          health_status: decision.health?.status ?? null,
          failed_checks: decision.health?.failed_checks ?? [],
        });
      } else {
        this.record({
          at: new Date().toISOString(),
          type: "decision_produce",
          detail: decision.detail,
          health_status: decision.health?.status ?? null,
        });
        this.busy = true;
        this.state = "busy";
        this.persistStatus();
        try {
          const result = await produceFn({
            batch_size,
            queue_max,
            max_openai_per_batch: max_openai,
            force_mock: this.opts.force_mock,
            select_target: this.opts.select_target !== false,
            ...this.opts.controller,
            // Decision already enforced health; controller still runs its own gate unless simulated skip path
          });
          this.last_execution_id = result.execution_id;
          this.record({
            at: new Date().toISOString(),
            type: "controller_complete",
            execution_id: result.execution_id,
            detail: `stop_reason=${result.stop_reason} templates=${result.candidate_count}`,
            health_status: result.health.status,
          });
        } catch (e) {
          this.record({
            at: new Date().toISOString(),
            type: "error",
            detail: e instanceof Error ? e.message : String(e),
          });
        } finally {
          this.busy = false;
          this.state = this.stopping ? "stopping" : "running";
          this.persistStatus();
        }
      }

      if (this.stopping) break;
      if (maxIter != null && this.iterations >= maxIter) break;

      let sleepMs = this.interval_ms;
      if (this.adaptive_scheduling_enabled) {
        const evalFn =
          this.opts.evaluateScheduleFn ?? evaluateAdaptiveSchedule;
        const schedule = evalFn({
          configured_interval_ms: this.interval_ms,
          persist: true,
          persist_state: true,
          signal_overrides: {
            autonomous_skip_reason: decision.should_produce
              ? null
              : decision.skip_reason,
            founder_queue_waiting: decision.queue_waiting,
            founder_queue_capacity: decision.queue_max,
            system_health_status: decision.health?.status ?? null,
            system_health_available: Boolean(decision.health),
          },
        });
        this.last_schedule = schedule;
        sleepMs = schedule.next_interval_ms;
        this.interval_ms = sleepMs;
        this.next_evaluation_at = new Date(
          Date.now() + sleepMs,
        ).toISOString();
      } else {
        this.last_schedule = null;
        this.next_evaluation_at = new Date(
          Date.now() + sleepMs,
        ).toISOString();
      }

      this.record({
        at: new Date().toISOString(),
        type: "sleep",
        sleep_ms: sleepMs,
        detail: this.adaptive_scheduling_enabled
          ? `adaptive sleep ${sleepMs}ms decision=${this.last_schedule?.decision}`
          : `sleep ${sleepMs}ms`,
      });
      this.persistStatus();
      await sleepFn(sleepMs, this.abort?.signal ?? new AbortController().signal);
    }

    this.state = "stopped";
    this.persistStatus();
  }
}

/** Singleton helper for CLI status reads */
export function readAutonomousStatusFile(): AutonomousStatus | null {
  const p = join(AUTONOMOUS_LOG_ROOT, "status.json");
  if (!existsSync(p)) return null;
  try {
    return JSON.parse(readFileSync(p, "utf8")) as AutonomousStatus;
  } catch {
    return null;
  }
}

export function readAutonomousHistory(
  sessionId: string,
): AutonomousHistoryEvent[] {
  const path = join(
    AUTONOMOUS_LOG_ROOT,
    "sessions",
    sessionId,
    "history.jsonl",
  );
  if (!existsSync(path)) return [];
  return readFileSync(path, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as AutonomousHistoryEvent);
}
