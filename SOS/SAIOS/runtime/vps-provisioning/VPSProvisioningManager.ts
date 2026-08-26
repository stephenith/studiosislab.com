/**
 * VPS Provisioning Manager — docs & assets only.
 * AGENT #114 — does not deploy; does not enable LIVE; reuses Deployment Package.
 */
import { existsSync } from "node:fs";
import { join } from "node:path";
import { buildBackupGuide } from "./BackupGuide.js";
import { buildDnsGuide } from "./DNSGuide.js";
import { buildEnvironmentSetupGuide } from "./EnvironmentSetupGuide.js";
import { buildFirewallGuide } from "./FirewallGuide.js";
import { buildMonitoringGuide } from "./MonitoringGuide.js";
import { buildNginxGuide } from "./NginxGuide.js";
import { buildPm2Guide } from "./PM2Guide.js";
import {
  buildChecklist,
  buildDeploymentSequence,
  renderChecklistMarkdown,
} from "./ProvisioningChecklist.js";
import {
  finalizeProvisioningJson,
  writeProvisioningReports,
} from "./ProvisioningReporter.js";
import { buildRecoveryGuide } from "./RecoveryGuide.js";
import { buildServerPreparationGuide } from "./ServerPreparationGuide.js";
import { buildSslGuide } from "./SSLGuide.js";
import { buildSystemdGuide } from "./SystemdGuide.js";
import {
  DEPLOYMENT_PACKAGE_ROOT,
  ensureProvisioningRoot,
  PROVISIONING_ROOT,
} from "./paths.js";
import type {
  InfrastructureEstimate,
  ServerSpec,
  VpsProvisioningResult,
} from "./types.js";

const PACKAGE_ASSETS = [
  "install.sh",
  "backup.sh",
  "restore.sh",
  "update.sh",
  "pm2.config.cjs",
  "aios.service",
  ".env.example",
  "healthcheck.js",
  "rotate-logs.sh",
] as const;

const REQUIRED_DOCS = [
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
] as const;

export function serverSpec(): ServerSpec {
  return {
    os: "Ubuntu 24.04 LTS",
    node: "22 LTS",
    process_managers: ["PM2", "systemd"],
    proxy: "Nginx",
    vcs: "Git",
    firewall: "UFW",
    intrusion: "Fail2Ban (recommended)",
    ssl: "Let's Encrypt",
    backups: "Automatic (cron + backup.sh)",
    log_rotation: "Automatic (rotate-logs.sh + logrotate)",
  };
}

export function infrastructureEstimate(): InfrastructureEstimate {
  return {
    minimum: {
      cpu: "2 vCPU",
      ram: "4 GB",
      disk: "60 GB SSD",
      bandwidth: "2 TB / month",
      monthly_usd: [12, 24],
    },
    recommended: {
      cpu: "4 vCPU",
      ram: "8 GB",
      disk: "160 GB SSD",
      bandwidth: "4–5 TB / month",
      monthly_usd: [40, 70],
    },
    node: "22 LTS",
    ubuntu: "24.04 LTS",
    capacity_note:
      "Recommended host supports continuous Runtime Loop/Supervisor, Next.js website, Telegram bridge, and ~1–3 months of SOS logs without aggressive rotation.",
  };
}

function packageReused(): boolean {
  return PACKAGE_ASSETS.every((f) =>
    existsSync(join(DEPLOYMENT_PACKAGE_ROOT, f)),
  );
}

export function verifyProvisioningArtifacts(
  result: VpsProvisioningResult,
): Record<string, boolean> {
  const docsOk = REQUIRED_DOCS.every((f) =>
    existsSync(join(PROVISIONING_ROOT, f)),
  );
  const seqOk =
    result.deployment_sequence.length === 14 &&
    result.deployment_sequence.every((s, i) => s.order === i + 1) &&
    result.deployment_sequence.every((s) => s.live_allowed === false);
  const checklistOk = result.checklist.length >= 10;
  const serverOk =
    result.server_spec.os.includes("24.04") &&
    result.server_spec.node.includes("22");
  const guidesOk = [
    "server-preparation.md",
    "environment-setup.md",
    "dns-configuration.md",
    "nginx-configuration.md",
    "ssl-configuration.md",
    "firewall-configuration.md",
    "pm2-configuration.md",
    "systemd-configuration.md",
  ].every((f) => existsSync(join(PROVISIONING_ROOT, f)));
  const runbookOk = existsSync(join(PROVISIONING_ROOT, "deployment-runbook.md"));
  const rollbackOk = existsSync(join(PROVISIONING_ROOT, "rollback-strategy.md"));
  const monitoringOk = existsSync(
    join(PROVISIONING_ROOT, "monitoring-strategy.md"),
  );
  const backupOk = existsSync(join(PROVISIONING_ROOT, "backup-strategy.md"));

  return {
    server_requirements: serverOk,
    deployment_documentation: docsOk && runbookOk,
    configuration_guides: guidesOk,
    runbook_completeness: seqOk && runbookOk,
    rollback_guide: rollbackOk,
    monitoring_guide: monitoringOk,
    backup_guide: backupOk,
    reports: docsOk && checklistOk && result.deployment_package_reused,
  };
}

export function runVpsProvisioning(): VpsProvisioningResult {
  const generated_at = new Date().toISOString();
  ensureProvisioningRoot();

  const checklist = buildChecklist();
  const deployment_sequence = buildDeploymentSequence();
  const deployment_package_reused = packageReused();
  const infrastructure = infrastructureEstimate();
  const server_spec = serverSpec();

  const { docs, result_partial } = writeProvisioningReports({
    generated_at,
    server_spec,
    deployment_sequence,
    checklist,
    checklist_md: renderChecklistMarkdown(checklist),
    server_preparation_md: buildServerPreparationGuide(),
    environment_setup_md: buildEnvironmentSetupGuide(),
    dns_md: buildDnsGuide(),
    nginx_md: buildNginxGuide(),
    ssl_md: buildSslGuide(),
    firewall_md: buildFirewallGuide(),
    pm2_md: buildPm2Guide(),
    systemd_md: buildSystemdGuide(),
    backup_md: buildBackupGuide(),
    monitoring_md: buildMonitoringGuide(),
    rollback_md: buildRecoveryGuide(),
    infrastructure,
    deployment_package_reused,
  });

  const draft: VpsProvisioningResult = {
    ...result_partial,
    docs,
    checks: {},
  };

  const checks = verifyProvisioningArtifacts(draft);
  const allPass = Object.values(checks).every(Boolean);

  const result: VpsProvisioningResult = {
    ...draft,
    status: allPass && deployment_package_reused ? "READY" : "DEGRADED",
    checks,
  };

  finalizeProvisioningJson(result);
  return result;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const r = runVpsProvisioning();
  console.log(
    `VPS Provisioning ${r.status} — docs=${r.docs.length} package_reused=${r.deployment_package_reused}`,
  );
}
