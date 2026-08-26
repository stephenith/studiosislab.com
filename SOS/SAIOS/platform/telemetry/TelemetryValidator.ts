/**
 * TelemetryValidator — Agent #183.
 */
import { rejectForbiddenKeys } from "../checksums/index.js";
import type {
  TelemetryCorrelationContract,
  TelemetrySessionContract,
  TelemetryTimelineContract,
  TelemetryValidationIssue,
  TelemetryValidationResult,
} from "./TelemetryTypes.js";
import { computeTelemetrySessionChecksum } from "./TelemetrySession.js";
import { computeTimelineChecksum } from "./TelemetryTimeline.js";
import { computeCorrelationChecksum } from "./TelemetryCorrelation.js";

export const TELEMETRY_FORBIDDEN_KEYS = [
  "execute",
  "dispatch",
  "scheduler",
  "enqueue",
  "spawn",
  "provider",
  "publish",
  "enable_live",
  "collect",
  "emit",
  "stream",
] as const;

export function rejectForbiddenTelemetryPayload(
  payload: Record<string, unknown>,
): TelemetryValidationIssue | null {
  return rejectForbiddenKeys(payload, TELEMETRY_FORBIDDEN_KEYS, {
    messageForKey: (key) => `Field '${key}' is forbidden on telemetry`,
  });
}

export function validateTelemetrySession(
  session: TelemetrySessionContract | null,
): TelemetryValidationResult {
  const errors: TelemetryValidationIssue[] = [];
  if (!session) {
    return {
      ok: false,
      errors: [{ code: "SESSION_MISSING", message: "Telemetry session missing" }],
    };
  }
  const forbidden = rejectForbiddenTelemetryPayload(
    session as unknown as Record<string, unknown>,
  );
  if (forbidden) errors.push(forbidden);

  if (session.schema_version !== "telemetry-session-1.0.0") {
    errors.push({
      code: "BAD_SCHEMA",
      message: "schema must be telemetry-session-1.0.0",
      field: "schema_version",
    });
  }
  if (!session.mission_id?.trim()) {
    errors.push({
      code: "MISSING_MISSION",
      message: "mission_id required",
      field: "mission_id",
    });
  }
  if (session.collection_enabled !== false) {
    errors.push({
      code: "COLLECTION_UNLOCKED",
      message: "collection_enabled must be false",
      field: "collection_enabled",
    });
  }
  if (session.emission_enabled !== false) {
    errors.push({
      code: "EMISSION_UNLOCKED",
      message: "emission_enabled must be false",
      field: "emission_enabled",
    });
  }
  if (session.safety_flags.live_enabled !== false) {
    errors.push({
      code: "LIVE_UNLOCKED",
      message: "live_enabled must be false",
      field: "safety_flags",
    });
  }
  if (session.safety_flags.execution_allowed !== false) {
    errors.push({
      code: "EXECUTION_UNLOCKED",
      message: "execution_allowed must be false",
      field: "safety_flags",
    });
  }

  const expected = computeTelemetrySessionChecksum({
    ...session,
    checksums: { ...session.checksums, session_checksum: "" },
  });
  if (session.checksums.session_checksum !== expected) {
    errors.push({
      code: "SESSION_CHECKSUM_INVALID",
      message: "session checksum mismatch",
      field: "checksums",
    });
  }

  return { ok: errors.length === 0, errors };
}

export function validateTelemetryTimeline(
  timeline: TelemetryTimelineContract | null,
): TelemetryValidationResult {
  const errors: TelemetryValidationIssue[] = [];
  if (!timeline) {
    return {
      ok: false,
      errors: [{ code: "TIMELINE_MISSING", message: "Timeline missing" }],
    };
  }
  if (timeline.activated !== false) {
    errors.push({
      code: "TIMELINE_ACTIVATED",
      message: "timeline must not be activated",
      field: "activated",
    });
  }
  const expected = computeTimelineChecksum({
    ...timeline,
    timeline_checksum: "",
  });
  if (timeline.timeline_checksum !== expected) {
    errors.push({
      code: "TIMELINE_CHECKSUM_INVALID",
      message: "timeline checksum mismatch",
      field: "timeline_checksum",
    });
  }
  return { ok: errors.length === 0, errors };
}

export function validateTelemetryCorrelation(
  correlation: TelemetryCorrelationContract | null,
): TelemetryValidationResult {
  const errors: TelemetryValidationIssue[] = [];
  if (!correlation) {
    return {
      ok: false,
      errors: [{ code: "CORRELATION_MISSING", message: "Correlation missing" }],
    };
  }
  if (correlation.linked_at_runtime !== false) {
    errors.push({
      code: "RUNTIME_LINKED",
      message: "linked_at_runtime must be false",
      field: "linked_at_runtime",
    });
  }
  const expected = computeCorrelationChecksum({
    ...correlation,
    correlation_checksum: "",
  });
  if (correlation.correlation_checksum !== expected) {
    errors.push({
      code: "CORRELATION_CHECKSUM_INVALID",
      message: "correlation checksum mismatch",
      field: "correlation_checksum",
    });
  }
  return { ok: errors.length === 0, errors };
}
