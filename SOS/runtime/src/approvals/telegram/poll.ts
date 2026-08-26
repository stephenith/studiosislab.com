import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import type { RuntimeConfig } from "../../config.js";
import { assertTelegramConfigured } from "../../config.js";
import type { TelegramPollState } from "./types.js";

function offsetPath(config: RuntimeConfig): string {
  return join(config.logsRoot, "approvals", "telegram-offset.json");
}

export async function loadPollOffset(config: RuntimeConfig): Promise<TelegramPollState> {
  const file = offsetPath(config);
  await mkdir(join(config.logsRoot, "approvals"), { recursive: true });
  if (!existsSync(file)) {
    const initial: TelegramPollState = {
      last_update_id: 0,
      updated_at: new Date().toISOString(),
    };
    await writeFile(file, JSON.stringify(initial, null, 2), "utf8");
    return initial;
  }
  return JSON.parse(await readFile(file, "utf8")) as TelegramPollState;
}

export async function savePollOffset(
  config: RuntimeConfig,
  lastUpdateId: number,
): Promise<void> {
  const state: TelegramPollState = {
    last_update_id: lastUpdateId,
    updated_at: new Date().toISOString(),
  };
  await writeFile(offsetPath(config), JSON.stringify(state, null, 2), "utf8");
}

export type TelegramApiUpdate = {
  update_id: number;
  message?: {
    message_id: number;
    from?: { id: number; username?: string; first_name?: string };
    chat: { id: number; type?: string };
    text?: string;
    reply_to_message?: { message_id: number };
    date: number;
  };
};

export async function fetchTelegramUpdates(
  config: RuntimeConfig,
  offset: number,
  timeoutSec = 0,
): Promise<TelegramApiUpdate[]> {
  assertTelegramConfigured(config);
  const token = config.telegramBotToken!;
  const url = new URL(`https://api.telegram.org/bot${token}/getUpdates`);
  url.searchParams.set("offset", String(offset));
  url.searchParams.set("timeout", String(timeoutSec));
  url.searchParams.set("allowed_updates", JSON.stringify(["message"]));

  const response = await fetch(url.toString());
  const payload = (await response.json()) as {
    ok?: boolean;
    description?: string;
    result?: TelegramApiUpdate[];
  };

  if (!response.ok || !payload.ok) {
    throw new Error(payload.description || `Telegram getUpdates HTTP ${response.status}`);
  }

  return payload.result ?? [];
}
