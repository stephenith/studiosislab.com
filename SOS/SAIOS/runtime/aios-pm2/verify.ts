/**
 * AIOS PM2 runtime promotion verify — Agent #116.
 * No API calls. No resume generation. No publication. No VPS actions.
 */
import { createRequire } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const require = createRequire(import.meta.url);
const REPO = resolve(import.meta.dirname, "../../../..");
const INFRA = join(REPO, "SOS/SAIOS/infra");
const LOG = join(REPO, "SOS/07_LOGS/saios/pm2-runtime-promotion");
const REPORT = join(REPO, "SOS/09_REPORTS/AIOS_PM2_RUNTIME_PROMOTION_V1_REPORT.md");

const TARGET = [
  "aios-orchestrator",
  "aios-scheduler",
  "aios-resume-worker",
  "aios-render-worker",
  "aios-qa-worker",
  "aios-supervisor",
  "aios-telegram",
  "aios-dashboard",
];

const INFRA_FILES = [
  "pm2.config.cjs",
  "aios-processes.json",
  "department-enablement.json",
  "runtime-environment.example",
  "process-health-contract.json",
  "startup-order.json",
  "shutdown-order.json",
  "README.md",
];

const LOG_FILES = [
  "pm2-readiness.json",
  "process-entrypoint-audit.json",
  "department-enablement.json",
  "temporary-website-process-plan.md",
  "vps-command-plan.md",
  "promotion-summary.md",
];

function looksLikeSecret(line: string): boolean {
  const t = line.trim();
  if (!t || t.startsWith("#")) return false;
  const m = t.match(/^[A-Z0-9_]+=(.*)$/);
  if (!m) return false;
  const v = m[1].trim();
  if (!v) return false;
  if (/^(0|1|production|Asia\/Kolkata|\/opt\/aios|SOS <)/.test(v)) return false;
  if (v.length > 20 && /[A-Za-z0-9_\-]{20,}/.test(v)) return true;
  if (/^sk-|^re_|^ghp_|^AIza/.test(v)) return true;
  return false;
}

function main(): void {
  const infraOk = INFRA_FILES.every((f) => existsSync(join(INFRA, f)));
  const pm2Path = join(INFRA, "pm2.config.cjs");
  const pm2Mod = require(pm2Path) as { apps: Array<Record<string, unknown>> };
  const apps = pm2Mod.apps || [];
  const names = apps.map((a) => String(a.name));
  const eightRepresented = TARGET.every((n) => names.includes(n));

  const processes = JSON.parse(
    readFileSync(join(INFRA, "aios-processes.json"), "utf8"),
  );
  const audit = JSON.parse(
    readFileSync(join(LOG, "process-entrypoint-audit.json"), "utf8"),
  );
  const dept = JSON.parse(
    readFileSync(join(INFRA, "department-enablement.json"), "utf8"),
  );
  const readiness = JSON.parse(
    readFileSync(join(LOG, "pm2-readiness.json"), "utf8"),
  );

  const entrypointsAudited =
    Array.isArray(audit.audit) && audit.audit.length === 8;
  const noFalseReady = (audit.audit as Array<{ exists: boolean; classification: string }>).every(
    (row) => !(row.classification === "READY" && row.exists === false),
  );
  const missingNotReady = (audit.audit as Array<{ exists: boolean; classification: string }>).every(
    (row) => row.exists || row.classification === "MISSING",
  );

  const resumeOk =
    dept.departments.resume.enabled === true &&
    dept.departments.resume.dry_run === true &&
    dept.departments.resume.production_mode === false &&
    dept.departments.resume.auto_publish === false &&
    dept.departments.resume.founder_approval_required === true;

  const websiteOk =
    dept.departments.website.enabled === false &&
    dept.departments.website.deleted === false;

  const liveOff =
    readiness.live_enabled === false &&
    String(processes.defaults.SOS_AIOS_LIVE) === "0" &&
    apps.every((a) => {
      const env = (a.env || {}) as Record<string, string>;
      return env.SOS_AIOS_LIVE === "0";
    });

  const autoPublishOff =
    dept.departments.resume.auto_publish === false &&
    apps.every((a) => {
      const env = (a.env || {}) as Record<string, string>;
      return env.SOS_RESUME_AUTO_PUBLISH === "0";
    });

  const founderMandatory =
    dept.departments.resume.founder_approval_required === true;

  const noApi =
    readiness.api_calls === 0 &&
    readiness.templates_generated === 0 &&
    readiness.publications === 0;

  const tempNotStopped =
    readiness.temporary_studiosislab_pm2_stopped === false &&
    readiness.vps_actions_executed === false;

  const envExample = readFileSync(
    join(INFRA, "runtime-environment.example"),
    "utf8",
  );
  const envNoSecrets = !envExample.split("\n").some(looksLikeSecret);

  const startupOk = existsSync(join(INFRA, "startup-order.json"));
  const shutdownOk = existsSync(join(INFRA, "shutdown-order.json"));
  const rollbackPlan = readFileSync(
    join(LOG, "vps-command-plan.md"),
    "utf8",
  ).includes("Rollback");

  const logsOk = LOG_FILES.every((f) => existsSync(join(LOG, f)));
  const reportOk = existsSync(REPORT);
  const allAutostartFalse = apps.every((a) => a.autostart === false);

  const checks = {
    authoritative_pm2_config: infraOk && existsSync(pm2Path),
    eight_target_processes: eightRepresented && apps.length === 8,
    entrypoints_audited: entrypointsAudited && logsOk,
    missing_not_falsely_ready: noFalseReady && missingNotReady,
    resume_enabled_dry_run: resumeOk,
    website_disabled: websiteOk,
    live_mode_off: liveOff,
    auto_publish_off: autoPublishOff,
    founder_approval_mandatory: founderMandatory,
    no_api_request: noApi,
    no_resume_generated: readiness.templates_generated === 0,
    no_template_published: readiness.publications === 0,
    temporary_pm2_not_stopped: tempNotStopped,
    no_vps_action: readiness.vps_actions_executed === false,
    env_template_no_secrets: envNoSecrets,
    startup_shutdown_documented: startupOk && shutdownOk,
    rollback_command_plan: rollbackPlan && reportOk && allAutostartFalse,
  };

  const allPass = Object.values(checks).every(Boolean);

  console.log(
    [
      "AIOS PM2 Runtime Verify",
      "=======================",
      ...Object.entries(checks).map(
        ([k, v]) => `${v ? "✔" : "✘"} ${k.replace(/_/g, " ")}`,
      ),
      "",
      `PM2 config: ${pm2Path}`,
      `Apps: ${apps.length}/8 (autostart all false: ${allAutostartFalse})`,
      `Resume enabled dry_run: ${resumeOk}`,
      `Website disabled: ${websiteOk}`,
      `LIVE: ${readiness.live_enabled}`,
      `API calls: ${readiness.api_calls}`,
      `Overall: ${allPass ? "PASS" : "FAIL"}`,
    ].join("\n"),
  );

  process.exit(allPass ? 0 : 1);
}

main();
