/**
 * Sleep between cycles — verify/dry-run may override to 0.
 */
import type { LoopConfiguration } from "./types.js";

export async function runtimeSleep(config: LoopConfiguration): Promise<number> {
  const ms =
    config.sleep_ms_override != null
      ? config.sleep_ms_override
      : config.dry_run
        ? Math.min(config.runtime_interval_ms, 10)
        : config.runtime_interval_ms;

  if (ms > 0) {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }
  return ms;
}
