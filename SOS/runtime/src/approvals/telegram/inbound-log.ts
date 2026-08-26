import { appendFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import type { RuntimeConfig } from "../../config.js";
import type { TelegramInboundLogMessage } from "./types.js";

export type InboundLogEntry = {
  timestamp: string;
  message: TelegramInboundLogMessage;
  update_id?: number;
  approval_id?: string;
  chat_id?: string;
  user_id?: number;
  command?: string;
  error?: string;
  details?: unknown;
};

export async function logTelegramInbound(
  config: RuntimeConfig,
  entry: Omit<InboundLogEntry, "timestamp">,
): Promise<void> {
  const full: InboundLogEntry = {
    timestamp: new Date().toISOString(),
    ...entry,
  };
  const date = full.timestamp.slice(0, 10);
  const file = join(config.logsRoot, "approvals", "telegram-inbound", `${date}.jsonl`);
  await mkdir(join(config.logsRoot, "approvals", "telegram-inbound"), { recursive: true });
  await appendFile(file, `${JSON.stringify(full)}\n`, "utf8");

  const parts = [
    `[telegram-inbound] ${full.message}`,
    full.approval_id ? `approval_id=${full.approval_id}` : null,
    full.update_id !== undefined ? `update_id=${full.update_id}` : null,
    full.command ? `command=${full.command}` : null,
    full.error ? `error=${full.error}` : null,
  ].filter(Boolean);
  console.log(parts.join(" "));
}
