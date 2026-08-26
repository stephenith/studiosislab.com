/**
 * Provisioning checklist — ordered operational gates.
 * AGENT #114
 */
import type { ChecklistItem, DeploymentStep } from "./types.js";

export function buildChecklist(): ChecklistItem[] {
  return [
    {
      id: "chk-vps",
      phase: "provision",
      title: "VPS provisioned (Ubuntu 24.04 LTS)",
      required: true,
      references_deployment_package: false,
    },
    {
      id: "chk-packages",
      phase: "prepare",
      title: "Base packages installed (Node 22, Git, Nginx, UFW, Fail2Ban)",
      required: true,
      references_deployment_package: false,
    },
    {
      id: "chk-clone",
      phase: "prepare",
      title: "Repository cloned to /opt/aios",
      required: true,
      references_deployment_package: false,
    },
    {
      id: "chk-env",
      phase: "configure",
      title: "SOS/runtime/.env created from deployment-package/.env.example",
      required: true,
      references_deployment_package: true,
    },
    {
      id: "chk-live-off",
      phase: "configure",
      title: "SOS_AIOS_LIVE=0 and notify LIVE flags remain off",
      required: true,
      references_deployment_package: true,
    },
    {
      id: "chk-install",
      phase: "install",
      title: "install.sh executed successfully",
      required: true,
      references_deployment_package: true,
    },
    {
      id: "chk-nginx-ssl",
      phase: "configure",
      title: "Nginx + Let's Encrypt configured",
      required: true,
      references_deployment_package: false,
    },
    {
      id: "chk-firewall",
      phase: "secure",
      title: "UFW + Fail2Ban active",
      required: true,
      references_deployment_package: false,
    },
    {
      id: "chk-pm2-or-systemd",
      phase: "runtime",
      title: "PM2 or systemd unit installed (SOS_AIOS_LIVE=0)",
      required: true,
      references_deployment_package: true,
    },
    {
      id: "chk-verify-mode",
      phase: "verify",
      title: "VERIFY mode smoke tests pass",
      required: true,
      references_deployment_package: false,
    },
    {
      id: "chk-dry-run",
      phase: "verify",
      title: "DRY_RUN mode smoke tests pass",
      required: true,
      references_deployment_package: false,
    },
    {
      id: "chk-backup",
      phase: "ops",
      title: "backup.sh + log rotation scheduled",
      required: true,
      references_deployment_package: true,
    },
    {
      id: "chk-founder-live",
      phase: "gate",
      title: "LIVE mode only after explicit founder approval",
      required: true,
      references_deployment_package: false,
    },
  ];
}

export function buildDeploymentSequence(): DeploymentStep[] {
  return [
    {
      order: 1,
      title: "Provision VPS",
      detail:
        "Create Ubuntu 24.04 LTS host (recommended 4 vCPU / 8 GB / 160 GB). Create non-root deploy user with sudo.",
      live_allowed: false,
    },
    {
      order: 2,
      title: "Install packages",
      detail:
        "Install Node 22 LTS, Git, Nginx, UFW, Fail2Ban, certbot, PM2 (global). Enable automatic security updates.",
      live_allowed: false,
    },
    {
      order: 3,
      title: "Clone repository",
      detail: "Clone studiosislab into /opt/aios and chown to deploy user.",
      live_allowed: false,
    },
    {
      order: 4,
      title: "Configure environment",
      detail:
        "Copy SOS/07_LOGS/saios/deployment-package/.env.example → SOS/runtime/.env. Fill Telegram/email secrets. Keep SOS_AIOS_LIVE=0.",
      live_allowed: false,
    },
    {
      order: 5,
      title: "Run install.sh",
      detail:
        "Execute SOS/07_LOGS/saios/deployment-package/install.sh from repo root.",
      verify_command: "bash SOS/07_LOGS/saios/deployment-package/install.sh",
      live_allowed: false,
    },
    {
      order: 6,
      title: "Verify Runtime Manager",
      detail: "Confirm runtime manager surfaces and health assets exist.",
      verify_command: "npm run deployment-package:verify",
      live_allowed: false,
    },
    {
      order: 7,
      title: "Verify Runtime Loop",
      detail: "Run loop verify (dry-run, max 1 cycle).",
      verify_command: "npm run runtime-loop:verify",
      live_allowed: false,
    },
    {
      order: 8,
      title: "Verify Runtime Supervisor",
      detail: "Run supervisor verify (dry-run).",
      verify_command: "npm run runtime-supervisor:verify",
      live_allowed: false,
    },
    {
      order: 9,
      title: "Verify departments",
      detail:
        "Run website, notification, timeline, security, event-bus, live-monitoring verifies as available.",
      live_allowed: false,
    },
    {
      order: 10,
      title: "Verify Founder Control Center",
      detail: "Confirm founder gate and HQ aggregate reports.",
      verify_command: "npm run founder-control-center:verify",
      live_allowed: false,
    },
    {
      order: 11,
      title: "Run in VERIFY mode",
      detail: "npm run live-runtime:verify — gate must pass; LIVE denied.",
      verify_command: "npm run live-runtime:verify",
      live_allowed: false,
    },
    {
      order: 12,
      title: "Run in DRY_RUN mode",
      detail:
        "Keep SOS_SUPERVISOR_DRY_RUN=true and SOS_RUNTIME_LOOP_DRY_RUN=true; exercise one supervised cycle.",
      live_allowed: false,
    },
    {
      order: 13,
      title: "Perform smoke tests",
      detail:
        "Healthcheck.js, Nginx proxy, SSL, Telegram dry-run bridge, backup/restore dry scripts, log rotation.",
      verify_command: "node SOS/07_LOGS/saios/deployment-package/healthcheck.js",
      live_allowed: false,
    },
    {
      order: 14,
      title: "LIVE mode only after founder approval",
      detail:
        "Do not set SOS_AIOS_LIVE=1 until Founder Gate + monitoring proven and founder explicitly approves.",
      live_allowed: false,
    },
  ];
}

export function renderChecklistMarkdown(items: ChecklistItem[]): string {
  const lines = [
    "# Provisioning Checklist",
    "",
    "Operational gates for first VPS install. **Do not enable LIVE** until the final gate.",
    "",
    "| ID | Phase | Required | Uses deployment package | Item |",
    "|---|---|---|---|---|",
    ...items.map(
      (i) =>
        `| ${i.id} | ${i.phase} | ${i.required ? "yes" : "no"} | ${i.references_deployment_package ? "yes" : "no"} | ${i.title} |`,
    ),
    "",
  ];
  return lines.join("\n");
}
