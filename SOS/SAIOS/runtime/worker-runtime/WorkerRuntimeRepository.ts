/**
 * WorkerRuntimeRepository — persistence (Agent #182).
 * No spawn. No activation.
 */
import { join, resolve } from "node:path";
import { writeFileSync, mkdirSync, readFileSync, existsSync } from "node:fs";
import type {
  WorkerAssignmentContract,
  WorkerRuntimeContract,
  WorkerRuntimeHealth,
  WorkerRuntimeLifecycleStatus,
  WorkerRuntimeSnapshot,
  WorkerRuntimeSummary,
  WorkerSessionContract,
} from "./WorkerRuntimeTypes.js";
import {
  WORKER_RUNTIME_HEALTH_VERSION,
  WORKER_RUNTIME_SAFETY_FLAGS,
  WORKER_RUNTIME_SNAPSHOT_VERSION,
} from "./WorkerRuntimeTypes.js";
import { WorkerRuntime } from "./WorkerRuntime.js";
import {
  assertWorkerRuntimeTransition,
} from "./WorkerLifecycle.js";
import {
  validateWorkerAssignment,
  validateWorkerRuntime,
  validateWorkerSession,
} from "./WorkerRuntimeValidator.js";

const LOG_REL = "SOS/07_LOGS/saios/runtime/worker-runtime";

function resolveRepoRoot(fromDir = import.meta.dirname): string {
  return resolve(fromDir, "../../../..");
}

export class WorkerRuntimeRepository {
  readonly root: string;
  readonly fixture: boolean;
  private readonly runtimes = new Map<string, WorkerRuntimeContract>();
  private readonly assignments = new Map<string, WorkerAssignmentContract>();
  private readonly sessions = new Map<string, WorkerSessionContract>();

  constructor(repoRoot?: string, opts?: { fixture?: boolean }) {
    this.root = repoRoot ?? resolveRepoRoot();
    this.fixture = Boolean(opts?.fixture);
  }

  get dir(): string {
    const base = join(this.root, LOG_REL);
    return this.fixture ? join(base, "fixtures") : base;
  }

  ensureDir(): void {
    mkdirSync(this.dir, { recursive: true });
  }

  registerRuntime(
    runtime: WorkerRuntimeContract,
  ): { ok: boolean; error?: string } {
    if (process.env.SOS_AIOS_LIVE === "1") {
      return { ok: false, error: "LIVE must be OFF" };
    }
    const v = validateWorkerRuntime(runtime);
    if (!v.ok) {
      return { ok: false, error: v.errors[0]?.message ?? "invalid runtime" };
    }
    if (this.runtimes.has(runtime.worker_runtime_id)) {
      return {
        ok: false,
        error: `Runtime already registered: ${runtime.worker_runtime_id}`,
      };
    }
    this.runtimes.set(runtime.worker_runtime_id, runtime);
    this.persist();
    return { ok: true };
  }

  registerAssignment(
    assignment: WorkerAssignmentContract,
  ): { ok: boolean; error?: string } {
    const v = validateWorkerAssignment(assignment);
    if (!v.ok) {
      return { ok: false, error: v.errors[0]?.message ?? "invalid assignment" };
    }
    if (this.assignments.has(assignment.assignment_id)) {
      return {
        ok: false,
        error: `Assignment already registered: ${assignment.assignment_id}`,
      };
    }
    this.assignments.set(assignment.assignment_id, assignment);
    this.persist();
    return { ok: true };
  }

  registerSession(
    session: WorkerSessionContract,
  ): { ok: boolean; error?: string } {
    const v = validateWorkerSession(session);
    if (!v.ok) {
      return { ok: false, error: v.errors[0]?.message ?? "invalid session" };
    }
    if (this.sessions.has(session.session_id)) {
      return {
        ok: false,
        error: `Session already registered: ${session.session_id}`,
      };
    }
    this.sessions.set(session.session_id, session);
    this.persist();
    return { ok: true };
  }

  listRuntimes(): WorkerRuntimeContract[] {
    return [...this.runtimes.values()].sort((a, b) =>
      a.worker_runtime_id.localeCompare(b.worker_runtime_id),
    );
  }

  listAssignments(): WorkerAssignmentContract[] {
    return [...this.assignments.values()].sort((a, b) =>
      a.assignment_id.localeCompare(b.assignment_id),
    );
  }

  listSessions(): WorkerSessionContract[] {
    return [...this.sessions.values()].sort((a, b) =>
      a.session_id.localeCompare(b.session_id),
    );
  }

  findRuntime(id: string): WorkerRuntimeContract | null {
    return (
      this.runtimes.get(id) ??
      this.listRuntimes().find((r) => r.worker_id === id) ??
      null
    );
  }

  findAssignment(id: string): WorkerAssignmentContract | null {
    return this.assignments.get(id) ?? null;
  }

  advanceRuntime(
    runtimeId: string,
    to: WorkerRuntimeLifecycleStatus,
  ): { ok: boolean; error?: string; runtime?: WorkerRuntimeContract } {
    const cur = this.runtimes.get(runtimeId);
    if (!cur) return { ok: false, error: "Runtime not found" };
    assertWorkerRuntimeTransition(cur.status, to);
    const next = new WorkerRuntime(cur).withStatus(to);
    const v = validateWorkerRuntime(next.contract);
    if (!v.ok) {
      return { ok: false, error: v.errors[0]?.message };
    }
    this.runtimes.set(runtimeId, next.contract);
    this.persist();
    return { ok: true, runtime: next.contract };
  }

  discover(): WorkerRuntimeSummary[] {
    return this.listRuntimes().map((r) => ({
      worker_runtime_id: r.worker_runtime_id,
      worker_id: r.worker_id,
      department_id: r.department_id,
      mission_id: r.mission_id,
      status: r.status,
      capability_count: r.capabilities.length,
      dependency_count: r.dependencies.length,
      cost_session_reference: r.cost_session_reference,
      telemetry_reference: r.telemetry_reference,
      validation_ok: validateWorkerRuntime(r).ok,
    }));
  }

  buildSnapshot(): WorkerRuntimeSnapshot {
    const list = this.listRuntimes();
    const latest = list.length ? list[list.length - 1]! : null;
    return {
      schema_version: WORKER_RUNTIME_SNAPSHOT_VERSION,
      updated_at: new Date().toISOString(),
      runtime_count: list.length,
      assignment_count: this.assignments.size,
      session_count: this.sessions.size,
      authorized_count: list.filter(
        (r) => r.status === "CONTROLLER_AUTHORIZED",
      ).length,
      latest_runtime_id: latest?.worker_runtime_id ?? null,
      next_safe_action:
        "Worker runtime contracts only · spawn disabled · execution remains impossible · LIVE OFF",
      safety_flags: WORKER_RUNTIME_SAFETY_FLAGS,
    };
  }

  buildHealth(): WorkerRuntimeHealth {
    return {
      schema_version: WORKER_RUNTIME_HEALTH_VERSION,
      updated_at: new Date().toISOString(),
      runtime_count: this.runtimes.size,
      assignment_count: this.assignments.size,
      session_count: this.sessions.size,
      status: this.runtimes.size ? "healthy" : "idle",
      mode: "worker_runtime_contracts_only",
      worker_spawn: false,
      safety_flags: WORKER_RUNTIME_SAFETY_FLAGS,
      live: false,
    };
  }

  persist(): void {
    this.ensureDir();
    writeFileSync(
      join(this.dir, "worker-runtimes.json"),
      JSON.stringify(this.listRuntimes(), null, 2),
      "utf8",
    );
    writeFileSync(
      join(this.dir, "worker-assignments.json"),
      JSON.stringify(this.listAssignments(), null, 2),
      "utf8",
    );
    writeFileSync(
      join(this.dir, "worker-sessions.json"),
      JSON.stringify(this.listSessions(), null, 2),
      "utf8",
    );
    writeFileSync(
      join(this.dir, "latest-worker-runtime-snapshot.json"),
      JSON.stringify(this.buildSnapshot(), null, 2),
      "utf8",
    );
    writeFileSync(
      join(this.dir, "worker-runtime-health.json"),
      JSON.stringify(this.buildHealth(), null, 2),
      "utf8",
    );
  }

  loadPersisted(): {
    runtimes: number;
    assignments: number;
    sessions: number;
  } {
    this.runtimes.clear();
    this.assignments.clear();
    this.sessions.clear();
    const load = <T>(file: string, set: (item: T) => void) => {
      const path = join(this.dir, file);
      if (!existsSync(path)) return;
      try {
        const list = JSON.parse(readFileSync(path, "utf8")) as T[];
        for (const item of list) set(item);
      } catch {
        /* ignore */
      }
    };
    load<WorkerRuntimeContract>("worker-runtimes.json", (r) =>
      this.runtimes.set(r.worker_runtime_id, r),
    );
    load<WorkerAssignmentContract>("worker-assignments.json", (a) =>
      this.assignments.set(a.assignment_id, a),
    );
    load<WorkerSessionContract>("worker-sessions.json", (s) =>
      this.sessions.set(s.session_id, s),
    );
    return {
      runtimes: this.runtimes.size,
      assignments: this.assignments.size,
      sessions: this.sessions.size,
    };
  }

  loadSnapshot(): WorkerRuntimeSnapshot | null {
    const path = join(this.dir, "latest-worker-runtime-snapshot.json");
    if (!existsSync(path)) return null;
    try {
      return JSON.parse(readFileSync(path, "utf8")) as WorkerRuntimeSnapshot;
    } catch {
      return null;
    }
  }

  loadHealth(): WorkerRuntimeHealth | null {
    const path = join(this.dir, "worker-runtime-health.json");
    if (!existsSync(path)) return null;
    try {
      return JSON.parse(readFileSync(path, "utf8")) as WorkerRuntimeHealth;
    } catch {
      return null;
    }
  }
}
