/**
 * Runtime Manager / heartbeat operational security.
 */
import { join } from "node:path";
import { REPO_ROOT, type SecurityConfiguration } from "./SecurityConfiguration.js";
import { readJsonSafe, sourceEntry } from "./security-utils.js";
import type { SecurityFinding } from "./types.js";

export function checkRuntimeSecurity(config: SecurityConfiguration): {
  findings: SecurityFinding[];
  sources: ReturnType<typeof sourceEntry>[];
  pass: boolean;
} {
  const healthPath = join(REPO_ROOT, "SOS/07_LOGS/saios/runtime-manager/runtime-health.json");
  const heartbeatPath = join(REPO_ROOT, "SOS/07_LOGS/saios/runtime-manager/runtime-heartbeat.json");
  const statePath = join(REPO_ROOT, "SOS/07_LOGS/saios/runtime-manager/runtime-state.json");
  const sources = [
    sourceEntry("runtime-health", healthPath),
    sourceEntry("runtime-heartbeat", heartbeatPath),
    sourceEntry("runtime-state", statePath),
  ];
  const findings: SecurityFinding[] = [];

  const health = readJsonSafe<{
    overall?: string;
    departments?: Array<{ id: string; available?: boolean; health?: string }>;
  }>(healthPath);
  const heartbeat = readJsonSafe<{
    generated_at?: string;
    failed_services?: string[];
    running_services?: string[];
  }>(heartbeatPath);
  const state = readJsonSafe<{ status?: string; department_count?: number }>(statePath);

  if (!health.ok) {
    findings.push({
      id: "runtime-health-missing",
      area: "runtime",
      level: "ORANGE",
      title: "Runtime health report missing",
      detail: healthPath,
      source: "runtime-manager",
      pass: false,
    });
  } else {
    const overall = health.data?.overall ?? "unknown";
    findings.push({
      id: "runtime-overall",
      area: "runtime",
      level: overall === "HEALTHY" ? "GREEN" : overall === "DEGRADED" ? "YELLOW" : "RED",
      title: `Runtime Manager health: ${overall}`,
      detail: `${health.data?.departments?.length ?? 0} departments reported`,
      source: "runtime-health.json",
      pass: overall === "HEALTHY" || overall === "DEGRADED",
    });
    const unavailable = (health.data?.departments ?? []).filter((d) => d.available === false);
    if (unavailable.length) {
      findings.push({
        id: "runtime-unavailable-depts",
        area: "runtime",
        level: "ORANGE",
        title: "Unavailable registered departments",
        detail: unavailable.map((d) => d.id).join(", "),
        source: "runtime-health.json",
        pass: false,
      });
    }
  }

  if (!heartbeat.ok || !heartbeat.data?.generated_at) {
    findings.push({
      id: "heartbeat-missing",
      area: "heartbeat",
      level: "RED",
      title: "Runtime heartbeat missing",
      detail: heartbeatPath,
      source: "runtime-manager",
      pass: false,
    });
  } else {
    const age = Date.now() - Date.parse(heartbeat.data.generated_at);
    const fresh = age <= config.heartbeat_stale_ms * 24; // allow long idle between agent runs
    findings.push({
      id: "heartbeat-freshness",
      area: "heartbeat",
      level: fresh ? "GREEN" : age > config.heartbeat_stale_ms * 100 ? "ORANGE" : "YELLOW",
      title: fresh ? "Heartbeat present" : "Heartbeat may be stale",
      detail: `age_ms=${age}; running=${heartbeat.data.running_services?.length ?? 0}; failed=${heartbeat.data.failed_services?.length ?? 0}`,
      source: "runtime-heartbeat.json",
      pass: true,
    });
  }

  if (state.ok) {
    findings.push({
      id: "runtime-state",
      area: "runtime",
      level: state.data?.status === "RUNNING" ? "GREEN" : "YELLOW",
      title: `Runtime state: ${state.data?.status ?? "unknown"}`,
      detail: `department_count=${state.data?.department_count ?? "?"}`,
      source: "runtime-state.json",
      pass: state.data?.status === "RUNNING" || state.data?.status === "PAUSED",
    });
  }

  return {
    findings,
    sources,
    pass: findings.filter((f) => !f.pass && (f.level === "RED" || f.level === "CRITICAL")).length === 0,
  };
}
