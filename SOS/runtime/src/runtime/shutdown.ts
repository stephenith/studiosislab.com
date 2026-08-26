import { existsSync } from "node:fs";
import { readFile, writeFile, unlink, mkdir } from "node:fs/promises";
import { join } from "node:path";

export type ShutdownFlag = {
  requested_at: string;
  reason: string;
  by: "commander" | "signal";
};

let workerDraining = false;

export function shutdownFlagPath(logsRoot: string): string {
  return join(logsRoot, "commander", "shutdown.flag");
}

export function isShutdownRequested(logsRoot?: string): boolean {
  if (process.env.SOS_GRACEFUL_SHUTDOWN === "true") return true;
  if (workerDraining) return true;
  if (!logsRoot) return false;
  return existsSync(shutdownFlagPath(logsRoot));
}

export async function readShutdownFlag(logsRoot: string): Promise<ShutdownFlag | null> {
  const path = shutdownFlagPath(logsRoot);
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(await readFile(path, "utf8")) as ShutdownFlag;
  } catch {
    return null;
  }
}

export async function writeShutdownFlag(
  logsRoot: string,
  reason: string,
  by: ShutdownFlag["by"] = "commander",
): Promise<void> {
  const path = shutdownFlagPath(logsRoot);
  await mkdir(join(logsRoot, "commander"), { recursive: true });
  const flag: ShutdownFlag = {
    requested_at: new Date().toISOString(),
    reason,
    by,
  };
  await writeFile(path, JSON.stringify(flag, null, 2), "utf8");
}

export async function clearShutdownFlag(logsRoot: string): Promise<void> {
  const path = shutdownFlagPath(logsRoot);
  if (existsSync(path)) await unlink(path);
}

export type WorkerShutdownOptions = {
  logsRoot: string;
  label: string;
  /** Return true when safe to exit (idle or work unit complete). */
  canExit: () => boolean;
  onDrain: () => Promise<void>;
};

/**
 * Registers SIGINT/SIGTERM handlers. Sets draining mode and runs onDrain before exit.
 */
export function registerWorkerShutdown(options: WorkerShutdownOptions): void {
  let exiting = false;

  const requestExit = async (signal: string): Promise<void> => {
    if (exiting) return;
    exiting = true;
    workerDraining = true;
    console.log(`[${options.label}] ${signal} received — draining...`);

    const deadline = Date.now() + parseInt(process.env.SOS_WORKER_DRAIN_TIMEOUT_MS ?? "300000", 10);
    while (!options.canExit() && Date.now() < deadline) {
      if (isShutdownRequested(options.logsRoot)) break;
      await new Promise((r) => setTimeout(r, 500));
    }

    try {
      await options.onDrain();
    } catch (e) {
      console.error(`[${options.label}] drain error:`, e instanceof Error ? e.message : e);
    }

    console.log(`[${options.label}] graceful exit`);
    process.exit(0);
  };

  process.on("SIGTERM", () => void requestExit("SIGTERM"));
  process.on("SIGINT", () => void requestExit("SIGINT"));
}

export function isWorkerDraining(): boolean {
  return workerDraining;
}
