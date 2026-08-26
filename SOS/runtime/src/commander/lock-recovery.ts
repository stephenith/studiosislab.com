import { readdir, unlink, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import type { RuntimeConfig } from "../config.js";

export type LockRecoveryResult = {
  scanned: number;
  removed: number;
  kept: number;
  details: Array<{ path: string; action: "removed" | "kept"; reason: string }>;
};

type LockFile = {
  task_id?: string;
  pid?: number;
  claimed_at?: string;
};

function isProcessAlive(pid: number): boolean {
  if (!pid || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function recoverLockDir(lockDir: string, dryRun: boolean): Promise<LockRecoveryResult> {
  const result: LockRecoveryResult = {
    scanned: 0,
    removed: 0,
    kept: 0,
    details: [],
  };

  if (!existsSync(lockDir)) return result;

  const files = (await readdir(lockDir)).filter((f) => f.endsWith(".json"));
  for (const file of files) {
    result.scanned += 1;
    const path = join(lockDir, file);
    let lock: LockFile = {};
    try {
      lock = JSON.parse(await readFile(path, "utf8")) as LockFile;
    } catch {
      if (!dryRun) await unlink(path);
      result.removed += 1;
      result.details.push({ path, action: "removed", reason: "corrupt lock file" });
      continue;
    }

    const pid = lock.pid ?? 0;
    if (!isProcessAlive(pid)) {
      if (!dryRun) await unlink(path);
      result.removed += 1;
      result.details.push({
        path,
        action: "removed",
        reason: pid ? `stale lock — pid ${pid} not running` : "stale lock — missing pid",
      });
    } else {
      result.kept += 1;
      result.details.push({ path, action: "kept", reason: `active pid ${pid}` });
    }
  }

  return result;
}

export async function recoverStaleLocks(
  config: RuntimeConfig,
  options: { dryRun?: boolean } = {},
): Promise<{
  developer: LockRecoveryResult;
  qa: LockRecoveryResult;
  total_removed: number;
  dry_run: boolean;
}> {
  const dryRun = options.dryRun ?? false;
  const devLocks = join(config.sosRoot, "07_LOGS", "developer", "locks");
  const qaLocks = join(config.sosRoot, "07_LOGS", "qa", "locks");

  const developer = await recoverLockDir(devLocks, dryRun);
  const qa = await recoverLockDir(qaLocks, dryRun);

  return {
    developer,
    qa,
    total_removed: developer.removed + qa.removed,
    dry_run: dryRun,
  };
}
