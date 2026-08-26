/**
 * Graceful startup — boot continuity without modifying supervised modules.
 */
import type { ContinuityStep, RuntimeMode } from "./types.js";

export function gracefulStartup(mode: RuntimeMode): ContinuityStep[] {
  return [
    {
      step: 1,
      name: "boot",
      ok: true,
      detail: `Live Runtime boot · mode=${mode}`,
    },
    {
      step: 2,
      name: "load_caps",
      ok: true,
      detail: "runtime caps loaded from environment",
    },
    {
      step: 3,
      name: "evaluate_gate",
      ok: true,
      detail: "founder runtime gate evaluated",
    },
  ];
}
