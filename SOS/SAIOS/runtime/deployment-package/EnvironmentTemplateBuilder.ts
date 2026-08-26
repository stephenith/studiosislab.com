/**
 * Environment template + validation (never expose secrets).
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { REPO_ROOT } from "./paths.js";
import type { EnvironmentValidation, EnvVarSpec } from "./types.js";

const REQUIRED: EnvVarSpec[] = [
  {
    name: "TELEGRAM_BOT_TOKEN",
    required: true,
    description: "Telegram bot token for Commander notifications",
    secret: true,
  },
  {
    name: "SOS_TELEGRAM_CHAT_ID",
    required: true,
    description: "Telegram chat id for founder alerts",
    secret: false,
  },
];

const OPTIONAL: EnvVarSpec[] = [
  {
    name: "RESEND_API_KEY",
    required: false,
    description: "Resend API key for email",
    secret: true,
  },
  {
    name: "SOS_NOTIFY_TO",
    required: false,
    description: "Email recipient",
    default_value: "",
    secret: false,
  },
  {
    name: "SOS_NOTIFY_FROM",
    required: false,
    description: "Email from address",
    default_value: "SOS <notifications@studiosis.in>",
    secret: false,
  },
  {
    name: "SOS_TELEGRAM_ALLOWED_USER_IDS",
    required: false,
    description: "Comma-separated Telegram user IDs allowed to approve",
    default_value: "",
    secret: false,
  },
  {
    name: "SOS_TIMEZONE",
    required: false,
    description: "Runtime timezone",
    default_value: "Asia/Kolkata",
    secret: false,
  },
  {
    name: "SOS_DISPATCH_DRY_RUN",
    required: false,
    description: "Skip outbound Commander notifications when true",
    default_value: "true",
    secret: false,
  },
  {
    name: "SOS_AIOS_LIVE",
    required: false,
    description: "Enable LIVE continuity only with Founder Gate",
    default_value: "0",
    secret: false,
  },
  {
    name: "SOS_AIOS_NOTIFY_LIVE",
    required: false,
    description: "Enable live Telegram bridge (explicit opt-in)",
    default_value: "0",
    secret: false,
  },
  {
    name: "SOS_SUPERVISOR_DRY_RUN",
    required: false,
    description: "Supervisor dry-run (default true)",
    default_value: "true",
    secret: false,
  },
  {
    name: "SOS_RUNTIME_LOOP_DRY_RUN",
    required: false,
    description: "Runtime loop dry-run (default true)",
    default_value: "true",
    secret: false,
  },
  {
    name: "NODE_ENV",
    required: false,
    description: "Node environment",
    default_value: "production",
    secret: false,
  },
];

export function buildEnvExample(): string {
  const lines = [
    "# AI OS deployment environment template — Agent #112",
    "# Copy to SOS/runtime/.env — NEVER commit secrets",
    "",
    "# --- Required (Commander Telegram) ---",
    "TELEGRAM_BOT_TOKEN=",
    "SOS_TELEGRAM_CHAT_ID=",
    "",
    "# --- Optional Telegram ---",
    "SOS_TELEGRAM_ALLOWED_USER_IDS=",
    "",
    "# --- Optional Email (Resend) ---",
    "RESEND_API_KEY=",
    "SOS_NOTIFY_TO=",
    "SOS_NOTIFY_FROM=SOS <notifications@studiosis.in>",
    "",
    "# --- AI OS safety (defaults keep VERIFY/DRY_RUN) ---",
    "SOS_AIOS_LIVE=0",
    "SOS_AIOS_NOTIFY_LIVE=0",
    "SOS_SUPERVISOR_DRY_RUN=true",
    "SOS_RUNTIME_LOOP_DRY_RUN=true",
    "SOS_DISPATCH_DRY_RUN=true",
    "SOS_AIOS_MAX_CYCLES=1",
    "",
    "# --- Host ---",
    "NODE_ENV=production",
    "SOS_TIMEZONE=Asia/Kolkata",
    "SOS_QUIET_HOURS_START=22:00",
    "SOS_QUIET_HOURS_END=07:00",
    "",
  ];
  return lines.join("\n");
}

function hasVar(name: string, envText: string): boolean {
  return (
    Boolean(process.env[name]) || new RegExp(`^${name}=.+`, "m").test(envText)
  );
}

export function validateEnvironment(): EnvironmentValidation {
  const envPath = join(REPO_ROOT, "SOS/runtime/.env");
  let envText = "";
  if (existsSync(envPath)) {
    try {
      envText = readFileSync(envPath, "utf8");
    } catch {
      envText = "";
    }
  }

  const missing = REQUIRED.filter((v) => !hasVar(v.name, envText)).map(
    (v) => v.name,
  );
  const present_non_secret = [...REQUIRED, ...OPTIONAL]
    .filter((v) => !v.secret && hasVar(v.name, envText))
    .map((v) => v.name);

  const safe_defaults: Record<string, string> = {};
  for (const v of OPTIONAL) {
    if (v.default_value != null) safe_defaults[v.name] = v.default_value;
  }

  return {
    required: REQUIRED,
    optional: OPTIONAL,
    missing,
    present_non_secret,
    safe_defaults,
    rules: [
      "Never commit SOS/runtime/.env",
      "Secrets must not appear in reports or manifests",
      "SOS_AIOS_LIVE=1 requires Founder Runtime Gate approval",
      "Verify and default deploy paths keep SOS_AIOS_LIVE=0",
      "TELEGRAM_BOT_TOKEN and SOS_TELEGRAM_CHAT_ID required for live Commander notify",
    ],
  };
}
