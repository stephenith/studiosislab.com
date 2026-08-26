import { readFile, writeFile, appendFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import type { RuntimeConfig } from "../../config.js";
import type { TelegramOutboundRecord } from "./types.js";

function registryPath(config: RuntimeConfig): string {
  return join(config.logsRoot, "approvals", "telegram-outbound.jsonl");
}

export async function registerTelegramOutbound(
  config: RuntimeConfig,
  record: TelegramOutboundRecord,
): Promise<void> {
  const file = registryPath(config);
  await mkdir(join(config.logsRoot, "approvals"), { recursive: true });
  await appendFile(file, `${JSON.stringify(record)}\n`, "utf8");
}

export async function lookupByApprovalId(
  config: RuntimeConfig,
  approvalId: string,
): Promise<TelegramOutboundRecord | null> {
  const file = registryPath(config);
  if (!existsSync(file)) return null;
  const raw = await readFile(file, "utf8");
  let found: TelegramOutboundRecord | null = null;
  for (const line of raw.split("\n")) {
    if (!line.trim()) continue;
    try {
      const row = JSON.parse(line) as TelegramOutboundRecord;
      if (row.approval_id === approvalId) found = row;
    } catch {
      // skip
    }
  }
  return found;
}

export async function lookupByMessageId(
  config: RuntimeConfig,
  chatId: string,
  messageId: number,
): Promise<TelegramOutboundRecord | null> {
  const file = registryPath(config);
  if (!existsSync(file)) return null;
  const raw = await readFile(file, "utf8");
  for (const line of raw.split("\n")) {
    if (!line.trim()) continue;
    try {
      const row = JSON.parse(line) as TelegramOutboundRecord;
      if (row.chat_id === chatId && row.message_id === messageId) return row;
    } catch {
      // skip
    }
  }
  return null;
}
