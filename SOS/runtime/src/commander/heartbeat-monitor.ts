import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import type { RuntimeConfig } from "../config.js";
import { getPmPaths } from "../pm/paths.js";
import { getDeveloperPaths } from "../developer/paths.js";
import { getQaPaths } from "../qa/paths.js";
import { getApprovalsPaths } from "../approvals/paths.js";
import type { WorkerHeartbeatRecord } from "../runtime/worker-heartbeat.js";
import {
  classifyHeartbeatAge,
  shouldRestartWorker,
  HEARTBEAT_POLICY,
  type HeartbeatLevel,
} from "./heartbeat-policy.js";

export type WorkerHeartbeatSnapshot = {
  worker_id: string;
  source: "runtime-heartbeat" | "legacy-status" | "missing";
  last_heartbeat: string | null;
  previous_heartbeat: string | null;
  age_ms: number | null;
  level: HeartbeatLevel;
  jitter_ms: number | null;
  observed_interval_ms: number | null;
  busy: boolean;
  busy_since: string | null;
  busy_label: string | null;
  busy_duration_ms: number | null;
  phase: string | null;
  sequence: number | null;
  pid: number | null;
  restart_recommended: boolean;
};

export type HeartbeatMonitorReport = {
  monitored_at: string;
  policy: typeof HEARTBEAT_POLICY;
  workers: WorkerHeartbeatSnapshot[];
  unhealthy_workers: string[];
  frozen_workers: string[];
};

async function readJson(path: string): Promise<Record<string, unknown> | null> {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(await readFile(path, "utf8")) as Record<string, unknown>;
  } catch {
    return null;
  }
}

async function readRuntimeHeartbeat(
  config: RuntimeConfig,
  workerId: string,
): Promise<WorkerHeartbeatRecord | null> {
  const path = join(config.logsRoot, "runtime-heartbeats", `${workerId}.json`);
  const raw = await readJson(path);
  if (!raw || typeof raw.last_heartbeat !== "string") return null;
  return raw as unknown as WorkerHeartbeatRecord;
}

const LEGACY_SOURCES: Record<string, { path: (c: RuntimeConfig) => string; fields: string[] }> = {
  pm: {
    path: (c) => getPmPaths(c).agentStatus,
    fields: ["updated_at", "last_heartbeat"],
  },
  developer: {
    path: (c) => getDeveloperPaths(c).status,
    fields: ["last_heartbeat"],
  },
  qa: {
    path: (c) => getQaPaths(c).status,
    fields: ["last_heartbeat"],
  },
  approvals: {
    path: (c) => getApprovalsPaths(c).status,
    fields: ["last_heartbeat"],
  },
};

async function readLegacyHeartbeat(
  config: RuntimeConfig,
  workerId: string,
): Promise<string | null> {
  const src = LEGACY_SOURCES[workerId];
  if (!src) return null;
  const raw = await readJson(src.path(config));
  if (!raw) return null;
  for (const field of src.fields) {
    const val = raw[field];
    if (typeof val === "string" && val.length > 0) return val;
  }
  return null;
}

function snapshotFromRecord(
  workerId: string,
  record: WorkerHeartbeatRecord,
  now: number,
): WorkerHeartbeatSnapshot {
  const ageMs = now - Date.parse(record.last_heartbeat);
  const level = classifyHeartbeatAge(ageMs);
  const busyDuration =
    record.busy && record.busy_since ? now - Date.parse(record.busy_since) : null;

  return {
    worker_id: workerId,
    source: "runtime-heartbeat",
    last_heartbeat: record.last_heartbeat,
    previous_heartbeat: record.previous_heartbeat,
    age_ms: ageMs,
    level,
    jitter_ms: record.jitter_ms,
    observed_interval_ms: record.observed_interval_ms,
    busy: record.busy,
    busy_since: record.busy_since,
    busy_label: record.busy_label,
    busy_duration_ms: busyDuration,
    phase: record.phase,
    sequence: record.sequence,
    pid: record.pid,
    restart_recommended: shouldRestartWorker(level),
  };
}

function snapshotFromLegacy(
  workerId: string,
  lastHeartbeat: string,
  now: number,
): WorkerHeartbeatSnapshot {
  const ageMs = now - Date.parse(lastHeartbeat);
  const level = classifyHeartbeatAge(ageMs);
  return {
    worker_id: workerId,
    source: "legacy-status",
    last_heartbeat: lastHeartbeat,
    previous_heartbeat: null,
    age_ms: ageMs,
    level,
    jitter_ms: null,
    observed_interval_ms: null,
    busy: false,
    busy_since: null,
    busy_label: null,
    busy_duration_ms: null,
    phase: null,
    sequence: null,
    pid: null,
    restart_recommended: shouldRestartWorker(level),
  };
}

const MONITORED_WORKERS = [
  "pm",
  "developer",
  "qa",
  "telegram",
  "dispatcher",
  "approvals",
] as const;

export async function monitorWorkerHeartbeats(
  config: RuntimeConfig,
): Promise<HeartbeatMonitorReport> {
  const now = Date.now();
  const workers: WorkerHeartbeatSnapshot[] = [];

  for (const workerId of MONITORED_WORKERS) {
    const runtime = await readRuntimeHeartbeat(config, workerId);
    if (runtime) {
      workers.push(snapshotFromRecord(workerId, runtime, now));
      continue;
    }

    const legacy = await readLegacyHeartbeat(config, workerId);
    if (legacy) {
      workers.push(snapshotFromLegacy(workerId, legacy, now));
      continue;
    }

    workers.push({
      worker_id: workerId,
      source: "missing",
      last_heartbeat: null,
      previous_heartbeat: null,
      age_ms: null,
      level: "critical",
      jitter_ms: null,
      observed_interval_ms: null,
      busy: false,
      busy_since: null,
      busy_label: null,
      busy_duration_ms: null,
      phase: null,
      sequence: null,
      pid: null,
      restart_recommended: false,
    });
  }

  const unhealthy = workers
    .filter((w) => w.level !== "healthy" && w.level !== "late")
    .map((w) => w.worker_id);
  const frozen = workers.filter((w) => w.restart_recommended).map((w) => w.worker_id);

  return {
    monitored_at: new Date().toISOString(),
    policy: HEARTBEAT_POLICY,
    workers,
    unhealthy_workers: unhealthy,
    frozen_workers: frozen,
  };
}
