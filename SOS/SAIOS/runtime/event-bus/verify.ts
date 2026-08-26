/**
 * Event Bus verify — overall PASS when core bus capabilities hold.
 */
import { existsSync } from "node:fs";
import { join } from "node:path";
import { runEventBusAsync } from "./EventBus.js";
import { EVENT_BUS_ROOT } from "./EventConfiguration.js";

const REQUIRED_OUTPUTS = [
  "event-registry.json",
  "event-history.json",
  "automation-rules.json",
  "department-routing.json",
  "event-report.md",
];

async function main(): Promise<void> {
  const result = await runEventBusAsync();

  const reportsOk = REQUIRED_OUTPUTS.every((f) =>
    existsSync(join(EVENT_BUS_ROOT, f)),
  );

  const checks = {
    publish: result.checks.publish,
    subscribe: result.checks.subscribe,
    routing: result.checks.routing,
    automation: result.checks.automation,
    event_history: result.checks.event_history,
    department_registration: result.checks.department_registration,
    reports: reportsOk,
  };

  const allPass = Object.values(checks).every(Boolean);
  const lines = [
    "Event Bus Verify",
    "================",
    ...Object.entries(checks).map(
      ([k, v]) => `${v ? "✔" : "✘"} ${k.replace(/_/g, " ")}`,
    ),
    "",
    `Status: ${result.status}`,
    `Departments: ${result.departments.length} (${result.departments.filter((d) => d.available).length} available)`,
    `Events registered: ${result.events_registered.length}`,
    `Automation rules: ${result.rules.length}`,
    `History: ${result.history.length}`,
    `Overall: ${allPass ? "PASS" : "FAIL"}`,
  ];
  console.log(lines.join("\n"));
  process.exit(allPass ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
