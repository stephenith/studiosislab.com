import "./bootstrap-env.js";
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

export type Priority = "P0" | "P1" | "P2" | "P3";

export type ChannelRouting = {
  telegram: boolean;
  email: boolean | "batch" | "digest";
};

export type NotifyConfigFile = {
  tenant_id: string;
  repo_id: string;
  timezone: string;
  quiet_hours: { start: string; end: string };
  retry: { max_attempts: number; base_delay_ms: number; max_delay_ms: number };
  circuit_breaker: { failure_threshold: number; window_ms: number };
  rate_limits: {
    p0_per_hour: number;
    p1_telegram_per_hour: number;
    email_digests_per_day: number;
  };
  channels: Record<Priority, ChannelRouting>;
};

export type RuntimeConfig = NotifyConfigFile & {
  telegramBotToken: string | null;
  telegramChatId: string | null;
  telegramAllowedUserIds: string[];
  resendApiKey: string | null;
  notifyTo: string | null;
  notifyFrom: string;
  dryRun: boolean;
  repoRoot: string;
  sosRoot: string;
  logsRoot: string;
  dispatchRoot: string;
  eventsRoot: string;
};

function findRepoRoot(start: string): string {
  let dir = start;
  for (let i = 0; i < 8; i++) {
    const pkg = join(dir, "package.json");
    if (existsSync(pkg)) {
      try {
        const raw = readFileSync(pkg, "utf8");
        const parsed = JSON.parse(raw) as { name?: string };
        if (parsed.name === "studiosislab") return dir;
      } catch {
        // continue walking
      }
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  throw new Error("Could not locate studiosislab repository root.");
}

function loadNotifyConfigFile(sosRoot: string): NotifyConfigFile {
  const path = join(sosRoot, "runtime", "notify.config.json");
  const raw = readFileSync(path, "utf8");
  return JSON.parse(raw) as NotifyConfigFile;
}

function envBool(name: string, fallback: boolean): boolean {
  const v = process.env[name]?.trim().toLowerCase();
  if (v === undefined || v === "") return fallback;
  return v === "1" || v === "true" || v === "yes";
}

export function loadConfig(): RuntimeConfig {
  const runtimeDir = join(__dirname, "..");
  const sosRoot = join(runtimeDir, "..");
  const repoRoot = findRepoRoot(sosRoot);
  const fileConfig = loadNotifyConfigFile(sosRoot);

  const timezone =
    process.env.SOS_TIMEZONE?.trim() || fileConfig.timezone || "America/Los_Angeles";

  return {
    ...fileConfig,
    timezone,
    quiet_hours: {
      start:
        process.env.SOS_QUIET_HOURS_START?.trim() ||
        fileConfig.quiet_hours.start,
      end:
        process.env.SOS_QUIET_HOURS_END?.trim() || fileConfig.quiet_hours.end,
    },
    telegramBotToken: process.env.TELEGRAM_BOT_TOKEN?.trim() || null,
    telegramChatId: process.env.SOS_TELEGRAM_CHAT_ID?.trim() || null,
    telegramAllowedUserIds:
      process.env.SOS_TELEGRAM_ALLOWED_USER_IDS?.split(",")
        .map((s) => s.trim())
        .filter(Boolean) ?? [],
    resendApiKey: process.env.RESEND_API_KEY?.trim() || null,
    notifyTo: process.env.SOS_NOTIFY_TO?.trim() || null,
    notifyFrom:
      process.env.SOS_NOTIFY_FROM?.trim() ||
      "SOS <notifications@studiosis.in>",
    dryRun: envBool("SOS_DISPATCH_DRY_RUN", false),
    repoRoot,
    sosRoot,
    logsRoot: join(sosRoot, "07_LOGS"),
    dispatchRoot: join(sosRoot, "07_LOGS", "dispatch"),
    eventsRoot: join(sosRoot, "07_LOGS", "events"),
  };
}

export function assertTelegramConfigured(config: RuntimeConfig): void {
  if (!config.telegramBotToken) {
    throw new Error("TELEGRAM_BOT_TOKEN is not configured.");
  }
  if (!config.telegramChatId) {
    throw new Error("SOS_TELEGRAM_CHAT_ID is not configured.");
  }
}

export function assertEmailConfigured(config: RuntimeConfig): void {
  if (!config.resendApiKey) {
    throw new Error("RESEND_API_KEY is not configured.");
  }
  if (!config.notifyTo) {
    throw new Error("SOS_NOTIFY_TO is not configured.");
  }
}
