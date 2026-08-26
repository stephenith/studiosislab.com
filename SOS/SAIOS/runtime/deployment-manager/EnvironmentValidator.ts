/**
 * Environment validation for deployment readiness (read-only).
 */
import { existsSync } from "node:fs";
import { join } from "node:path";
import { REPO_ROOT, type DeploymentConfiguration } from "./DeploymentConfiguration.js";
import type { EnvironmentCheck, ValidationCheck } from "./types.js";

const PLACEHOLDERS = [
  "SOS_TELEGRAM_BOT_TOKEN",
  "SOS_TELEGRAM_CHAT_ID",
  "SOS_RESEND_API_KEY",
  "SOS_NOTIFY_EMAIL_TO",
];

export function validateEnvironment(
  config: DeploymentConfiguration,
  generatedAt: string,
): EnvironmentCheck {
  const node_version = process.version;
  const major = Number(node_version.replace(/^v/, "").split(".")[0]);
  const node_ok = major >= config.min_node_major;
  const has_project_state = existsSync(join(REPO_ROOT, "SOS/project-state.json"));
  const has_saios_runtime = existsSync(join(REPO_ROOT, "SOS/SAIOS/runtime"));
  const has_sos_runtime_env = existsSync(join(REPO_ROOT, "SOS/runtime/.env"));

  const checks: ValidationCheck[] = [
    {
      id: "node-version",
      label: "Node version",
      pass: node_ok,
      detail: `${node_version} (min v${config.min_node_major})`,
    },
    {
      id: "project-state",
      label: "project-state.json",
      pass: has_project_state,
      detail: "SOS/project-state.json",
    },
    {
      id: "saios-runtime",
      label: "SAIOS runtime folder",
      pass: has_saios_runtime,
      detail: "SOS/SAIOS/runtime",
    },
    {
      id: "sos-runtime-env",
      label: "SOS/runtime/.env (optional)",
      pass: true,
      detail: has_sos_runtime_env
        ? "present"
        : "missing — live notifications remain dry-run",
    },
  ];

  return {
    generated_at: generatedAt,
    node_version,
    node_ok,
    min_node_major: config.min_node_major,
    has_project_state,
    has_saios_runtime,
    has_sos_runtime_env,
    placeholders: PLACEHOLDERS,
    checks,
    pass: checks.every((c) => c.pass) && node_ok && has_project_state && has_saios_runtime,
  };
}
