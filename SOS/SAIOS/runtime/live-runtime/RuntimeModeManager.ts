/**
 * Runtime mode manager — VERIFY / DRY_RUN / LIVE.
 */
import type { FounderGateResult, RuntimeMode } from "./types.js";

export const LIVE_FLAG = "SOS_AIOS_LIVE";

export function isLiveFlagEnabled(): boolean {
  const v = process.env[LIVE_FLAG]?.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

export function resolveRequestedMode(forceVerify = false): RuntimeMode {
  if (forceVerify) return "VERIFY";
  if (isLiveFlagEnabled()) return "LIVE";
  return "DRY_RUN";
}

/**
 * LIVE only when flag set AND founder gate approves.
 * VERIFY always stays VERIFY. Failed LIVE falls back to DRY_RUN.
 */
export function resolveEffectiveMode(
  requested: RuntimeMode,
  gate: FounderGateResult,
): RuntimeMode {
  if (requested === "VERIFY") return "VERIFY";
  if (requested === "DRY_RUN") return "DRY_RUN";
  if (requested === "LIVE" && gate.approved && gate.live_flag) return "LIVE";
  return "DRY_RUN";
}
