import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import type { RuntimePersistedState, RuntimeStatus } from "./runtime-types.js";
import { resolveRuntimePaths } from "./runtime-paths.js";

const DEFAULT_STATE = (startedAt: string): RuntimePersistedState => ({
  status: "starting",
  started_at: startedAt,
  updated_at: startedAt,
  uptime_ms: 0,
  cycle_count: 0,
  jobs_completed: 0,
  jobs_running: 0,
  jobs_queued: 0,
  workers_online: 0,
  workers_busy: 0,
  last_cycle_at: null,
  last_errors: [],
  heartbeat: {
    status: "starting",
    started_at: startedAt,
    uptime_ms: 0,
    jobs_completed: 0,
    jobs_running: 0,
    jobs_queued: 0,
    workers_online: 0,
    workers_busy: 0,
    last_cycle_at: null,
    cycle_count: 0,
  },
});

export class RuntimeState {
  private readonly stateFile: string;
  private state: RuntimePersistedState;

  constructor(stateFile?: string) {
    this.stateFile = stateFile ?? resolveRuntimePaths().stateFile;
    const now = new Date().toISOString();
    this.state = DEFAULT_STATE(now);
  }

  get(): RuntimePersistedState {
    return { ...this.state, heartbeat: { ...this.state.heartbeat }, last_errors: [...this.state.last_errors] };
  }

  async load(): Promise<RuntimePersistedState> {
    try {
      const raw = await readFile(this.stateFile, "utf8");
      this.state = JSON.parse(raw) as RuntimePersistedState;
    } catch {
      // keep in-memory default
    }
    return this.get();
  }

  async save(): Promise<void> {
    await mkdir(dirname(this.stateFile), { recursive: true });
    this.state.updated_at = new Date().toISOString();
    await writeFile(this.stateFile, JSON.stringify(this.state, null, 2), "utf8");
  }

  setStatus(status: RuntimeStatus): void {
    this.state.status = status;
    this.state.heartbeat.status = status;
  }

  applyHeartbeat(heartbeat: RuntimePersistedState["heartbeat"], errors: string[] = []): void {
    this.state.heartbeat = { ...heartbeat };
    this.state.status = heartbeat.status;
    this.state.uptime_ms = heartbeat.uptime_ms;
    this.state.cycle_count = heartbeat.cycle_count;
    this.state.jobs_completed = heartbeat.jobs_completed;
    this.state.jobs_running = heartbeat.jobs_running;
    this.state.jobs_queued = heartbeat.jobs_queued;
    this.state.workers_online = heartbeat.workers_online;
    this.state.workers_busy = heartbeat.workers_busy;
    this.state.last_cycle_at = heartbeat.last_cycle_at;
    if (errors.length > 0) {
      this.state.last_errors = [...errors, ...this.state.last_errors].slice(0, 20);
    }
  }
}
