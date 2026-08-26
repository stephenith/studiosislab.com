/**
 * Environment placeholders and Node info for deployment readiness.
 */
import { existsSync } from "node:fs";
import { join } from "node:path";
import { REPO_ROOT } from "./RuntimeConfiguration.js";

export type RuntimeEnvironmentInfo = {
  node_version: string;
  cwd: string;
  has_sos_runtime_env: boolean;
  has_project_state: boolean;
  has_saios_runtime: boolean;
  placeholders: string[];
};

export function inspectRuntimeEnvironment(): RuntimeEnvironmentInfo {
  const placeholders = [
    "SOS_TELEGRAM_BOT_TOKEN",
    "SOS_TELEGRAM_CHAT_ID",
    "SOS_RESEND_API_KEY",
    "SOS_NOTIFY_EMAIL_TO",
    "WEBSITE_DEPARTMENT_BASE_URL",
  ];

  return {
    node_version: process.version,
    cwd: process.cwd(),
    has_sos_runtime_env: existsSync(join(REPO_ROOT, "SOS/runtime/.env")),
    has_project_state: existsSync(join(REPO_ROOT, "SOS/project-state.json")),
    has_saios_runtime: existsSync(join(REPO_ROOT, "SOS/SAIOS/runtime")),
    placeholders,
  };
}

export function nodeVersionOk(version = process.version): boolean {
  const major = Number(version.replace(/^v/, "").split(".")[0]);
  return major >= 20;
}
