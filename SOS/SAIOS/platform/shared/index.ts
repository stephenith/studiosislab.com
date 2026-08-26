/**
 * Platform shared utilities — Agent #173.
 * Generic only. No domain logic.
 */
import { resolve } from "node:path";

/** Resolve monorepo root from a module under SOS/SAIOS/<layer>/<pkg>. */
export function resolveRepoRootFrom(fromDir: string, up = 4): string {
  const parts = Array.from({ length: up }, () => "..");
  return resolve(fromDir, ...parts);
}

export function isLiveOff(): boolean {
  return process.env.SOS_AIOS_LIVE !== "1";
}

export function assertLiveOff(): void {
  if (!isLiveOff()) {
    throw new Error("LIVE must be OFF");
  }
}
