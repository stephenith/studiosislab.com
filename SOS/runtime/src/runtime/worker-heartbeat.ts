import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { RuntimeConfig } from "../config.js";
import type { RuntimeWorkerId } from "../commander/process-table.js";

export type WorkerHeartbeatRecord = {
  worker_id: string;
  pid: number;
  last_heartbeat: string;
  previous_heartbeat: string | null;
  started_at: string;
  sequence: number;
  phase: string;
  busy: boolean;
  busy_since: string | null;
  busy_label: string | null;
  observed_interval_ms: number | null;
  jitter_ms: number | null;
  metadata?: Record<string, unknown>;
};

export type WorkerHeartbeatController = {
  stop: () => Promise<void>;
  setBusy: (label: string, metadata?: Record<string, unknown>) => void;
  clearBusy: () => void;
  setPhase: (phase: string) => void;
  pulse: () => Promise<void>;
};

function heartbeatPath(config: RuntimeConfig, workerId: string): string {
  return join(config.logsRoot, "runtime-heartbeats", `${workerId}.json`);
}

export async function writeWorkerHeartbeat(
  config: RuntimeConfig,
  record: WorkerHeartbeatRecord,
): Promise<void> {
  const dir = join(config.logsRoot, "runtime-heartbeats");
  await mkdir(dir, { recursive: true });
  await writeFile(heartbeatPath(config, record.worker_id), JSON.stringify(record, null, 2), "utf8");
}

export function startWorkerHeartbeat(
  config: RuntimeConfig,
  workerId: RuntimeWorkerId | string,
  options: { intervalMs?: number; initialPhase?: string } = {},
): WorkerHeartbeatController {
  const intervalMs = options.intervalMs ?? parseInt(process.env.SOS_WORKER_HEARTBEAT_MS ?? "30000", 10);
  const startedAt = new Date().toISOString();
  let sequence = 0;
  let phase = options.initialPhase ?? "starting";
  let busy = false;
  let busySince: string | null = null;
  let busyLabel: string | null = null;
  let busyMeta: Record<string, unknown> | undefined;
  let previousHeartbeat: string | null = null;
  let lastWrittenAt = 0;
  let stopped = false;
  let writing = false;

  const pulse = async (): Promise<void> => {
    if (stopped || writing) return;
    writing = true;
    const now = new Date();
    const nowIso = now.toISOString();
    const observedInterval = previousHeartbeat ? now.getTime() - Date.parse(previousHeartbeat) : null;
    const jitter = observedInterval !== null ? Math.abs(observedInterval - intervalMs) : null;

    const record: WorkerHeartbeatRecord = {
      worker_id: workerId,
      pid: process.pid,
      last_heartbeat: nowIso,
      previous_heartbeat: previousHeartbeat,
      started_at: startedAt,
      sequence: ++sequence,
      phase,
      busy,
      busy_since: busySince,
      busy_label: busyLabel,
      observed_interval_ms: observedInterval,
      jitter_ms: jitter,
      metadata: busyMeta,
    };

    try {
      await writeWorkerHeartbeat(config, record);
      previousHeartbeat = nowIso;
      lastWrittenAt = now.getTime();
    } catch (e) {
      console.error(
        `[heartbeat:${workerId}] write failed: ${e instanceof Error ? e.message : String(e)}`,
      );
    } finally {
      writing = false;
    }
  };

  void pulse();

  const timer = setInterval(() => {
    void pulse();
  }, intervalMs);
  if (typeof timer.unref === "function") timer.unref();

  return {
    async stop(): Promise<void> {
      stopped = true;
      clearInterval(timer);
      phase = "stopped";
      await pulse();
    },
    setBusy(label: string, metadata?: Record<string, unknown>): void {
      busy = true;
      if (!busySince) busySince = new Date().toISOString();
      busyLabel = label;
      busyMeta = metadata;
    },
    clearBusy(): void {
      busy = false;
      busySince = null;
      busyLabel = null;
      busyMeta = undefined;
    },
    setPhase(next: string): void {
      phase = next;
    },
    pulse,
  };
}
