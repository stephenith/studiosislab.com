/**
 * TelemetryRepository — persistence (Agent #183).
 * No collection. No emission.
 */
import { join, resolve } from "node:path";
import { writeFileSync, mkdirSync, readFileSync, existsSync } from "node:fs";
import type {
  TelemetryCorrelationContract,
  TelemetryHealth,
  TelemetryLifecycleStatus,
  TelemetryRegistrySnapshot,
  TelemetrySessionContract,
  TelemetrySessionSummary,
  TelemetrySnapshotContract,
  TelemetryTimelineContract,
} from "./TelemetryTypes.js";
import {
  TELEMETRY_HEALTH_VERSION,
  TELEMETRY_SAFETY_FLAGS,
  TELEMETRY_SNAPSHOT_VERSION,
  TELEMETRY_EVENT_CATALOGUE,
} from "./TelemetryTypes.js";
import { TelemetrySession } from "./TelemetrySession.js";
import {
  assertTelemetryLifecycleTransition,
} from "./TelemetryLifecycle.js";
import {
  validateTelemetryCorrelation,
  validateTelemetrySession,
  validateTelemetryTimeline,
} from "./TelemetryValidator.js";

const LOG_REL = "SOS/07_LOGS/saios/platform/telemetry";

function resolveRepoRoot(fromDir = import.meta.dirname): string {
  return resolve(fromDir, "../../../..");
}

export class TelemetryRepository {
  readonly root: string;
  readonly fixture: boolean;
  private readonly sessions = new Map<string, TelemetrySessionContract>();
  private readonly timelines = new Map<string, TelemetryTimelineContract>();
  private readonly correlations = new Map<string, TelemetryCorrelationContract>();
  private readonly snapshots = new Map<string, TelemetrySnapshotContract>();

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

  registerSession(
    session: TelemetrySessionContract,
  ): { ok: boolean; error?: string } {
    if (process.env.SOS_AIOS_LIVE === "1") {
      return { ok: false, error: "LIVE must be OFF" };
    }
    const v = validateTelemetrySession(session);
    if (!v.ok) {
      return { ok: false, error: v.errors[0]?.message ?? "invalid session" };
    }
    if (this.sessions.has(session.telemetry_session_id)) {
      return {
        ok: false,
        error: `Session already registered: ${session.telemetry_session_id}`,
      };
    }
    this.sessions.set(session.telemetry_session_id, session);
    this.persist();
    return { ok: true };
  }

  registerTimeline(
    timeline: TelemetryTimelineContract,
  ): { ok: boolean; error?: string } {
    const v = validateTelemetryTimeline(timeline);
    if (!v.ok) {
      return { ok: false, error: v.errors[0]?.message ?? "invalid timeline" };
    }
    if (this.timelines.has(timeline.timeline_id)) {
      return {
        ok: false,
        error: `Timeline already registered: ${timeline.timeline_id}`,
      };
    }
    this.timelines.set(timeline.timeline_id, timeline);
    this.persist();
    return { ok: true };
  }

  registerCorrelation(
    correlation: TelemetryCorrelationContract,
  ): { ok: boolean; error?: string } {
    const v = validateTelemetryCorrelation(correlation);
    if (!v.ok) {
      return {
        ok: false,
        error: v.errors[0]?.message ?? "invalid correlation",
      };
    }
    this.correlations.set(correlation.correlation_id, correlation);
    this.persist();
    return { ok: true };
  }

  registerSnapshot(
    snapshot: TelemetrySnapshotContract,
  ): { ok: boolean; error?: string } {
    if (snapshot.collected !== false) {
      return { ok: false, error: "snapshot must not be collected" };
    }
    if (this.snapshots.has(snapshot.snapshot_id)) {
      return {
        ok: false,
        error: `Snapshot already registered: ${snapshot.snapshot_id}`,
      };
    }
    this.snapshots.set(snapshot.snapshot_id, snapshot);
    this.persist();
    return { ok: true };
  }

  listSessions(): TelemetrySessionContract[] {
    return [...this.sessions.values()].sort((a, b) =>
      a.telemetry_session_id.localeCompare(b.telemetry_session_id),
    );
  }

  listTimelines(): TelemetryTimelineContract[] {
    return [...this.timelines.values()].sort((a, b) =>
      a.timeline_id.localeCompare(b.timeline_id),
    );
  }

  listCorrelations(): TelemetryCorrelationContract[] {
    return [...this.correlations.values()].sort((a, b) =>
      a.correlation_id.localeCompare(b.correlation_id),
    );
  }

  listSnapshots(): TelemetrySnapshotContract[] {
    return [...this.snapshots.values()].sort((a, b) =>
      a.snapshot_id.localeCompare(b.snapshot_id),
    );
  }

  findSession(id: string): TelemetrySessionContract | null {
    return this.sessions.get(id) ?? null;
  }

  advanceSession(
    sessionId: string,
    to: TelemetryLifecycleStatus,
  ): { ok: boolean; error?: string; session?: TelemetrySessionContract } {
    const cur = this.sessions.get(sessionId);
    if (!cur) return { ok: false, error: "Session not found" };
    assertTelemetryLifecycleTransition(cur.status, to);
    const next = new TelemetrySession(cur).withStatus(to);
    const v = validateTelemetrySession(next.contract);
    if (!v.ok) {
      return { ok: false, error: v.errors[0]?.message };
    }
    this.sessions.set(sessionId, next.contract);
    this.persist();
    return { ok: true, session: next.contract };
  }

  discover(): TelemetrySessionSummary[] {
    return this.listSessions().map((s) => ({
      telemetry_session_id: s.telemetry_session_id,
      mission_id: s.mission_id,
      status: s.status,
      correlation_id: s.correlation_id,
      timeline_id: s.timeline_id,
      worker_runtime_id: s.worker_runtime_id,
      cost_session_id: s.cost_session_id,
      validation_ok: validateTelemetrySession(s).ok,
    }));
  }

  buildSnapshot(): TelemetryRegistrySnapshot {
    const list = this.listSessions();
    const latest = list.length ? list[list.length - 1]! : null;
    return {
      schema_version: TELEMETRY_SNAPSHOT_VERSION,
      updated_at: new Date().toISOString(),
      session_count: list.length,
      timeline_count: this.timelines.size,
      correlation_count: this.correlations.size,
      snapshot_count: this.snapshots.size,
      event_catalogue_count: TELEMETRY_EVENT_CATALOGUE.length,
      latest_session_id: latest?.telemetry_session_id ?? null,
      next_safe_action:
        "Telemetry contracts only · no collection · no emission · LIVE OFF",
      safety_flags: TELEMETRY_SAFETY_FLAGS,
    };
  }

  buildHealth(): TelemetryHealth {
    return {
      schema_version: TELEMETRY_HEALTH_VERSION,
      updated_at: new Date().toISOString(),
      session_count: this.sessions.size,
      timeline_count: this.timelines.size,
      correlation_count: this.correlations.size,
      status: this.sessions.size ? "healthy" : "idle",
      mode: "telemetry_contracts_only",
      collection: false,
      emission: false,
      safety_flags: TELEMETRY_SAFETY_FLAGS,
      live: false,
    };
  }

  persist(): void {
    this.ensureDir();
    writeFileSync(
      join(this.dir, "telemetry-sessions.json"),
      JSON.stringify(this.listSessions(), null, 2),
      "utf8",
    );
    writeFileSync(
      join(this.dir, "telemetry-timelines.json"),
      JSON.stringify(this.listTimelines(), null, 2),
      "utf8",
    );
    writeFileSync(
      join(this.dir, "telemetry-correlations.json"),
      JSON.stringify(this.listCorrelations(), null, 2),
      "utf8",
    );
    writeFileSync(
      join(this.dir, "telemetry-snapshots.json"),
      JSON.stringify(this.listSnapshots(), null, 2),
      "utf8",
    );
    writeFileSync(
      join(this.dir, "latest-telemetry-registry-snapshot.json"),
      JSON.stringify(this.buildSnapshot(), null, 2),
      "utf8",
    );
    writeFileSync(
      join(this.dir, "telemetry-health.json"),
      JSON.stringify(this.buildHealth(), null, 2),
      "utf8",
    );
  }

  loadPersisted(): {
    sessions: number;
    timelines: number;
    correlations: number;
    snapshots: number;
  } {
    this.sessions.clear();
    this.timelines.clear();
    this.correlations.clear();
    this.snapshots.clear();
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
    load<TelemetrySessionContract>("telemetry-sessions.json", (s) =>
      this.sessions.set(s.telemetry_session_id, s),
    );
    load<TelemetryTimelineContract>("telemetry-timelines.json", (t) =>
      this.timelines.set(t.timeline_id, t),
    );
    load<TelemetryCorrelationContract>("telemetry-correlations.json", (c) =>
      this.correlations.set(c.correlation_id, c),
    );
    load<TelemetrySnapshotContract>("telemetry-snapshots.json", (s) =>
      this.snapshots.set(s.snapshot_id, s),
    );
    return {
      sessions: this.sessions.size,
      timelines: this.timelines.size,
      correlations: this.correlations.size,
      snapshots: this.snapshots.size,
    };
  }
}
