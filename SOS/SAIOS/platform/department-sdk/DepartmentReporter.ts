/**
 * DepartmentReporter — markdown summary (Agent #180).
 */
import { join } from "node:path";
import { BaseMarkdownReporter } from "../reporters/BaseMarkdownReporter.js";
import type { DepartmentRegistry } from "./DepartmentRegistry.js";

export class DepartmentReporter {
  private readonly base = new BaseMarkdownReporter();

  writeMarkdown(registry: DepartmentRegistry): string {
    const health = registry.buildHealth();
    const list = registry.list();
    const listLines = list.map(
      (d) =>
        `- ${d.department_id} · ${d.department_name} · ${d.status} · managers=${d.managers.length} · workers=${d.workers.length} · caps=${d.capabilities.length}${d.reference ? " · REFERENCE" : ""}${d.placeholder ? " · placeholder" : ""}`,
    );
    return this.base.writeSimple({
      dir: registry.dir,
      filename: "DEPARTMENT_REGISTRY_LOG.md",
      title: "Department SDK Registry Log",
      headerLines: [
        `Updated: ${new Date().toISOString()}`,
        `Mode: department_sdk_contracts_only · execution_allowed=false · LIVE OFF`,
        "",
        `Registered: ${list.length}`,
        `Ready: ${health.ready_count}`,
        `Placeholders: ${list.filter((d) => d.placeholder).length}`,
        "",
        `Log path: ${join(registry.dir, "DEPARTMENT_REGISTRY_LOG.md")}`,
      ],
      listHeading: "Departments",
      listLines,
    });
  }
}
