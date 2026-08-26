/**
 * Founder Control Center verify.
 */
import { existsSync } from "node:fs";
import { join } from "node:path";
import { runFounderControlCenter } from "./FounderControlCenterDirector.js";
import { FCC_ROOT } from "./FounderControlConfiguration.js";

const REQUIRED_OUTPUTS = [
  "founder-control-center.json",
  "founder-dashboard.json",
  "founder-action-queue.json",
  "founder-summary.md",
  "morning-dashboard.md",
  "evening-dashboard.md",
  "founder-control-report.md",
];

function main(): void {
  const result = runFounderControlCenter();
  const reportsOk = REQUIRED_OUTPUTS.every((f) =>
    existsSync(join(FCC_ROOT, f)),
  );

  const checks = {
    runtime_aggregation: result.checks.runtime_aggregation,
    website_aggregation: result.checks.website_aggregation,
    timeline_aggregation: result.checks.timeline_aggregation,
    security_aggregation: result.checks.security_aggregation,
    notification_aggregation: result.checks.notification_aggregation,
    production_aggregation: result.checks.production_aggregation,
    release_aggregation: result.checks.release_aggregation,
    action_queue: result.checks.action_queue,
    reports: reportsOk,
  };

  const allPass = Object.values(checks).every(Boolean);
  console.log(
    [
      "Founder Control Center Verify",
      "=============================",
      ...Object.entries(checks).map(
        ([k, v]) => `${v ? "✔" : "✘"} ${k.replace(/_/g, " ")}`,
      ),
      "",
      `Status: ${result.status}`,
      `Overall health: ${result.dashboard.ai_os_status.overall_health}`,
      `Departments: ${result.departments.filter((d) => d.available).length}/${result.departments.length}`,
      `Actions: ${result.dashboard.action_queue.length}`,
      `Next: ${result.dashboard.recommended_next_action}`,
      `Overall: ${allPass ? "PASS" : "FAIL"}`,
    ].join("\n"),
  );
  process.exit(allPass ? 0 : 1);
}

main();
