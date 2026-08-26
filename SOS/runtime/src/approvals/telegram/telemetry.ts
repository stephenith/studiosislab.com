import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import type { RuntimeConfig } from "../../config.js";

export type TelegramPollTelemetry = {
  pid: number;
  last_poll_at: string | null;
  last_successful_poll_at: string | null;
  last_update_id: number | null;
  last_processed_update_id: number | null;
  last_poll_error: string | null;
  telegram_conflict: boolean;
  last_conflict_at: string | null;
  polls_total: number;
  errors_total: number;
  updates_processed_total: number;
  polling_mode: "long_poll" | "short_poll";
};

export function telemetryPath(config: RuntimeConfig): string {
  return join(config.logsRoot, "approvals", "telegram-poll-telemetry.json");
}

export function emptyTelemetry(pid = process.pid): TelegramPollTelemetry {
  return {
    pid,
    last_poll_at: null,
    last_successful_poll_at: null,
    last_update_id: null,
    last_processed_update_id: null,
    last_poll_error: null,
    telegram_conflict: false,
    last_conflict_at: null,
    polls_total: 0,
    errors_total: 0,
    updates_processed_total: 0,
    polling_mode: "long_poll",
  };
}

export async function loadPollTelemetry(config: RuntimeConfig): Promise<TelegramPollTelemetry> {
  const path = telemetryPath(config);
  if (!existsSync(path)) return emptyTelemetry();
  try {
    return JSON.parse(await readFile(path, "utf8")) as TelegramPollTelemetry;
  } catch {
    return emptyTelemetry();
  }
}

export async function savePollTelemetry(
  config: RuntimeConfig,
  telemetry: TelegramPollTelemetry,
): Promise<void> {
  const path = telemetryPath(config);
  await mkdir(join(config.logsRoot, "approvals"), { recursive: true });
  await writeFile(path, JSON.stringify(telemetry, null, 2), "utf8");
}

export async function updatePollTelemetry(
  config: RuntimeConfig,
  patch: Partial<TelegramPollTelemetry>,
): Promise<TelegramPollTelemetry> {
  const current = await loadPollTelemetry(config);
  const next = { ...current, ...patch, pid: process.pid };
  await savePollTelemetry(config, next);
  return next;
}
