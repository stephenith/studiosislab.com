/**
 * Dependency graph integrity from Runtime Manager.
 */
import { join } from "node:path";
import { REPO_ROOT } from "./SecurityConfiguration.js";
import { readJsonSafe, sourceEntry } from "./security-utils.js";
import type { SecurityFinding } from "./types.js";

export function checkDependencyHealth(): {
  findings: SecurityFinding[];
  sources: ReturnType<typeof sourceEntry>[];
  pass: boolean;
} {
  const path = join(REPO_ROOT, "SOS/07_LOGS/saios/runtime-manager/runtime-dependencies.json");
  const sources = [sourceEntry("runtime-dependencies", path)];
  const data = readJsonSafe<{
    nodes?: Array<{ id: string; available?: boolean }>;
    startup_order?: string[];
    edges?: unknown[];
  }>(path);
  const findings: SecurityFinding[] = [];

  if (!data.ok) {
    findings.push({
      id: "deps-missing",
      area: "dependencies",
      level: "ORANGE",
      title: "Runtime dependency graph missing",
      detail: path,
      source: "runtime-manager",
      pass: false,
    });
    return { findings, sources, pass: false };
  }

  const nodes = data.data?.nodes ?? [];
  const unavailable = nodes.filter((n) => n.available === false);
  const order = data.data?.startup_order ?? [];

  findings.push({
    id: "deps-graph",
    area: "dependencies",
    level: unavailable.length ? "RED" : "GREEN",
    title: unavailable.length
      ? `Dependency graph has ${unavailable.length} unavailable node(s)`
      : "Dependency graph healthy",
    detail: `nodes=${nodes.length}; edges=${data.data?.edges?.length ?? 0}; order=${order.length}`,
    source: "runtime-dependencies.json",
    pass: unavailable.length === 0 && order.length > 0,
  });

  if (order[0] !== "factory-state") {
    findings.push({
      id: "deps-order",
      area: "dependencies",
      level: "YELLOW",
      title: "Unexpected startup order head",
      detail: `expected factory-state, got ${order[0] ?? "empty"}`,
      source: "runtime-dependencies.json",
      pass: true,
    });
  }

  return { findings, sources, pass: unavailable.length === 0 && order.length > 0 };
}
