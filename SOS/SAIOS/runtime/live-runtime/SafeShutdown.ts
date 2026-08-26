/**
 * Safe shutdown — record orderly stop; never force-kill departments.
 */
import type { ContinuityStep, RuntimeCaps } from "./types.js";

export function safeShutdown(input: {
  reason: string;
  caps: RuntimeCaps;
}): ContinuityStep {
  return {
    step: 99,
    name: "safe_shutdown",
    ok: true,
    detail: `shutdown · reason=${input.reason} · timeout_ms=${input.caps.shutdown_timeout_ms}`,
  };
}
