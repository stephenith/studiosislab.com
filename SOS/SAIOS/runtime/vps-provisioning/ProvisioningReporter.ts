/**
 * Writes all VPS provisioning reports under SOS/07_LOGS/saios/vps-provisioning/.
 * AGENT #114
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { ensureProvisioningRoot, PROVISIONING_ROOT } from "./paths.js";
import type {
  DeploymentStep,
  GeneratedDoc,
  VpsProvisioningResult,
} from "./types.js";

function writeDoc(name: string, contents: string, kind: string): GeneratedDoc {
  const path = join(PROVISIONING_ROOT, name);
  writeFileSync(path, contents.endsWith("\n") ? contents : `${contents}\n`);
  return { name, path, kind };
}

export function writeProvisioningReports(input: {
  generated_at: string;
  server_spec: VpsProvisioningResult["server_spec"];
  deployment_sequence: DeploymentStep[];
  checklist_md: string;
  server_preparation_md: string;
  environment_setup_md: string;
  dns_md: string;
  nginx_md: string;
  ssl_md: string;
  firewall_md: string;
  pm2_md: string;
  systemd_md: string;
  backup_md: string;
  monitoring_md: string;
  rollback_md: string;
  infrastructure: VpsProvisioningResult["infrastructure"];
  checklist: VpsProvisioningResult["checklist"];
  deployment_package_reused: boolean;
}): {
  docs: GeneratedDoc[];
  result_partial: Omit<VpsProvisioningResult, "checks" | "status"> & {
    status: "READY";
  };
} {
  ensureProvisioningRoot();

  const docs: GeneratedDoc[] = [];

  docs.push(writeDoc("provisioning-checklist.md", input.checklist_md, "checklist"));
  docs.push(writeDoc("server-preparation.md", input.server_preparation_md, "guide"));
  docs.push(writeDoc("environment-setup.md", input.environment_setup_md, "guide"));
  docs.push(writeDoc("dns-configuration.md", input.dns_md, "guide"));
  docs.push(writeDoc("nginx-configuration.md", input.nginx_md, "guide"));
  docs.push(writeDoc("ssl-configuration.md", input.ssl_md, "guide"));
  docs.push(writeDoc("firewall-configuration.md", input.firewall_md, "guide"));
  docs.push(writeDoc("pm2-configuration.md", input.pm2_md, "guide"));
  docs.push(writeDoc("systemd-configuration.md", input.systemd_md, "guide"));
  docs.push(writeDoc("backup-strategy.md", input.backup_md, "guide"));
  docs.push(writeDoc("monitoring-strategy.md", input.monitoring_md, "guide"));
  docs.push(writeDoc("rollback-strategy.md", input.rollback_md, "guide"));

  const costMd = [
    "# Estimated Cost",
    "",
    "## Monthly infrastructure",
    "",
    `| Tier | CPU | RAM | Disk | Bandwidth | Est. USD/mo |`,
    `|---|---|---|---|---|---|`,
    `| Minimum | ${input.infrastructure.minimum.cpu} | ${input.infrastructure.minimum.ram} | ${input.infrastructure.minimum.disk} | ${input.infrastructure.minimum.bandwidth} | $${input.infrastructure.minimum.monthly_usd[0]}–$${input.infrastructure.minimum.monthly_usd[1]} |`,
    `| Recommended | ${input.infrastructure.recommended.cpu} | ${input.infrastructure.recommended.ram} | ${input.infrastructure.recommended.disk} | ${input.infrastructure.recommended.bandwidth} | $${input.infrastructure.recommended.monthly_usd[0]}–$${input.infrastructure.recommended.monthly_usd[1]} |`,
    "",
    `Node: **${input.infrastructure.node}** · Ubuntu: **${input.infrastructure.ubuntu}**`,
    "",
    input.infrastructure.capacity_note,
    "",
    "## Notes",
    "",
    "- Costs exclude domain, object-storage backups, and paid Telegram/email extras.",
    "- Prefer recommended tier if website + continuous supervisor + logs coexist.",
    "",
  ].join("\n");
  docs.push(writeDoc("estimated-cost.md", costMd, "estimate"));

  const runbookMd = [
    "# Deployment Runbook",
    "",
    "First VPS installation — **documentation only**. Do not deploy from this agent.",
    "",
    "## Safety",
    "",
    "- \`SOS_AIOS_LIVE=0\` at all times until founder approval (step 14).",
    "- Reuse Deployment Package assets under \`SOS/07_LOGS/saios/deployment-package/\`.",
    "- Do not modify Runtime Manager / Loop / Supervisor / Resume Factory.",
    "",
    "## Exact sequence",
    "",
    ...input.deployment_sequence.map((s) => {
      const cmd = s.verify_command ? `\n   - Verify: \`${s.verify_command}\`` : "";
      return `${s.order}. **${s.title}**\n   - ${s.detail}${cmd}\n   - LIVE allowed: **no**`;
    }),
    "",
    "## Post-install verify suite",
    "",
    "\`\`\`bash",
    "npm run deployment-package:verify",
    "npm run deployment-readiness:verify",
    "npm run vps-provisioning:verify",
    "npm run runtime-loop:verify",
    "npm run runtime-supervisor:verify",
    "npm run live-runtime:verify",
    "npm run founder-control-center:verify",
    "\`\`\`",
    "",
  ].join("\n");
  docs.push(writeDoc("deployment-runbook.md", runbookMd, "runbook"));

  const result_partial = {
    generated_at: input.generated_at,
    status: "READY" as const,
    agent: "114" as const,
    server_spec: input.server_spec,
    deployment_sequence: input.deployment_sequence,
    checklist: input.checklist,
    infrastructure: input.infrastructure,
    docs: [] as GeneratedDoc[],
    deployment_package_reused: input.deployment_package_reused,
    deploy_performed: false as const,
    live_enabled: false as const,
    output_dir: PROVISIONING_ROOT,
  };

  const jsonBody = {
    ...result_partial,
    docs: docs.map((d) => ({ name: d.name, path: d.path, kind: d.kind })),
    checks: {},
  };

  docs.push(
    writeDoc(
      "vps-provisioning.json",
      JSON.stringify(jsonBody, null, 2),
      "manifest",
    ),
  );

  result_partial.docs = docs;
  return { docs, result_partial };
}

export function finalizeProvisioningJson(
  result: VpsProvisioningResult,
): void {
  writeFileSync(
    join(PROVISIONING_ROOT, "vps-provisioning.json"),
    `${JSON.stringify(result, null, 2)}\n`,
  );
}
