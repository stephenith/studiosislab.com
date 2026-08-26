/**
 * TelemetryEvent — catalogue metadata only (Agent #183).
 * No events are emitted.
 */
import { randomUUID } from "node:crypto";
import type {
  TelemetryEventCatalogueEntry,
  TelemetryEventKind,
  TelemetryEventRecord,
} from "./TelemetryTypes.js";
import { TELEMETRY_EVENT_CATALOGUE } from "./TelemetryTypes.js";

export function listEventCatalogue(): TelemetryEventCatalogueEntry[] {
  return [...TELEMETRY_EVENT_CATALOGUE];
}

export function defineCatalogueEvent(
  kind: TelemetryEventKind,
  summary: string,
  sessionId?: string | null,
): TelemetryEventRecord {
  return {
    event_id: `teve-${randomUUID().slice(0, 8)}`,
    event_kind: kind,
    telemetry_session_id: sessionId ?? null,
    at: null,
    summary,
    emitted: false,
  };
}

export class TelemetryEvent {
  readonly record: TelemetryEventRecord;

  constructor(record: TelemetryEventRecord) {
    this.record = record;
  }

  isEmitted(): false {
    return false;
  }
}
