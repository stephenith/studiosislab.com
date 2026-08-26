/**
 * Environment placeholder / secrets presence checks (read-only).
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { REPO_ROOT } from "./SecurityConfiguration.js";
import { sourceEntry } from "./security-utils.js";
import type { SecurityFinding } from "./types.js";

const PLACEHOLDERS = [
  "SOS_TELEGRAM_BOT_TOKEN",
  "SOS_TELEGRAM_CHAT_ID",
  "SOS_RESEND_API_KEY",
  "SOS_NOTIFY_EMAIL_TO",
];

export function checkEnvironment(): {
  findings: SecurityFinding[];
  sources: ReturnType<typeof sourceEntry>[];
  pass: boolean;
} {
  const envPath = join(REPO_ROOT, "SOS/runtime/.env");
  const sources = [sourceEntry("sos-runtime-env", envPath)];
  const findings: SecurityFinding[] = [];

  const envExists = existsSync(envPath);
  findings.push({
    id: "env-file",
    area: "environment",
    level: envExists ? "GREEN" : "YELLOW",
    title: envExists ? "SOS/runtime/.env present" : "SOS/runtime/.env missing (dry-run mode expected)",
    detail: envPath,
    source: "environment",
    pass: true,
  });

  let envText = "";
  if (envExists) {
    try {
      envText = readFileSync(envPath, "utf8");
    } catch {
      findings.push({
        id: "env-unreadable",
        area: "environment",
        level: "ORANGE",
        title: "Unable to read SOS/runtime/.env",
        detail: envPath,
        source: "environment",
        pass: false,
      });
    }
  }

  for (const key of PLACEHOLDERS) {
    const present =
      Boolean(process.env[key]) || new RegExp(`^${key}=.+`, "m").test(envText);
    findings.push({
      id: `env-${key}`,
      area: "environment",
      level: present ? "GREEN" : "YELLOW",
      title: present ? `${key} configured` : `${key} placeholder / not configured`,
      detail: "Live notifications may remain dry-run until configured",
      source: "environment",
      pass: true,
    });
  }

  return { findings, sources, pass: true };
}
