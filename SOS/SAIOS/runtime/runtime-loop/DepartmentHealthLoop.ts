/**
 * Department health probes — read existing logs / module availability only.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { REPO_ROOT } from "./LoopConfiguration.js";
import type { DepartmentHealth, DiscoveredDepartment } from "./types.js";

function readJson<T>(abs: string): T | null {
  if (!existsSync(abs)) return null;
  try {
    return JSON.parse(readFileSync(abs, "utf8")) as T;
  } catch {
    return null;
  }
}

function probeLogHealth(id: string): { health: DepartmentHealth["health"]; detail: string } | null {
  const candidates = [
    join(REPO_ROOT, "SOS/07_LOGS/saios", id, `${id.replace(/-department$/, "")}-health.json`),
    join(REPO_ROOT, "SOS/07_LOGS/saios", id, "security-health.json"),
    join(REPO_ROOT, "SOS/07_LOGS/saios", id, "website-health.json"),
    join(REPO_ROOT, "SOS/07_LOGS/saios", id, "timeline-state.json"),
    join(REPO_ROOT, "SOS/07_LOGS/saios", id, "runtime-health.json"),
    join(REPO_ROOT, "SOS/07_LOGS/saios", id, "event-registry.json"),
    join(REPO_ROOT, "SOS/07_LOGS/saios", id, "deployment-bundle.json"),
    join(REPO_ROOT, "SOS/07_LOGS/saios", id, "founder-control-center.json"),
    join(REPO_ROOT, "SOS/07_LOGS/saios", id, "live-monitoring.json"),
    join(REPO_ROOT, "SOS/07_LOGS/saios", "runtime-manager", "runtime-health.json"),
  ];

  // Prefer department-specific log dir
  const logDir = join(REPO_ROOT, "SOS/07_LOGS/saios", id);
  if (existsSync(logDir)) {
    const healthFiles = [
      "security-health.json",
      "website-health.json",
      "timeline-state.json",
      "notification-ledger-summary.json",
      "event-registry.json",
      "deployment-bundle.json",
      "founder-control-center.json",
      "live-monitoring.json",
      "dashboard.json",
      "runtime-health.json",
    ];
    for (const f of healthFiles) {
      const path = join(logDir, f);
      const data = readJson<Record<string, unknown>>(path);
      if (!data) continue;
      const status = String(
        data.security_level ?? data.status ?? data.overall ?? data.overall_health ?? "ok",
      ).toUpperCase();
      if (/CRITICAL|FAILED|DOWN|BLOCKED/.test(status)) {
        return { health: "failed", detail: `${f}: ${status}` };
      }
      if (/DEGRADED|ORANGE|WARNING|RED/.test(status)) {
        return { health: "degraded", detail: `${f}: ${status}` };
      }
      return { health: "ok", detail: `${f}: ${status}` };
    }
    return { health: "ok", detail: `log dir present: ${id}` };
  }

  for (const path of candidates) {
    if (existsSync(path)) return { health: "ok", detail: path };
  }
  return null;
}

export function checkDepartmentHealth(
  dept: DiscoveredDepartment,
): DepartmentHealth {
  if (!dept.available) {
    return {
      id: dept.id,
      health: "failed",
      available: false,
      detail: `module missing: ${dept.module_path}`,
    };
  }

  const probe = probeLogHealth(dept.id);
  if (probe) {
    return {
      id: dept.id,
      health: probe.health,
      available: true,
      detail: probe.detail,
    };
  }

  // Module exists but no logs yet — unknown/ok for orchestration
  return {
    id: dept.id,
    health: "unknown",
    available: true,
    detail: "module available; no health log yet",
  };
}

export function runDepartmentHealthLoop(
  departments: DiscoveredDepartment[],
): DepartmentHealth[] {
  return departments.map(checkDepartmentHealth);
}
