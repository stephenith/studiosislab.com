/**
 * Persist event-bus reports (JSON + markdown).
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { EVENT_BUS_ROOT } from "./EventConfiguration.js";
import { eventRegistryDocument } from "./EventRegistry.js";
import { departmentRoutingDocument } from "./DepartmentRouter.js";
import type { EventBusResult } from "./types.js";

export function writeEventReports(result: EventBusResult): void {
  mkdirSync(EVENT_BUS_ROOT, { recursive: true });

  writeFileSync(
    join(EVENT_BUS_ROOT, "event-registry.json"),
    JSON.stringify(eventRegistryDocument(result.generated_at), null, 2),
  );

  writeFileSync(
    join(EVENT_BUS_ROOT, "event-history.json"),
    JSON.stringify(
      {
        generated_at: result.generated_at,
        count: result.history.length,
        events: result.history,
        deliveries: result.deliveries,
        automation_traces: result.automation_traces,
      },
      null,
      2,
    ),
  );

  writeFileSync(
    join(EVENT_BUS_ROOT, "automation-rules.json"),
    JSON.stringify(
      {
        generated_at: result.generated_at,
        count: result.rules.length,
        enabled_count: result.rules.filter((r) => r.enabled).length,
        rules: result.rules,
      },
      null,
      2,
    ),
  );

  writeFileSync(
    join(EVENT_BUS_ROOT, "department-routing.json"),
    JSON.stringify(
      departmentRoutingDocument(result.departments, result.generated_at),
      null,
      2,
    ),
  );

  const report = [
    `# Event Bus Report`,
    ``,
    `AI OS internal communication backbone — Agent #105.`,
    `Departments communicate through events; no direct module-to-module calls.`,
    ``,
    `## Overall`,
    ``,
    `| Field | Value |`,
    `|---|---|`,
    `| Status | ${result.status} |`,
    `| Generated | ${result.generated_at} |`,
    `| Departments | ${result.departments.length} (${result.departments.filter((d) => d.available).length} available) |`,
    `| Events registered | ${result.events_registered.length} |`,
    `| Automation rules | ${result.rules.length} |`,
    `| History events | ${result.history.length} |`,
    `| Subscriptions | ${result.subscriptions.length} |`,
    `| Deliveries | ${result.deliveries.length} |`,
    ``,
    `## Checks`,
    ``,
    ...Object.entries(result.checks).map(
      ([k, v]) => `- ${k}: ${v ? "PASS" : "FAIL"}`,
    ),
    ``,
    `## Registered departments`,
    ``,
    ...result.departments.map(
      (d) =>
        `- **${d.label}** (\`${d.id}\`) — ${d.available ? "available" : "missing"} · subscribes: ${d.subscribed_events.join(", ")}`,
    ),
    ``,
    `## Registered events`,
    ``,
    ...result.events_registered.map((e) => `- \`${e}\``),
    ``,
    `## Automation rules`,
    ``,
    ...result.rules.map(
      (r) =>
        `- **${r.name}** (\`${r.id}\`) — trigger \`${r.trigger}\` → ${r.actions.map((a) => a.target_department).join(", ")}`,
    ),
    ``,
    `## Recent history`,
    ``,
    ...result.history
      .slice(-12)
      .map((e) => `- \`${e.type}\` from ${e.source} @ ${e.created_at}`),
    ``,
  ].join("\n");

  writeFileSync(join(EVENT_BUS_ROOT, "event-report.md"), report);
}
