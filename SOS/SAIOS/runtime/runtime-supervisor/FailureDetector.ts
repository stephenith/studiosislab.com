/**
 * Failure detector — cycle age, departments, security, website, event bus, runtime manager.
 */
import { isoAgeMs, readJsonSafe } from "./supervisor-utils.js";
import type {
  FailureFinding,
  HeartbeatStatus,
  SupervisorConfiguration,
} from "./types.js";

export function detectFailures(input: {
  config: SupervisorConfiguration;
  heartbeat: HeartbeatStatus;
}): FailureFinding[] {
  const findings: FailureFinding[] = [];
  const { config, heartbeat } = input;

  if (heartbeat.stale) {
    findings.push({
      id: "heartbeat-stale",
      area: "heartbeat",
      severity: "critical",
      title: "Runtime heartbeat stale",
      detail: `age_ms=${heartbeat.age_ms ?? "null"} timeout=${config.heartbeat_timeout_ms}`,
    });
  }

  const cycle = readJsonSafe<{
    finished_at?: string;
    started_at?: string;
    health?: Array<{ id?: string; health?: string; detail?: string }>;
  }>("SOS/07_LOGS/saios/runtime-loop/runtime-cycle.json");

  const cycleAt = cycle.data?.finished_at ?? cycle.data?.started_at;
  const cycleAge = isoAgeMs(cycleAt);
  if (cycleAge != null && cycleAge > config.cycle_age_timeout_ms) {
    findings.push({
      id: "cycle-age",
      area: "runtime-loop",
      severity: "warning",
      title: "Runtime Loop cycle age exceeded",
      detail: `age_ms=${cycleAge} timeout=${config.cycle_age_timeout_ms}`,
    });
  }

  for (const row of cycle.data?.health ?? []) {
    if (row.health === "failed") {
      findings.push({
        id: `dept-failed-${row.id}`,
        area: "department",
        severity: "critical",
        title: `Department failed: ${row.id}`,
        detail: String(row.detail ?? "failed"),
      });
    } else if (row.health === "degraded") {
      findings.push({
        id: `dept-degraded-${row.id}`,
        area: "department",
        severity: "warning",
        title: `Department degraded: ${row.id}`,
        detail: String(row.detail ?? "degraded"),
      });
    }
  }

  const security = readJsonSafe<{
    security_level?: string;
    status?: string;
  }>("SOS/07_LOGS/saios/security-department/security-health.json");
  const secLevel = String(security.data?.security_level ?? "").toUpperCase();
  if (secLevel === "CRITICAL" || secLevel === "RED") {
    findings.push({
      id: "security-critical",
      area: "security",
      severity: "critical",
      title: "Security status critical",
      detail: secLevel,
    });
  }

  const website = readJsonSafe<{ status?: string }>(
    "SOS/07_LOGS/saios/website-department/website-health.json",
  );
  const web = String(website.data?.status ?? "").toUpperCase();
  if (web === "DOWN" || web === "CRITICAL") {
    findings.push({
      id: "website-critical",
      area: "website",
      severity: "critical",
      title: "Website status critical",
      detail: web,
    });
  }

  const rm = readJsonSafe<{ status?: string; health?: string }>(
    "SOS/07_LOGS/saios/runtime-manager/runtime-state.json",
  );
  if (!rm.ok) {
    findings.push({
      id: "runtime-manager-missing",
      area: "runtime-manager",
      severity: "warning",
      title: "Runtime Manager state missing",
      detail: rm.path,
    });
  }

  const bus = readJsonSafe<{ count?: number }>(
    "SOS/07_LOGS/saios/event-bus/event-registry.json",
  );
  if (!bus.ok) {
    findings.push({
      id: "event-bus-missing",
      area: "event-bus",
      severity: "warning",
      title: "Event Bus registry missing",
      detail: bus.path,
    });
  }

  const sched = readJsonSafe<{ status?: string; health?: string }>(
    "SOS/07_LOGS/saios/scheduler/scheduler-health.json",
  );
  const schedStatus = String(
    sched.data?.status ?? sched.data?.health ?? "",
  ).toLowerCase();
  if (["failed", "stopped", "unhealthy"].includes(schedStatus)) {
    findings.push({
      id: "scheduler-unhealthy",
      area: "scheduler",
      severity: "warning",
      title: "Scheduler unhealthy",
      detail: schedStatus,
    });
  }

  return findings;
}
