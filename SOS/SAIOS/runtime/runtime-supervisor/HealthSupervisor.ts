/**
 * Health supervisor — aggregate monitored surfaces.
 */
import { fileAgeMs, readJsonSafe } from "./supervisor-utils.js";
import type { SupervisorConfiguration } from "./types.js";

export type HealthSnapshot = {
  runtime_manager: string;
  runtime_loop: string;
  event_bus: string;
  security: string;
  website: string;
  timeline: string;
  notification: string;
  founder_control_center: string;
  scheduler: string;
  fcc_age_ms: number | null;
  notification_age_ms: number | null;
  website_age_ms: number | null;
};

export function collectHealthSnapshot(
  _config: SupervisorConfiguration,
): HealthSnapshot {
  const ops = readJsonSafe<{
    operations?: Record<string, { status?: string; health?: string; security_level?: string }>;
  }>("SOS/project-state.json").data?.operations ?? {};

  const loop = readJsonSafe<{ status?: string }>(
    "SOS/07_LOGS/saios/runtime-loop/runtime-loop.json",
  );
  const security = readJsonSafe<{ security_level?: string; status?: string }>(
    "SOS/07_LOGS/saios/security-department/security-health.json",
  );
  const website = readJsonSafe<{ status?: string }>(
    "SOS/07_LOGS/saios/website-department/website-health.json",
  );

  return {
    runtime_manager: String(ops.runtime_manager?.status ?? "UNKNOWN"),
    runtime_loop: String(loop.data?.status ?? ops.runtime_loop?.status ?? "UNKNOWN"),
    event_bus: String(ops.event_bus?.status ?? "UNKNOWN"),
    security: String(
      security.data?.security_level ?? ops.security_department?.status ?? "UNKNOWN",
    ),
    website: String(website.data?.status ?? ops.website_department?.status ?? "UNKNOWN"),
    timeline: String(ops.timeline_department?.status ?? "UNKNOWN"),
    notification: String(ops.notification_department?.status ?? "UNKNOWN"),
    founder_control_center: String(ops.founder_control_center?.status ?? "UNKNOWN"),
    scheduler: "observed",
    fcc_age_ms: fileAgeMs(
      "SOS/07_LOGS/saios/founder-control-center/founder-control-center.json",
    ),
    notification_age_ms: fileAgeMs(
      "SOS/07_LOGS/saios/notification-department/notification-report.md",
    ),
    website_age_ms: fileAgeMs(
      "SOS/07_LOGS/saios/website-department/website-health.json",
    ),
  };
}
