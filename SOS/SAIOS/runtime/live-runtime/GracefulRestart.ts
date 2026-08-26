/**
 * Graceful restart marker — orchestration only.
 */
import type { ContinuityStep } from "./types.js";

export function gracefulRestart(reason: string): ContinuityStep {
  return {
    step: 50,
    name: "graceful_restart",
    ok: true,
    detail: `restart planned · reason=${reason} · no module rewrite`,
  };
}
