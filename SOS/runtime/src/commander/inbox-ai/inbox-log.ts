import { appendFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import type { RuntimeConfig } from "../../config.js";
import type { InboxCommandResult, StructuredAction } from "./types.js";

export type InboxLogEntry = {
  timestamp: string;
  user_message: string;
  chat_id: string;
  user_id?: number;
  intent: string;
  structured_action: StructuredAction;
  runtime_action: string;
  result_ok: boolean;
  details?: Record<string, unknown>;
  error?: string | null;
  reply: string;
};

function logPath(config: RuntimeConfig): string {
  const date = new Date().toISOString().slice(0, 10);
  return join(config.logsRoot, "commander", `inbox-ai-${date}.jsonl`);
}

export async function logInboxCommand(
  config: RuntimeConfig,
  entry: Omit<InboxLogEntry, "timestamp">,
): Promise<void> {
  const dir = join(config.logsRoot, "commander");
  await mkdir(dir, { recursive: true });
  const line = JSON.stringify({ timestamp: new Date().toISOString(), ...entry });
  await appendFile(logPath(config), `${line}\n`, "utf8");
}

export async function logInboxResult(
  config: RuntimeConfig,
  opts: {
    user_message: string;
    chat_id: string;
    user_id?: number;
    reply: string;
    result: InboxCommandResult;
  },
): Promise<void> {
  await logInboxCommand(config, {
    user_message: opts.user_message,
    chat_id: opts.chat_id,
    user_id: opts.user_id,
    intent: opts.result.intent,
    structured_action: opts.result.action,
    runtime_action: opts.result.runtime_action,
    result_ok: opts.result.ok,
    details: opts.result.details,
    error: opts.result.error,
    reply: opts.reply,
  });
}
