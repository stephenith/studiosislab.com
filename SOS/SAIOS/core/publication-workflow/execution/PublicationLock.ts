/**
 * Durable plan lock — only one execute/simulate holder per plan.
 * Dry-run never acquires a production lock.
 */
import { existsSync, mkdirSync, readFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { defaultPublicationRoots, type PublicationRoots } from "../paths.js";
import { atomicWriteJson } from "./atomicWrite.js";
import type { PublicationLockRecord } from "./types.js";

const DEFAULT_STALE_MS = 2 * 60 * 60 * 1000; // 2h

export function lockPath(
  planId: string,
  roots: PublicationRoots = defaultPublicationRoots(),
): string {
  return join(roots.locksRoot, `${planId}.lock.json`);
}

export function readLock(
  planId: string,
  roots: PublicationRoots = defaultPublicationRoots(),
): PublicationLockRecord | null {
  const p = lockPath(planId, roots);
  if (!existsSync(p)) return null;
  return JSON.parse(readFileSync(p, "utf8")) as PublicationLockRecord;
}

export function acquirePublicationLock(input: {
  plan_id: string;
  execution_id: string;
  mode: "execute" | "simulate";
  stale_after_ms?: number;
  force_stale?: boolean;
  roots?: PublicationRoots;
}): { ok: true; lock: PublicationLockRecord } | { ok: false; error: string } {
  const roots = input.roots ?? defaultPublicationRoots();
  mkdirSync(roots.locksRoot, { recursive: true });
  const staleAfter = input.stale_after_ms ?? DEFAULT_STALE_MS;
  const existing = readLock(input.plan_id, roots);
  const now = Date.now();

  if (existing) {
    if (existing.execution_id === input.execution_id) {
      const refreshed: PublicationLockRecord = {
        ...existing,
        updated_at: new Date().toISOString(),
        holder_pid: process.pid,
      };
      atomicWriteJson(lockPath(input.plan_id, roots), refreshed);
      return { ok: true, lock: refreshed };
    }
    const age = now - Date.parse(existing.updated_at || existing.acquired_at);
    const stale = !Number.isFinite(age) || age > staleAfter;
    if (!stale && !input.force_stale) {
      return {
        ok: false,
        error: `Plan ${input.plan_id} locked by execution ${existing.execution_id} (pid ${existing.holder_pid}). Re-run to resume that execution or wait for stale lock (${staleAfter}ms).`,
      };
    }
    // Explicit stale takeover only when stale or force_stale
  }

  const lock: PublicationLockRecord = {
    schema_version: "publication-lock-1.0.0",
    plan_id: input.plan_id,
    execution_id: input.execution_id,
    acquired_at: existing?.acquired_at ?? new Date().toISOString(),
    updated_at: new Date().toISOString(),
    holder_pid: process.pid,
    mode: input.mode,
    stale_after_ms: staleAfter,
  };
  atomicWriteJson(lockPath(input.plan_id, roots), lock);
  return { ok: true, lock };
}

export function releasePublicationLock(
  planId: string,
  executionId: string,
  roots: PublicationRoots = defaultPublicationRoots(),
): void {
  const existing = readLock(planId, roots);
  if (!existing) return;
  if (existing.execution_id !== executionId) return;
  try {
    unlinkSync(lockPath(planId, roots));
  } catch {
    /* ignore */
  }
}

export function touchPublicationLock(
  planId: string,
  executionId: string,
  roots: PublicationRoots = defaultPublicationRoots(),
): void {
  const existing = readLock(planId, roots);
  if (!existing || existing.execution_id !== executionId) return;
  atomicWriteJson(lockPath(planId, roots), {
    ...existing,
    updated_at: new Date().toISOString(),
    holder_pid: process.pid,
  });
}
