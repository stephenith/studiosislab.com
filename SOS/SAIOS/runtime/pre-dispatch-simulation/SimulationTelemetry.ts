/**
 * SimulationTelemetry — Agent #187.
 * Reference sessions only. No emission / collection.
 */
import type { SimulationTelemetryRef } from "./SimulationTypes.js";

export function buildTelemetryRefs(input?: {
  telemetry_session_ids?: string[];
}): SimulationTelemetryRef[] {
  const ids = input?.telemetry_session_ids?.length
    ? input.telemetry_session_ids
    : ["telemetry-session-ref"];
  return ids.map((telemetry_session_id) => ({
    telemetry_session_id,
    referenced: true as const,
    events_emitted: false as const,
    collection_enabled: false as const,
  }));
}

export function assertTelemetryIntegrity(
  refs: SimulationTelemetryRef[],
): boolean {
  return refs.every(
    (r) =>
      r.referenced === true &&
      r.events_emitted === false &&
      r.collection_enabled === false,
  );
}
