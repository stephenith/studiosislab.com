/**
 * Minimal AIOS ops alerts → Commander Telegram via NotificationLiveBridge.
 * Fail-open: never throws into callers. LIVE notify requires SOS_AIOS_NOTIFY_LIVE=1.
 */
import { NotificationLiveBridge } from "../../runtime/live-monitoring/NotificationLiveBridge.js";
import type { BusEvent, EventType } from "../../runtime/event-bus/types.js";

function makeEvent(
  type: EventType,
  title: string,
  detail: Record<string, unknown>,
): BusEvent {
  const id = `aios-alert-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return {
    id,
    type,
    source: "aios-ops",
    correlation_id: id,
    created_at: new Date().toISOString(),
    payload: {
      title,
      message: detail.message ?? title,
      detail,
      overall: title,
    },
  };
}

export async function emitAiosOpsAlert(input: {
  title: string;
  message: string;
  severity?: "P0" | "P1" | "P2";
  meta?: Record<string, unknown>;
}): Promise<{ ok: boolean; dry_run: boolean; error?: string }> {
  const forceDryRun = process.env.SOS_AIOS_NOTIFY_LIVE !== "1";
  const bridge = new NotificationLiveBridge(forceDryRun);
  const type: EventType =
    input.severity === "P0"
      ? "SYSTEM_CRITICAL"
      : input.severity === "P1"
        ? "SYSTEM_WARNING"
        : "SYSTEM_HEALTHY";
  try {
    const result = await bridge.forward(
      makeEvent(type, input.title, {
        message: input.message,
        ...input.meta,
      }),
    );
    return {
      ok: result.ok,
      dry_run: result.dry_run,
      error: result.error ?? undefined,
    };
  } catch (e) {
    return {
      ok: false,
      dry_run: forceDryRun,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}
