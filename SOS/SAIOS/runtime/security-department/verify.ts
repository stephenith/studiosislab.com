/**
 * Security Department verify — overall PASS when core checks hold.
 */
import { existsSync } from "node:fs";
import { join } from "node:path";
import { runSecurityDepartment } from "./SecurityDepartmentDirector.js";
import { SECURITY_DEPARTMENT_ROOT } from "./SecurityConfiguration.js";

const REQUIRED_OUTPUTS = [
  "security-health.json",
  "security-risks.json",
  "security-alerts.json",
  "security-checklist.json",
  "security-summary.md",
  "security-report.md",
];

function main(): void {
  const result = runSecurityDepartment();

  const reportsOk = REQUIRED_OUTPUTS.every((f) =>
    existsSync(join(SECURITY_DEPARTMENT_ROOT, f)),
  );

  const checks = {
    runtime_security: result.checks.runtime_security,
    filesystem: result.checks.filesystem,
    environment: result.checks.environment,
    heartbeat: result.checks.heartbeat,
    dependencies: result.checks.dependencies,
    publication_safety: result.checks.publication_safety,
    backup_metadata: result.checks.backup_metadata,
    report_generation: reportsOk,
  };

  const allPass = Object.values(checks).every(Boolean);
  const lines = [
    "Security Department Verify",
    "==========================",
    ...Object.entries(checks).map(
      ([k, v]) => `${v ? "✔" : "✘"} ${k.replace(/_/g, " ")}`,
    ),
    "",
    `Status: ${result.status}`,
    `Security level: ${result.security_level}`,
    `Alerts (not sent): ${result.alerts.length}`,
    `Overall: ${allPass ? "PASS" : "FAIL"}`,
  ];
  console.log(lines.join("\n"));
  process.exit(allPass ? 0 : 1);
}

main();
