/**
 * Loop supervisor — starts / observes Runtime Loop without modifying its logic.
 */
import {
  runRuntimeLoop,
  verifyLoopConfiguration,
} from "../runtime-loop/index.js";
import type { SupervisorConfiguration } from "./types.js";

export type LoopSuperviseResult = {
  ok: boolean;
  dry_run: boolean;
  cycle_count: number;
  status: string;
  detail: string;
};

export async function superviseRuntimeLoop(
  config: SupervisorConfiguration,
): Promise<LoopSuperviseResult> {
  // Always use Runtime Loop public API; verify/dry-run caps cycles.
  const loopConfig = {
    ...verifyLoopConfiguration(),
    dry_run: true,
    max_cycles: 1,
    sleep_ms_override: 0,
  };

  if (!config.dry_run) {
    // Live supervisor still starts loop with safe caps from supervisor config
    loopConfig.dry_run = false;
    loopConfig.max_cycles = config.max_cycles ?? 1;
    loopConfig.max_runtime_ms = config.max_runtime_ms ?? 60_000;
  }

  try {
    const result = await runRuntimeLoop({ config: loopConfig });
    return {
      ok: result.status !== "BLOCKED",
      dry_run: config.dry_run || result.mode === "dry_run",
      cycle_count: result.cycle_count,
      status: result.status,
      detail: `supervised runtime loop · cycles=${result.cycle_count} · status=${result.status}`,
    };
  } catch (e) {
    return {
      ok: false,
      dry_run: config.dry_run,
      cycle_count: 0,
      status: "FAILED",
      detail: e instanceof Error ? e.message : String(e),
    };
  }
}
