/**
 * PM2 ecosystem config builder.
 */
export function buildPm2Config(): string {
  return `/**
 * AI OS PM2 config — Agent #112
 * Assumptions: Node 22 LTS · PM2 · Ubuntu 24.04
 * Does not start LIVE mode by default.
 */
module.exports = {
  apps: [
    {
      name: "aios-live-runtime",
      cwd: process.cwd(),
      script: "npx",
      args: "--yes tsx SOS/SAIOS/runtime/live-runtime/LiveRuntimeManager.ts",
      instances: 1,
      exec_mode: "fork",
      watch: false,
      max_memory_restart: "1G",
      env: {
        NODE_ENV: "production",
        SOS_AIOS_LIVE: "0",
        SOS_SUPERVISOR_DRY_RUN: "true",
        SOS_RUNTIME_LOOP_DRY_RUN: "true",
        SOS_AIOS_MAX_CYCLES: "1",
      },
      error_file: "SOS/07_LOGS/saios/deployment-package/pm2-error.log",
      out_file: "SOS/07_LOGS/saios/deployment-package/pm2-out.log",
      time: true,
    },
    {
      name: "aios-supervisor",
      cwd: process.cwd(),
      script: "npx",
      args: "--yes tsx SOS/SAIOS/runtime/runtime-supervisor/RuntimeSupervisor.ts",
      instances: 1,
      exec_mode: "fork",
      watch: false,
      max_memory_restart: "512M",
      env: {
        NODE_ENV: "production",
        SOS_SUPERVISOR_DRY_RUN: "true",
        SOS_SUPERVISOR_MAX_CYCLES: "1",
      },
      error_file: "SOS/07_LOGS/saios/deployment-package/pm2-supervisor-error.log",
      out_file: "SOS/07_LOGS/saios/deployment-package/pm2-supervisor-out.log",
      time: true,
    },
  ],
};
`;
}
