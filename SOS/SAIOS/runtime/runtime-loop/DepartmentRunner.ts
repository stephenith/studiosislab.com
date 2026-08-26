/**
 * Department discovery — Runtime Manager first, then data-driven merges.
 * Never hardcodes department name lists in this module.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { discoverAndRegisterDepartments } from "../runtime-manager/RuntimeProcessRegistry.js";
import { REPO_ROOT } from "./LoopConfiguration.js";
import type { DiscoveredDepartment } from "./types.js";

function readJson<T>(rel: string): T | null {
  const path = join(REPO_ROOT, rel);
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf8")) as T;
  } catch {
    return null;
  }
}

export function discoverDepartments(): DiscoveredDepartment[] {
  const byId = new Map<string, DiscoveredDepartment>();

  for (const d of discoverAndRegisterDepartments()) {
    byId.set(d.id, {
      id: d.id,
      label: d.label,
      module_path: d.module_path,
      verify_command: d.verify_command,
      available: d.available,
      source: "runtime-manager",
    });
  }

  const health = readJson<{
    departments?: Array<{ id?: string; available?: boolean }>;
  }>("SOS/07_LOGS/saios/runtime-manager/runtime-health.json");
  for (const row of health?.departments ?? []) {
    const id = String(row.id ?? "");
    if (!id || byId.has(id)) continue;
    const module_path = `SOS/SAIOS/runtime/${id}`;
    byId.set(id, {
      id,
      label: id,
      module_path,
      verify_command: null,
      available: row.available ?? existsSync(join(REPO_ROOT, module_path)),
      source: "runtime-health",
    });
  }

  const plan = readJson<{
    departments?: Array<{
      id?: string;
      label?: string;
      module_path?: string;
      verify_command?: string;
      available?: boolean;
    }>;
  }>("SOS/07_LOGS/saios/deployment-manager/deployment-plan.json");
  for (const row of plan?.departments ?? []) {
    const id = String(row.id ?? "");
    if (!id) continue;
    const existing = byId.get(id);
    if (existing) {
      if (!existing.verify_command && row.verify_command) {
        existing.verify_command = row.verify_command;
      }
      continue;
    }
    const module_path = row.module_path ?? `SOS/SAIOS/runtime/${id}`;
    byId.set(id, {
      id,
      label: row.label ?? id,
      module_path,
      verify_command: row.verify_command ?? null,
      available: row.available ?? existsSync(join(REPO_ROOT, module_path)),
      source: "deployment-plan",
    });
  }

  return [...byId.values()];
}

export class DepartmentRunner {
  constructor(private departments: DiscoveredDepartment[] = discoverDepartments()) {}

  list(): DiscoveredDepartment[] {
    return [...this.departments];
  }

  refresh(): DiscoveredDepartment[] {
    this.departments = discoverDepartments();
    return this.list();
  }

  find(id: string): DiscoveredDepartment | undefined {
    return this.departments.find((d) => d.id === id);
  }
}
