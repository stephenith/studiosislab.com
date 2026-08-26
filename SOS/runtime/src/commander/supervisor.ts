import { spawn, type ChildProcess } from "node:child_process";
import { createWriteStream, existsSync } from "node:fs";
import { mkdir, writeFile, readFile, unlink } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { RuntimeConfig } from "../config.js";
import { loadConfig } from "../config.js";
import { getCommanderPaths } from "./paths.js";
import { COMMANDER_WORKERS, STALE_STDOUT_HEARTBEAT_MS } from "./workers.js";
import { buildHealthSnapshot, writeHealth } from "./health.js";
import { maybeAlertWorkerCrash } from "./alerts.js";
import { recoverStaleLocks } from "./lock-recovery.js";
import { readAgentHeartbeats } from "./agent-heartbeat.js";
import { monitorWorkerHeartbeats } from "./heartbeat-monitor.js";
import { runStartupRecovery } from "./startup-recovery.js";
import { drainTelegramBacklog, reconcileTelegramPollers } from "./telegram-recovery.js";
import { probeTelegramLiveness } from "./telegram-liveness.js";
import { maybeAlertTelegramRestartFailed } from "./alerts.js";
import { gracefulStopWorkers } from "./graceful-stop.js";
import {
  appendRestartEvent,
  createCommanderState,
  loadCommanderState,
  saveCommanderState,
  type CommanderPersistedState,
} from "./persisted-state.js";
import type { WorkerHealth, WorkerStatus } from "./types.js";
import {
  classifyWorkerExit,
  formatWorkerExitError,
  type WorkerKillReason,
} from "./worker-exit.js";
import {
  reconcileWorkerProcessesBeforeStart,
  ensureWorkerSlotBeforeSpawn,
  verifyWorkersStopped,
  killProcessTree,
  WORKER_SCRIPT_MARKERS,
  type RuntimeWorkerId,
  type ProcessReconciliationReport,
} from "./process-table.js";
import { clearStaleInstanceLock, readInstanceLock } from "../runtime/single-instance.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const RUNTIME_ROOT = join(__dirname, "../..");
const TSX_BIN = join(RUNTIME_ROOT, "node_modules", ".bin", "tsx");
const BOOTSTRAP = join(RUNTIME_ROOT, "src", "bootstrap-env.ts");

const RESTART_DELAY_MS = parseInt(process.env.SOS_COMMANDER_RESTART_MS ?? "2000", 10);
const HEALTH_INTERVAL_MS = parseInt(process.env.SOS_COMMANDER_HEALTH_MS ?? "10000", 10);
const START_STAGGER_MS = parseInt(process.env.SOS_COMMANDER_START_STAGGER_MS ?? "500", 10);

type ManagedWorker = WorkerHealth & {
  script: string;
  args: string[];
  env: Record<string, string>;
  depends_on: string[];
  stale_after_ms: number;
  process: ChildProcess | null;
  log_path: string;
  restarting: boolean;
  kill_reason: WorkerKillReason | null;
};

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function createWorkerState(def: (typeof COMMANDER_WORKERS)[number]): ManagedWorker {
  return {
    id: def.id,
    name: def.name,
    script: def.script,
    args: def.args ?? [],
    env: def.env ?? {},
    depends_on: def.depends_on ?? [],
    stale_after_ms: def.stale_after_ms ?? STALE_STDOUT_HEARTBEAT_MS,
    status: "stopped",
    pid: null,
    started_at: null,
    last_heartbeat: null,
    crash_count: 0,
    restart_count: 0,
    last_exit_code: null,
    last_error: null,
    last_exit_reason: null,
    shutdown_reason: null,
    expected_exit: null,
    alerted: false,
    process: null,
    log_path: "",
    restarting: false,
    kill_reason: null,
  };
}

function isProcessAlive(pid: number | null): boolean {
  if (!pid) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export class CommanderSupervisor {
  private config: RuntimeConfig;
  private paths: ReturnType<typeof getCommanderPaths>;
  private workers: ManagedWorker[];
  private startedAt: string;
  private stopping = false;
  private shutdownPromise: Promise<void> | null = null;
  private healthTimer: ReturnType<typeof setInterval> | null = null;
  private persisted: CommanderPersistedState;
  private lockRecoverySummary: { developer_removed: number; qa_removed: number; at: string } | null =
    null;
  private startupRecovery: Awaited<ReturnType<typeof runStartupRecovery>> | null = null;
  private shutdownReason: string | null = null;
  private processReconciliation: ProcessReconciliationReport | null = null;
  private lastHeartbeatMonitor: Awaited<ReturnType<typeof monitorWorkerHeartbeats>> | null = null;
  private telegramBacklogDrain: Awaited<ReturnType<typeof drainTelegramBacklog>> | null = null;

  constructor(config?: RuntimeConfig) {
    this.config = config ?? loadConfig();
    this.paths = getCommanderPaths(this.config);
    this.startedAt = new Date().toISOString();
    this.workers = COMMANDER_WORKERS.map(createWorkerState);
    this.persisted = createCommanderState(this.startedAt);
  }

  async start(): Promise<void> {
    await mkdir(this.paths.logs, { recursive: true });
    await mkdir(this.paths.root, { recursive: true });

    const existingPid = await isCommanderRunning(this.paths);
    if (existingPid.running && existingPid.pid) {
      throw new Error(
        `Commander already running (pid ${existingPid.pid}). Stop it before starting another instance.`,
      );
    }
    if (existsSync(this.paths.pid)) {
      await unlink(this.paths.pid).catch(() => undefined);
    }

    await writeFile(this.paths.pid, String(process.pid), "utf8");

    const existing = await loadCommanderState(this.paths);
    if (existing) {
      this.persisted = existing;
      for (const worker of this.workers) {
        const stats = existing.worker_stats[worker.id];
        if (stats) {
          worker.crash_count = stats.crash_count;
          worker.restart_count = stats.restart_count;
        }
      }
    }

    const lockRecovery = await recoverStaleLocks(this.config);
    this.lockRecoverySummary = {
      developer_removed: lockRecovery.developer.removed,
      qa_removed: lockRecovery.qa.removed,
      at: new Date().toISOString(),
    };
    if (lockRecovery.total_removed > 0) {
      console.log(
        `[commander] lock recovery removed ${lockRecovery.total_removed} stale lock(s)`,
      );
    }

    this.startupRecovery = await runStartupRecovery(this.config);
    console.log("[commander] startup recovery complete", this.startupRecovery.pm.action);

    for (const workerId of Object.keys(WORKER_SCRIPT_MARKERS) as RuntimeWorkerId[]) {
      const cleared = await clearStaleInstanceLock(this.config, workerId);
      if (cleared.removed) {
        console.log(`[commander] cleared stale ${workerId} instance lock: ${cleared.reason}`);
      }
    }

    this.processReconciliation = await reconcileWorkerProcessesBeforeStart(RUNTIME_ROOT);
    if (this.processReconciliation.terminated.length > 0) {
      console.warn(
        `[commander] terminated ${this.processReconciliation.terminated.length} orphan worker process(es) before start`,
      );
      for (const proc of this.processReconciliation.terminated) {
        console.warn(`  - ${proc.worker_id} pid=${proc.pid} owner=${proc.owner}`);
      }
    }

    await reconcileTelegramPollers(this.config, null);
    this.telegramBacklogDrain = await drainTelegramBacklog(this.config);
    if (this.telegramBacklogDrain.drained > 0) {
      console.log(
        `[commander] drained ${this.telegramBacklogDrain.drained} pending Telegram update(s) at startup`,
      );
    } else if (
      this.telegramBacklogDrain.pending_before !== null
      && this.telegramBacklogDrain.pending_before > 0
    ) {
      console.log(
        `[commander] ${this.telegramBacklogDrain.pending_before} pending Telegram update(s) — poller will consume`,
      );
    }

    console.log(`[commander] starting supervisor pid=${process.pid}`);
    console.log(`[commander] health → ${this.paths.health}`);
    console.log(`[commander] logs → ${this.paths.logs}`);

    await this.startWorkersInOrder();

    this.healthTimer = setInterval(() => {
      void this.healthTick();
    }, HEALTH_INTERVAL_MS);

    await this.publishHealth();

    process.on("SIGINT", () => void this.stop("SIGINT"));
    process.on("SIGTERM", () => void this.stop("SIGTERM"));

    while (!this.stopping) {
      await sleep(1000);
      for (const worker of this.workers) {
        if (worker.status === "crashed" && !worker.restarting && !this.stopping) {
          void this.handleCrash(worker);
        }
      }
    }

    if (this.shutdownPromise) {
      await this.shutdownPromise;
    }
  }

  private async startWorkersInOrder(): Promise<void> {
    const started = new Set<string>();
    const pending = [...this.workers];

    while (pending.length > 0 && !this.stopping) {
      let progressed = false;
      for (let i = pending.length - 1; i >= 0; i--) {
        const worker = pending[i];
        const depsMet = worker.depends_on.every((d) => started.has(d));
        if (!depsMet) continue;

        await this.spawnWorker(worker);
        started.add(worker.id);
        pending.splice(i, 1);
        progressed = true;
        await sleep(START_STAGGER_MS);
      }

      if (!progressed) {
        const blocked = pending.shift();
        if (blocked) {
          console.warn(`[commander] starting ${blocked.id} without satisfied deps`);
          await this.spawnWorker(blocked);
          started.add(blocked.id);
        }
      }
    }
  }

  private async adoptLiveWorkerFromLock(worker: ManagedWorker): Promise<boolean> {
    const workerId = worker.id as RuntimeWorkerId;
    await clearStaleInstanceLock(this.config, workerId);
    const lock = await readInstanceLock(this.config, workerId);
    if (!lock.valid || !lock.record?.pid || !isProcessAlive(lock.record.pid)) {
      return false;
    }

    console.log(
      `[commander] adopting live ${worker.id} pid=${lock.record.pid} (instance lock, owner=${lock.record.owner})`,
    );
    worker.process = null;
    worker.pid = lock.record.pid;
    worker.status = "running";
    worker.last_heartbeat = lock.record.started_at;
    worker.restarting = false;
    worker.kill_reason = null;
    worker.expected_exit = null;
    worker.last_error = null;
    return true;
  }

  private async spawnWorker(worker: ManagedWorker): Promise<void> {
    if (worker.process && isProcessAlive(worker.pid)) {
      return;
    }

    if (await this.adoptLiveWorkerFromLock(worker)) {
      return;
    }

    const slot = await ensureWorkerSlotBeforeSpawn(worker.id as RuntimeWorkerId, worker.pid, RUNTIME_ROOT);
    if (slot.terminated.length > 0) {
      console.warn(
        `[commander] cleared ${slot.terminated.length} stale ${worker.id} process(es) before spawn`,
      );
    }

    const logPath = join(this.paths.logs, `${worker.id}.log`);
    worker.log_path = logPath;
    const logStream = createWriteStream(logPath, { flags: "a" });
    logStream.write(`\n--- spawn ${new Date().toISOString()} ---\n`);

    worker.status = "starting";
    worker.started_at = new Date().toISOString();
    worker.last_heartbeat = worker.started_at;
    worker.restarting = false;
    worker.kill_reason = null;
    worker.expected_exit = null;

    const child = spawn(
      TSX_BIN,
      ["--import", BOOTSTRAP, join(RUNTIME_ROOT, worker.script), ...worker.args],
      {
        cwd: RUNTIME_ROOT,
        env: {
          ...process.env,
          ...worker.env,
          SOS_PRODUCTION_WORKER: "true",
          SOS_COMMANDER_PID: String(process.pid),
        },
        stdio: ["ignore", "pipe", "pipe"],
      },
    );

    worker.process = child;
    worker.pid = child.pid ?? null;
    worker.status = "running";

    child.stdout?.on("data", (chunk: Buffer) => {
      worker.last_heartbeat = new Date().toISOString();
      logStream.write(chunk);
    });
    child.stderr?.on("data", (chunk: Buffer) => {
      worker.last_heartbeat = new Date().toISOString();
      logStream.write(chunk);
    });

    child.on("exit", (code, signal) => {
      void this.handleWorkerExit(worker, code, signal, logStream);
    });

    child.on("error", (err) => {
      worker.last_error = err.message;
      worker.last_exit_reason = "startup_failure";
      worker.expected_exit = false;
      worker.shutdown_reason = null;
      worker.crash_count += 1;
      worker.status = "crashed";
      console.error(`[commander] worker ${worker.id} error: ${err.message}`);
    });

    console.log(`[commander] started ${worker.id} pid=${child.pid} log=${logPath}`);
  }

  private async handleWorkerExit(
    worker: ManagedWorker,
    code: number | null,
    signal: NodeJS.Signals | null,
    logStream: ReturnType<typeof createWriteStream>,
  ): Promise<void> {
    const classification = classifyWorkerExit(code, signal, {
      commanderStopping: this.stopping,
      killReason: worker.kill_reason,
    });
    worker.kill_reason = null;
    worker.last_exit_code = code;
    worker.last_exit_reason = classification.last_exit_reason;
    worker.expected_exit = classification.expected;
    worker.shutdown_reason = classification.shutdown_reason ?? this.shutdownReason;
    worker.pid = null;
    worker.process = null;
    logStream.write(
      `\n--- exit code=${code} signal=${signal ?? "none"} expected=${classification.expected} ${new Date().toISOString()} ---\n`,
    );
    logStream.end();

    worker.last_error = formatWorkerExitError(code, signal, classification);

    if (code === 1 && !this.stopping && (await this.adoptLiveWorkerFromLock(worker))) {
      worker.status = "running";
      worker.expected_exit = true;
      worker.last_exit_reason = "instance_lock_held_by_live_worker";
      console.log(
        `[commander] worker ${worker.id} spawn skipped — live instance adopted (no crash)`,
      );
      return;
    }

    if (!classification.isCrash) {
      if (classification.shouldRestart && !this.stopping) {
        worker.status = "stopped";
        console.log(
          `[commander] worker ${worker.id} expected exit (${worker.last_exit_reason}) — restarting`,
        );
        void this.handleExpectedRestart(worker);
      } else {
        worker.status = "graceful_shutdown";
        console.log(
          `[commander] worker ${worker.id} graceful shutdown (${worker.last_exit_reason})`,
        );
      }
      return;
    }

    worker.crash_count += 1;
    worker.status = "crashed";
    console.error(`[commander] worker ${worker.id} crashed: ${worker.last_error}`);
  }

  private async handleExpectedRestart(worker: ManagedWorker): Promise<void> {
    if (worker.restarting || this.stopping) return;
    worker.restarting = true;
    await sleep(RESTART_DELAY_MS);
    if (this.stopping) {
      worker.restarting = false;
      return;
    }
    await this.spawnWorker(worker);
    worker.restarting = false;
    await this.publishHealth();
  }

  private async handleCrash(worker: ManagedWorker): Promise<void> {
    if (worker.restarting) return;

    if (await this.adoptLiveWorkerFromLock(worker)) {
      await this.publishHealth();
      return;
    }

    worker.restarting = true;
    worker.status = "restarting";

    const alerted = await maybeAlertWorkerCrash(this.config, worker);
    if (alerted) {
      worker.alerted = true;
      console.error(`[commander] Telegram alert sent for ${worker.id}`);
    }

    await appendRestartEvent(this.paths, {
      timestamp: new Date().toISOString(),
      worker_id: worker.id,
      reason: worker.last_error ?? "unknown",
      exit_code: worker.last_exit_code,
      restart_count: worker.restart_count + 1,
      crash_count: worker.crash_count,
      expected: false,
    });

    await sleep(RESTART_DELAY_MS);
    if (this.stopping) {
      worker.restarting = false;
      return;
    }

    worker.restart_count += 1;
    this.persisted.worker_stats[worker.id] = {
      crash_count: worker.crash_count,
      restart_count: worker.restart_count,
      last_restart_at: new Date().toISOString(),
    };
    await saveCommanderState(this.paths, this.persisted);

    await this.spawnWorker(worker);
    worker.restarting = false;
    await this.publishHealth();
  }

  private async healthTick(): Promise<void> {
    await this.checkStaleWorkers();
    await this.ensureTelegramPollerHealthy();
    await this.publishHealth();
    await saveCommanderState(this.paths, this.persisted);
  }

  private async ensureTelegramPollerHealthy(): Promise<void> {
    if (this.stopping) return;

    const liveness = await probeTelegramLiveness(this.config);
    const telegramWorker = this.workers.find((w) => w.id === "telegram");
    if (!telegramWorker) return;

    if (liveness.telegram_conflict && liveness.poller_process_count > 1) {
      await reconcileTelegramPollers(this.config, telegramWorker.pid ?? liveness.poller_pid);
    }

    const processAlive = Boolean(telegramWorker.pid && isProcessAlive(telegramWorker.pid));
    const shouldBeRunning =
      telegramWorker.status === "running"
      || telegramWorker.status === "starting"
      || telegramWorker.status === "restarting";

    if (shouldBeRunning && !processAlive && !telegramWorker.restarting) {
      telegramWorker.status = "crashed";
      telegramWorker.last_error = "Telegram poller process not alive";
      void this.handleCrash(telegramWorker);
      return;
    }

    if (
      shouldBeRunning
      && processAlive
      && !liveness.poller_alive
      && !telegramWorker.restarting
    ) {
      telegramWorker.status = "crashed";
      telegramWorker.last_error =
        `Telegram poller heartbeat stale (${liveness.heartbeat_age_ms ?? "unknown"}ms)`;
      if (telegramWorker.pid) {
        telegramWorker.kill_reason = "stale_heartbeat";
        killProcessTree(telegramWorker.pid);
      }
      void this.handleCrash(telegramWorker);
      return;
    }

    if (
      telegramWorker.restart_count >= 5
      && !liveness.poller_alive
      && !telegramWorker.alerted
    ) {
      const alerted = await maybeAlertTelegramRestartFailed(this.config, telegramWorker);
      if (alerted) telegramWorker.alerted = true;
    }
  }

  private async checkStaleWorkers(): Promise<void> {
    if (this.stopping) return;

    const report = await monitorWorkerHeartbeats(this.config);
    this.lastHeartbeatMonitor = report;

    for (const hb of report.workers) {
      if (hb.level === "healthy" || hb.level === "late") continue;

      console.warn(
        `[commander] heartbeat ${hb.worker_id} level=${hb.level} age_ms=${hb.age_ms} ` +
          `busy=${hb.busy} busy_duration_ms=${hb.busy_duration_ms} phase=${hb.phase} label=${hb.busy_label}`,
      );
    }

    for (const hb of report.workers) {
      if (!hb.restart_recommended) continue;

      const worker = this.workers.find((w) => w.id === hb.worker_id);
      if (!worker || worker.status !== "running" || !worker.pid) continue;

      console.error(
        `[commander] worker ${hb.worker_id} frozen (age_ms=${hb.age_ms}) — terminating process tree`,
      );
      worker.kill_reason = "stale_heartbeat";
      worker.last_error = `Frozen heartbeat — no pulse for ${hb.age_ms}ms (phase=${hb.phase}, busy=${hb.busy})`;
      killProcessTree(worker.pid);
      await sleep(1000);
      if (worker.pid && isProcessAlive(worker.pid)) {
        killProcessTree(worker.pid);
      }
    }
  }

  private async publishHealth(): Promise<void> {
    const heartbeats = await readAgentHeartbeats(this.config, STALE_STDOUT_HEARTBEAT_MS);
    let restartHistoryCount = 0;
    const historyPath = join(this.paths.root, "restart-history.jsonl");
    if (existsSync(historyPath)) {
      const raw = await readFile(historyPath, "utf8");
      restartHistoryCount = raw.split("\n").filter(Boolean).length;
    }

    const snapshot = await buildHealthSnapshot(
      process.pid,
      this.startedAt,
      this.workers.map((w) => ({
        id: w.id,
        name: w.name,
        status: w.status,
        pid: w.pid,
        started_at: w.started_at,
        last_heartbeat: w.last_heartbeat,
        crash_count: w.crash_count,
        restart_count: w.restart_count,
        last_exit_code: w.last_exit_code,
        last_error: w.last_error,
        last_exit_reason: w.last_exit_reason,
        shutdown_reason: w.shutdown_reason,
        expected_exit: w.expected_exit,
        alerted: w.alerted,
      })),
      this.stopping ? "stopping" : "running",
      this.config,
    );

    snapshot.shutdown_reason = this.shutdownReason;

    snapshot.agent_heartbeats = heartbeats;
    snapshot.restart_history_count = restartHistoryCount;
    if (this.lockRecoverySummary) {
      snapshot.lock_recovery = this.lockRecoverySummary;
    }
    if (this.startupRecovery) {
      (snapshot as Record<string, unknown>).startup_recovery = this.startupRecovery;
    }
    if (this.processReconciliation) {
      (snapshot as Record<string, unknown>).process_reconciliation = this.processReconciliation;
    }
    if (this.lastHeartbeatMonitor) {
      snapshot.heartbeat_monitor = this.lastHeartbeatMonitor;
      snapshot.instance_health =
        this.lastHeartbeatMonitor.frozen_workers.length > 0
        || (snapshot.instance_health === "unhealthy")
          ? "unhealthy"
          : this.lastHeartbeatMonitor.unhealthy_workers.length > 0
            ? "degraded"
            : snapshot.instance_health ?? "healthy";
    }
    if (this.telegramBacklogDrain) {
      (snapshot as Record<string, unknown>).telegram_backlog_drain = this.telegramBacklogDrain;
    }

    try {
      const telegramLiveness = await probeTelegramLiveness(this.config);
      snapshot.commander_alive = true;
      snapshot.supervisor_alive = true;
      snapshot.telegram_liveness = {
        commander_alive: telegramLiveness.commander_alive,
        supervisor_alive: telegramLiveness.supervisor_alive,
        telegram_alive: telegramLiveness.telegram_alive,
        poller_alive: telegramLiveness.poller_alive,
        last_poll: telegramLiveness.last_poll,
        last_successful_update: telegramLiveness.last_successful_update,
        last_update_id: telegramLiveness.last_update_id,
        pending_update_count: telegramLiveness.pending_update_count,
        telegram_conflict: telegramLiveness.telegram_conflict,
        poller_pid: telegramLiveness.poller_pid,
        poller_process_count: telegramLiveness.poller_process_count,
        heartbeat_age_ms: telegramLiveness.heartbeat_age_ms,
        last_poll_error: telegramLiveness.last_poll_error,
        polling_mode: telegramLiveness.polling_mode,
        status: telegramLiveness.status,
      };
    } catch {
      // best-effort telegram liveness
    }

    await writeHealth(this.paths, snapshot);
  }

  async stop(reason = "manual"): Promise<void> {
    if (this.shutdownPromise) return this.shutdownPromise;
    this.stopping = true;
    this.shutdownPromise = this.runStop(reason);
    return this.shutdownPromise;
  }

  private async runStop(reason: string): Promise<void> {
    this.shutdownReason = reason;
    console.log(`[commander] graceful shutdown (${reason})...`);

    if (this.healthTimer) {
      clearInterval(this.healthTimer);
      this.healthTimer = null;
    }

    const stopReport = await gracefulStopWorkers(
      this.config,
      this.workers.map((w) => ({ id: w.id, pid: w.pid, process: w.process })),
      reason,
    );

    const processVerification = await verifyWorkersStopped(RUNTIME_ROOT, { forceTerminate: true });
    if (!processVerification.all_clear) {
      console.warn(
        `[commander] worker processes still present after graceful stop: ${processVerification.remaining.length}`,
      );
    }

    for (const w of this.workers) {
      w.status = "graceful_shutdown";
      w.expected_exit = true;
      w.shutdown_reason = reason;
      if (!w.last_exit_reason) {
        w.last_exit_reason = `graceful_shutdown (${reason})`;
      }
      w.pid = null;
      w.process = null;
    }

    this.persisted.worker_stats = Object.fromEntries(
      this.workers.map((w) => [
        w.id,
        {
          crash_count: w.crash_count,
          restart_count: w.restart_count,
          last_restart_at: this.persisted.worker_stats[w.id]?.last_restart_at ?? null,
        },
      ]),
    );

    await this.publishHealth();
    const final = await buildHealthSnapshot(
      process.pid,
      this.startedAt,
      this.workers.map((w) => ({
        ...w,
        status: "graceful_shutdown" as WorkerStatus,
        pid: null,
      })),
      "stopped",
      this.config,
    );
    final.shutdown_reason = reason;
    (final as Record<string, unknown>).graceful_stop = stopReport;
    (final as Record<string, unknown>).process_verification = processVerification;
    await writeHealth(this.paths, final);
    await saveCommanderState(this.paths, this.persisted);

    if (existsSync(this.paths.pid)) {
      await unlink(this.paths.pid).catch(() => undefined);
    }

    console.log("[commander] stopped gracefully");
  }
}

export async function readCommanderHealth(
  paths: ReturnType<typeof getCommanderPaths>,
): Promise<Record<string, unknown> | null> {
  if (!existsSync(paths.health)) return null;
  return JSON.parse(await readFile(paths.health, "utf8")) as Record<string, unknown>;
}

export async function isCommanderRunning(
  paths: ReturnType<typeof getCommanderPaths>,
): Promise<{ running: boolean; pid: number | null }> {
  if (!existsSync(paths.pid)) return { running: false, pid: null };
  const pid = parseInt(await readFile(paths.pid, "utf8"), 10);
  if (Number.isNaN(pid)) return { running: false, pid: null };
  try {
    process.kill(pid, 0);
    return { running: true, pid };
  } catch {
    return { running: false, pid };
  }
}

export async function stopCommanderByPid(
  paths: ReturnType<typeof getCommanderPaths>,
): Promise<boolean> {
  const { running, pid } = await isCommanderRunning(paths);
  if (!running || !pid) return false;
  process.kill(pid, "SIGTERM");
  return true;
}

/** Kill a managed worker process for crash-recovery testing. Commander will restart it. */
export function killWorkerForTest(
  health: Record<string, unknown>,
  workerId: string,
): { killed: boolean; pid: number | null; reason?: string } {
  const workers = health.workers as Array<{ id: string; pid: number | null; status: string }> | undefined;
  const worker = workers?.find((w) => w.id === workerId);
  if (!worker?.pid) {
    return { killed: false, pid: null, reason: `Worker ${workerId} has no pid` };
  }
  try {
    process.kill(worker.pid, "SIGKILL");
    return { killed: true, pid: worker.pid };
  } catch (e) {
    return {
      killed: false,
      pid: worker.pid,
      reason: e instanceof Error ? e.message : String(e),
    };
  }
}
