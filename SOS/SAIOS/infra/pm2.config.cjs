/**
 * AIOS authoritative PM2 ecosystem — Agent #116
 * Location: SOS/SAIOS/infra/pm2.config.cjs (source of truth — not logs)
 *
 * Hosting:
 * - Public website: Vercel (studiosislab.com) — NOT on this VPS
 * - Temporary PM2 "studiosislab" (os.studiosislab.com): do not manage here
 *
 * Safety defaults (must not be silently overridden):
 * - SOS_AIOS_LIVE=0
 * - SOS_AIOS_NOTIFY_LIVE=0
 * - dry-run / max cycles capped
 * - all apps autostart=false until founder-approved VPS start
 *
 * Do not: call OpenAI, generate resumes, publish, or enable LIVE from this file.
 */
const path = require("path");

const REPO_ROOT = path.resolve(__dirname, "../../..");
const LOG_DIR = path.join(REPO_ROOT, "SOS/07_LOGS/saios/pm2");

const SAFETY_ENV = {
  NODE_ENV: "production",
  SOS_AIOS_LIVE: "0",
  SOS_AIOS_NOTIFY_LIVE: "0",
  SOS_RUNTIME_LOOP_DRY_RUN: "1",
  SOS_SUPERVISOR_DRY_RUN: "1",
  SOS_AIOS_MAX_CYCLES: "1",
  SOS_SUPERVISOR_MAX_CYCLES: "1",
  SOS_RESUME_BATCH_SIZE: "1",
  SOS_RESUME_AUTO_PUBLISH: "0",
  SOS_WEBSITE_DEPARTMENT_ENABLED: "0",
  SOS_RESUME_DEPARTMENT_ENABLED: "1",
  SOS_RESUME_DEPARTMENT_DRY_RUN: "1",
  SOS_FOUNDER_APPROVAL_REQUIRED: "1",
};

function app(def) {
  return {
    cwd: def.cwd || REPO_ROOT,
    instances: 1,
    exec_mode: "fork",
    watch: false,
    autorestart: def.autorestart !== false,
    max_restarts: def.max_restarts ?? 10,
    min_uptime: "10s",
    restart_delay: def.restart_delay ?? 5000,
    max_memory_restart: def.max_memory_restart || "1G",
    time: true,
    autostart: false,
    env: { ...SAFETY_ENV, ...(def.env || {}) },
    error_file: path.join(LOG_DIR, `${def.name}-error.log`),
    out_file: path.join(LOG_DIR, `${def.name}-out.log`),
    ...def,
  };
}

module.exports = {
  apps: [
    app({
      name: "aios-orchestrator",
      script: "npx",
      args: "--yes tsx SOS/SAIOS/runtime/live-runtime/LiveRuntimeManager.ts",
      max_memory_restart: "1G",
      restart_delay: 5000,
      max_restarts: 10,
    }),
    app({
      name: "aios-scheduler",
      script: "npx",
      args: "--yes tsx SOS/SAIOS/runtime/scheduler/run.ts",
      max_memory_restart: "1G",
      restart_delay: 10000,
      max_restarts: 10,
    }),
    app({
      name: "aios-resume-worker",
      script: "npx",
      args: "--yes tsx SOS/SAIOS/runtime/workers/resume-production/run-v3.ts",
      max_memory_restart: "1G",
      restart_delay: 5000,
      max_restarts: 5,
      autorestart: false,
    }),
    app({
      name: "aios-render-worker",
      script: "node",
      args: "SOS/SAIOS/infra/disabled-process.cjs",
      max_memory_restart: "1G",
      restart_delay: 5000,
      max_restarts: 5,
      autorestart: false,
    }),
    app({
      name: "aios-qa-worker",
      script: "npx",
      args: "--yes tsx SOS/SAIOS/runtime/workers/resume-qa/run.ts",
      max_memory_restart: "512M",
      restart_delay: 5000,
      max_restarts: 5,
      autorestart: false,
    }),
    app({
      name: "aios-supervisor",
      script: "npx",
      args: "--yes tsx SOS/SAIOS/runtime/runtime-supervisor/RuntimeSupervisor.ts",
      max_memory_restart: "512M",
      restart_delay: 5000,
      max_restarts: 10,
    }),
    app({
      name: "aios-telegram",
      cwd: path.join(REPO_ROOT, "SOS/runtime"),
      script: "npm",
      args: "run commander:start",
      max_memory_restart: "512M",
      restart_delay: 5000,
      max_restarts: 10,
    }),
    app({
      name: "aios-dashboard",
      script: "node",
      args: "SOS/SAIOS/infra/disabled-process.cjs",
      max_memory_restart: "512M",
      restart_delay: 5000,
      max_restarts: 10,
      autorestart: false,
    }),
  ],
};
