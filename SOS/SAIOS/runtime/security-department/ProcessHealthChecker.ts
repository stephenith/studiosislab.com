/**
 * Process availability from Runtime Manager registry.
 */
import { join } from "node:path";
import { REPO_ROOT } from "./SecurityConfiguration.js";
import { readJsonSafe, sourceEntry } from "./security-utils.js";
import type { SecurityFinding } from "./types.js";

export function checkProcessHealth(): {
  findings: SecurityFinding[];
  sources: ReturnType<typeof sourceEntry>[];
  pass: boolean;
} {
  const path = join(REPO_ROOT, "SOS/07_LOGS/saios/runtime-manager/runtime-processes.json");
  const sources = [sourceEntry("runtime-processes", path)];
  const data = readJsonSafe<{
    processes?: Array<{ id: string; state: string; last_health: string }>;
  }>(path);
  const findings: SecurityFinding[] = [];

  if (!data.ok) {
    findings.push({
      id: "processes-missing",
      area: "processes",
      level: "ORANGE",
      title: "Runtime process registry missing",
      detail: path,
      source: "runtime-manager",
      pass: false,
    });
    return { findings, sources, pass: false };
  }

  const processes = data.data?.processes ?? [];
  const failed = processes.filter((p) => p.state === "FAILED" || p.last_health === "failed");
  const running = processes.filter((p) => p.state === "RUNNING");

  findings.push({
    id: "processes-running",
    area: "processes",
    level: failed.length ? "ORANGE" : "GREEN",
    title: `${running.length} running / ${failed.length} failed processes`,
    detail: failed.map((p) => p.id).join(", ") || "none failed",
    source: "runtime-processes.json",
    pass: failed.length === 0,
  });

  return { findings, sources, pass: failed.length === 0 };
}
