import { open, readFile, unlink, writeFile, mkdir } from "node:fs/promises";
import { existsSync, readFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { hostname } from "node:os";
import type { RuntimeConfig } from "../config.js";
import {
  type RuntimeWorkerId,
  WORKER_SCRIPT_MARKERS,
  getProcessCommand,
  isProcessAlive,
  killProcessTree,
} from "../commander/process-table.js";

export type { RuntimeWorkerId };
export { WORKER_SCRIPT_MARKERS };

export type InstanceLockOwner = "commander" | "manual";

export type InstanceLockRecord = {
  worker_id: RuntimeWorkerId;
  pid: number;
  ppid: number;
  started_at: string;
  owner: InstanceLockOwner;
  script: string;
  hostname: string;
  commander_pid: number | null;
};

export type InstanceLockHandle = {
  worker_id: RuntimeWorkerId;
  record: InstanceLockRecord;
  lock_path: string;
  release: () => Promise<void>;
};

function lockDir(config: RuntimeConfig): string {
  return join(config.logsRoot, "runtime-locks");
}

function lockPath(config: RuntimeConfig, workerId: RuntimeWorkerId): string {
  return join(lockDir(config), `${workerId}.lock.json`);
}

function ownerFromEnv(): InstanceLockOwner {
  return process.env.SOS_PRODUCTION_WORKER === "true" ? "commander" : "manual";
}

function commanderPidFromEnv(): number | null {
  const raw = process.env.SOS_COMMANDER_PID;
  if (!raw) return null;
  const pid = parseInt(raw, 10);
  return Number.isNaN(pid) ? null : pid;
}

async function readLockRecord(path: string): Promise<InstanceLockRecord | null> {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(await readFile(path, "utf8")) as InstanceLockRecord;
  } catch {
    return null;
  }
}

function validateLockRecord(
  record: InstanceLockRecord,
  workerId: RuntimeWorkerId,
  scriptMarker: string,
): { valid: boolean; reason: string } {
  if (record.worker_id !== workerId) {
    return { valid: false, reason: `lock worker_id mismatch (${record.worker_id})` };
  }
  if (!isProcessAlive(record.pid)) {
    return { valid: false, reason: `pid ${record.pid} not running` };
  }
  const cmd = getProcessCommand(record.pid);
  if (!cmd) {
    return { valid: false, reason: `pid ${record.pid} has no command line` };
  }
  if (!cmd.includes(scriptMarker)) {
    return { valid: false, reason: `pid ${record.pid} command does not match ${scriptMarker}` };
  }
  return { valid: true, reason: `active pid ${record.pid}` };
}

async function removeLock(path: string): Promise<void> {
  if (existsSync(path)) {
    await unlink(path).catch(() => undefined);
  }
}

export async function readInstanceLock(
  config: RuntimeConfig,
  workerId: RuntimeWorkerId,
): Promise<{ path: string; record: InstanceLockRecord | null; valid: boolean; reason: string }> {
  const path = lockPath(config, workerId);
  const record = await readLockRecord(path);
  if (!record) {
    return { path, record: null, valid: false, reason: "no lock file" };
  }
  const scriptMarker = WORKER_SCRIPT_MARKERS[workerId];
  const check = validateLockRecord(record, workerId, scriptMarker);
  return { path, record, valid: check.valid, reason: check.reason };
}

export async function clearStaleInstanceLock(
  config: RuntimeConfig,
  workerId: RuntimeWorkerId,
): Promise<{ removed: boolean; reason: string }> {
  const path = lockPath(config, workerId);
  const record = await readLockRecord(path);
  if (!record) {
    return { removed: false, reason: "no lock file" };
  }
  const scriptMarker = WORKER_SCRIPT_MARKERS[workerId];
  const check = validateLockRecord(record, workerId, scriptMarker);
  if (check.valid) {
    return { removed: false, reason: check.reason };
  }
  await removeLock(path);
  return { removed: true, reason: check.reason };
}

export async function acquireRuntimeInstanceLock(
  config: RuntimeConfig,
  workerId: RuntimeWorkerId,
  options: { force?: boolean } = {},
): Promise<InstanceLockHandle> {
  const scriptMarker = WORKER_SCRIPT_MARKERS[workerId];
  const path = lockPath(config, workerId);
  await mkdir(lockDir(config), { recursive: true });

  const record: InstanceLockRecord = {
    worker_id: workerId,
    pid: process.pid,
    ppid: process.ppid,
    started_at: new Date().toISOString(),
    owner: ownerFromEnv(),
    script: scriptMarker,
    hostname: hostname(),
    commander_pid: commanderPidFromEnv(),
  };

  for (let attempt = 0; attempt < 3; attempt++) {
    const stale = await clearStaleInstanceLock(config, workerId);
    if (stale.removed) {
      console.log(`[single-instance] cleared stale ${workerId} lock: ${stale.reason}`);
    }

    const existing = await readLockRecord(path);
    if (existing && !options.force) {
      const check = validateLockRecord(existing, workerId, scriptMarker);
      if (check.valid) {
        throw new Error(
          `${workerId} runtime already running (pid ${existing.pid}, owner=${existing.owner}). ` +
            `Only one instance is allowed.`,
        );
      }
      await removeLock(path);
    }

    try {
      const fd = await open(path, "wx");
      await fd.writeFile(JSON.stringify(record, null, 2), "utf8");
      await fd.close();
      break;
    } catch (e) {
      const err = e as NodeJS.ErrnoException;
      if (err.code !== "EEXIST" || attempt === 2) {
        const live = await readInstanceLock(config, workerId);
        throw new Error(
          `Failed to acquire ${workerId} instance lock: ${live.reason}`,
        );
      }
      await new Promise((r) => setTimeout(r, 50 * (attempt + 1)));
    }
  }

  let released = false;
  const release = async (): Promise<void> => {
    if (released) return;
    released = true;
    const current = await readLockRecord(path);
    if (current?.pid === process.pid) {
      await removeLock(path);
    }
  };

  const onSignal = (): void => {
    void release().finally(() => process.exit(0));
  };
  process.once("SIGINT", onSignal);
  process.once("SIGTERM", onSignal);
  process.once("exit", () => {
    if (!released && existsSync(path)) {
      try {
        const cur = JSON.parse(readFileSync(path, "utf8")) as InstanceLockRecord;
        if (cur.pid === process.pid) {
          unlinkSync(path);
        }
      } catch {
        /* best-effort sync cleanup */
      }
    }
  });

  return { worker_id: workerId, record, lock_path: path, release };
}

export async function terminateLockHolder(
  config: RuntimeConfig,
  workerId: RuntimeWorkerId,
): Promise<{ terminated: boolean; pid: number | null; reason: string }> {
  const { record, valid, reason } = await readInstanceLock(config, workerId);
  if (!record) {
    return { terminated: false, pid: null, reason };
  }
  if (!valid) {
    await removeLock(lockPath(config, workerId));
    return { terminated: false, pid: record.pid, reason: `cleared stale lock: ${reason}` };
  }
  const killed = killProcessTree(record.pid);
  await removeLock(lockPath(config, workerId));
  return {
    terminated: killed,
    pid: record.pid,
    reason: killed ? `terminated pid ${record.pid}` : `failed to terminate pid ${record.pid}`,
  };
}

export async function writeInstanceLockForPid(
  config: RuntimeConfig,
  workerId: RuntimeWorkerId,
  pid: number,
  owner: InstanceLockOwner,
  commanderPid: number | null,
): Promise<void> {
  const path = lockPath(config, workerId);
  await mkdir(lockDir(config), { recursive: true });
  const record: InstanceLockRecord = {
    worker_id: workerId,
    pid,
    ppid: process.pid,
    started_at: new Date().toISOString(),
    owner,
    script: WORKER_SCRIPT_MARKERS[workerId],
    hostname: hostname(),
    commander_pid: commanderPid,
  };
  await writeFile(path, JSON.stringify(record, null, 2), "utf8");
}
