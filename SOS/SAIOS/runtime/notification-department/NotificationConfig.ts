/**
 * Notification config — dry-run by default until secrets exist.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const REPO_ROOT = resolve(import.meta.dirname, "../../../..");
export const NOTIFICATION_DEPARTMENT_ROOT = join(
  REPO_ROOT,
  "SOS/07_LOGS/saios/notification-department",
);

export type NotificationConfig = {
  version: string;
  force_dry_run: boolean;
  morning_window: string;
  evening_window: string;
  channels: {
    telegram: boolean;
    email: boolean;
    console: boolean;
  };
  sources: string[];
};

export function defaultNotificationConfig(): NotificationConfig {
  return {
    version: "1.0.0",
    force_dry_run: true,
    morning_window: "09:00-10:00",
    evening_window: "21:00-22:00",
    channels: {
      telegram: true,
      email: true,
      console: true,
    },
    sources: [
      "website-alerts",
      "production-dashboard",
      "factory-health",
      "catalog-conflicts",
      "scheduler-health",
      "project-state",
      "security-alerts",
      "timeline-reminders",
      "event-history",
      "runtime-health",
    ],
  };
}

export function detectLiveCredentials(): {
  telegram: boolean;
  email: boolean;
  any: boolean;
} {
  const envPath = join(REPO_ROOT, "SOS/runtime/.env");
  let envText = "";
  if (existsSync(envPath)) {
    envText = readFileSync(envPath, "utf8");
  }
  const has = (key: string) =>
    Boolean(process.env[key]) ||
    new RegExp(`^${key}=.+`, "m").test(envText);

  const telegram =
    has("SOS_TELEGRAM_BOT_TOKEN") ||
    has("TELEGRAM_BOT_TOKEN") ||
    has("SOS_TELEGRAM_CHAT_ID");
  const email =
    has("SOS_RESEND_API_KEY") ||
    has("RESEND_API_KEY") ||
    has("SOS_NOTIFY_EMAIL_TO");

  return { telegram, email, any: telegram || email };
}

export function loadOrCreateConfig(persist = true): NotificationConfig {
  const path = join(NOTIFICATION_DEPARTMENT_ROOT, "notification-config.json");
  const credentials = detectLiveCredentials();
  const base = defaultNotificationConfig();
  base.force_dry_run = !credentials.any || base.force_dry_run;
  base.channels.telegram = true;
  base.channels.email = true;

  if (persist) {
    mkdirSync(NOTIFICATION_DEPARTMENT_ROOT, { recursive: true });
    writeFileSync(path, JSON.stringify(base, null, 2));
  }
  return base;
}
