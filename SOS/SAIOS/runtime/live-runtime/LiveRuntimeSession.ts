/**
 * Live runtime session tracking.
 */
import { randomUUID } from "node:crypto";
import type { LiveRuntimeSession, RuntimeMode } from "./types.js";

export function createLiveRuntimeSession(
  requested: RuntimeMode,
  effective: RuntimeMode,
): LiveRuntimeSession {
  return {
    session_id: `live-${randomUUID().slice(0, 8)}`,
    started_at: new Date().toISOString(),
    finished_at: null,
    requested_mode: requested,
    effective_mode: effective,
    cycles_completed: 0,
    shutdown_reason: null,
  };
}

export function finishSession(
  session: LiveRuntimeSession,
  cycles: number,
  reason: string,
): LiveRuntimeSession {
  return {
    ...session,
    finished_at: new Date().toISOString(),
    cycles_completed: cycles,
    shutdown_reason: reason,
  };
}
