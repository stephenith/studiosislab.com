/**
 * VPS Provisioning verify — documentation only, no deploy.
 * AGENT #114
 */
import { existsSync } from "node:fs";
import { join } from "node:path";
import { PROVISIONING_ROOT } from "./paths.js";
import { runVpsProvisioning } from "./VPSProvisioningManager.js";

const REQUIRED = [
  "vps-provisioning.json",
  "provisioning-checklist.md",
  "server-preparation.md",
  "environment-setup.md",
  "dns-configuration.md",
  "nginx-configuration.md",
  "ssl-configuration.md",
  "firewall-configuration.md",
  "pm2-configuration.md",
  "systemd-configuration.md",
  "backup-strategy.md",
  "monitoring-strategy.md",
  "rollback-strategy.md",
  "estimated-cost.md",
  "deployment-runbook.md",
];

function main(): void {
  const result = runVpsProvisioning();
  const reportsOk = REQUIRED.every((f) =>
    existsSync(join(PROVISIONING_ROOT, f)),
  );

  const checks = {
    server_requirements: result.checks.server_requirements,
    deployment_documentation: result.checks.deployment_documentation,
    configuration_guides: result.checks.configuration_guides,
    runbook_completeness: result.checks.runbook_completeness,
    rollback_guide: result.checks.rollback_guide,
    monitoring_guide: result.checks.monitoring_guide,
    backup_guide: result.checks.backup_guide,
    reports: result.checks.reports && reportsOk,
  };

  const allPass = Object.values(checks).every(Boolean);
  const rec = result.infrastructure.recommended;

  console.log(
    [
      "VPS Provisioning Verify",
      "=======================",
      ...Object.entries(checks).map(
        ([k, v]) => `${v ? "✔" : "✘"} ${k.replace(/_/g, " ")}`,
      ),
      "",
      `Status: ${result.status}`,
      `Docs: ${result.docs.length}`,
      `Sequence steps: ${result.deployment_sequence.length}`,
      `Deployment package reused: ${result.deployment_package_reused ? "yes" : "no"}`,
      `Deploy performed: no`,
      `LIVE enabled: no`,
      `VPS recommended: ${rec.cpu} / ${rec.ram} / ${rec.disk}`,
      `Est. monthly: $${rec.monthly_usd[0]}–$${rec.monthly_usd[1]}`,
      `Overall: ${allPass ? "PASS" : "FAIL"}`,
    ].join("\n"),
  );
  process.exit(allPass ? 0 : 1);
}

main();
