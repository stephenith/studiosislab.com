/**
 * Durable publication execution journal — crash-safe atomic JSON.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { defaultPublicationRoots, type PublicationRoots } from "../paths.js";
import { atomicWriteJson } from "./atomicWrite.js";
import type { PublicationExecution } from "./types.js";

export function executionsRoot(
  roots: PublicationRoots = defaultPublicationRoots(),
): string {
  return roots.executionsRoot;
}

export function executionPath(
  executionId: string,
  roots: PublicationRoots = defaultPublicationRoots(),
): string {
  return join(executionsRoot(roots), `${executionId}.json`);
}

export function planExecutionIndexPath(
  planId: string,
  roots: PublicationRoots = defaultPublicationRoots(),
): string {
  return join(executionsRoot(roots), `by-plan-${planId}.json`);
}

export function newExecutionId(): string {
  const day = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  return `exec-${day}-${randomUUID().slice(0, 8)}`;
}

export function readExecution(
  executionId: string,
  roots: PublicationRoots = defaultPublicationRoots(),
): PublicationExecution | null {
  const p = executionPath(executionId, roots);
  if (!existsSync(p)) return null;
  try {
    return JSON.parse(readFileSync(p, "utf8")) as PublicationExecution;
  } catch (e) {
    throw new Error(
      `Malformed execution journal ${executionId}: ${e instanceof Error ? e.message : String(e)}`,
    );
  }
}

export function writeExecution(
  exec: PublicationExecution,
  roots: PublicationRoots = defaultPublicationRoots(),
): void {
  const next = { ...exec, updated_at: new Date().toISOString() };
  atomicWriteJson(executionPath(next.execution_id, roots), next);
  atomicWriteJson(planExecutionIndexPath(next.plan_id, roots), {
    plan_id: next.plan_id,
    execution_id: next.execution_id,
    status: next.status,
    updated_at: next.updated_at,
  });
}

export function findExecutionForPlan(
  planId: string,
  roots: PublicationRoots = defaultPublicationRoots(),
): PublicationExecution | null {
  const idx = planExecutionIndexPath(planId, roots);
  if (existsSync(idx)) {
    const doc = JSON.parse(readFileSync(idx, "utf8")) as {
      execution_id?: string;
    };
    if (doc.execution_id) {
      // Propagate malformed journal errors — do not silently start a new execution
      return readExecution(doc.execution_id, roots);
    }
  }
  const root = executionsRoot(roots);
  if (!existsSync(root)) return null;
  for (const f of readdirSync(root)) {
    if (!f.startsWith("exec-") || !f.endsWith(".json")) continue;
    try {
      const exec = JSON.parse(
        readFileSync(join(root, f), "utf8"),
      ) as PublicationExecution;
      if (exec.plan_id === planId) return exec;
    } catch {
      /* skip malformed during scan */
    }
  }
  return null;
}

export function ensureExecutionsDir(
  roots: PublicationRoots = defaultPublicationRoots(),
): void {
  mkdirSync(executionsRoot(roots), { recursive: true });
}
