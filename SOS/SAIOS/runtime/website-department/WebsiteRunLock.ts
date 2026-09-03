/**
 * Website-local single-run lock (exclusive create). Temporary-root testable.
 * Does not kill processes; stale locks are reported conservatively.
 */
import {
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";

export const WEBSITE_RUN_LOCK_NAME = "website-department.run.lock";

export type WebsiteRunLockInfo = {
  pid: number;
  run_id: string;
  acquired_at: string;
};

export function websiteRunLockPath(outputRoot: string): string {
  return join(outputRoot, WEBSITE_RUN_LOCK_NAME);
}

/**
 * Acquire exclusive lock under outputRoot. Throws if held.
 * Stale detection: if lock PID is dead on this host, optionally steal when allow_steal_stale.
 * Default: fail closed even if PID looks dead (conservative).
 */
export function acquireWebsiteRunLock(input: {
  output_root: string;
  run_id: string;
  allow_steal_stale?: boolean;
}): { release: () => void; info: WebsiteRunLockInfo } {
  mkdirSync(input.output_root, { recursive: true });
  const path = websiteRunLockPath(input.output_root);
  const info: WebsiteRunLockInfo = {
    pid: process.pid,
    run_id: input.run_id,
    acquired_at: new Date().toISOString(),
  };

  try {
    const fd = openSync(path, "wx");
    writeFileSync(path, JSON.stringify(info, null, 2));
    closeSync(fd);
  } catch {
    let existing: WebsiteRunLockInfo | null = null;
    try {
      existing = JSON.parse(readFileSync(path, "utf8")) as WebsiteRunLockInfo;
    } catch {
      existing = null;
    }
    const stale =
      existing?.pid &&
      existing.pid !== process.pid &&
      !isPidAlive(existing.pid);

    if (stale && input.allow_steal_stale) {
      try {
        unlinkSync(path);
      } catch {
        /* ignore */
      }
      return acquireWebsiteRunLock({
        output_root: input.output_root,
        run_id: input.run_id,
        allow_steal_stale: false,
      });
    }

    throw new Error(
      `Website Department run lock held` +
        (existing
          ? ` (pid=${existing.pid}, run_id=${existing.run_id}, acquired_at=${existing.acquired_at}` +
            (stale ? ", pid_appears_dead_but_steal_disabled" : "") +
            `)`
          : ` at ${path}`),
    );
  }

  let released = false;
  return {
    info,
    release: () => {
      if (released) return;
      released = true;
      try {
        if (!existsSync(path)) return;
        const cur = JSON.parse(readFileSync(path, "utf8")) as WebsiteRunLockInfo;
        if (cur.pid === process.pid && cur.run_id === input.run_id) {
          unlinkSync(path);
        }
      } catch {
        /* ignore */
      }
    },
  };
}

function isPidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}
