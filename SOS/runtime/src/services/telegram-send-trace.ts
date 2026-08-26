import { appendFile, mkdir, readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { join } from "node:path";
import type { RuntimeConfig } from "../config.js";

export type TelegramSendTraceEntry = {
  timestamp: string;
  event_id: string;
  correlation_id: string;
  message_hash: string;
  chat_id: string | null;
  caller_function: string;
  caller_file: string;
  worker: string;
  pid: number;
  stack: string[];
  delivery_method: string;
  duplicate_of: string | null;
  api_called: boolean;
};

function tracePath(config: RuntimeConfig): string {
  return join(config.logsRoot, "telegram", "send-trace.jsonl");
}

function messageHash(text: string): string {
  return createHash("sha256").update(text).digest("hex").slice(0, 16);
}

function parseStack(stack: string): string[] {
  return stack
    .split("\n")
    .slice(2, 7)
    .map((line) => line.trim());
}

function inferWorker(): string {
  const cmd = process.argv.join(" ");
  if (cmd.includes("pm-run")) return "pm";
  if (cmd.includes("dispatch-loop") || cmd.includes("dispatch.ts")) return "dispatcher";
  if (cmd.includes("commander")) return "commander";
  if (cmd.includes("telegram-poll")) return "telegram";
  if (cmd.includes("test-notify")) return "test";
  if (process.env.SOS_NOTIFICATION_MODE === "mock") return "verify";
  return process.env.SOS_PRODUCTION_WORKER === "true" ? "commander-worker" : "manual";
}

async function findDuplicateHash(
  config: RuntimeConfig,
  hash: string,
  excludeTimestamp: string,
): Promise<string | null> {
  const path = tracePath(config);
  if (!existsSync(path)) return null;
  const raw = await readFile(path, "utf8");
  for (const line of raw.split("\n")) {
    if (!line.trim()) continue;
    try {
      const row = JSON.parse(line) as TelegramSendTraceEntry;
      if (row.message_hash === hash && row.timestamp !== excludeTimestamp) {
        return row.timestamp;
      }
    } catch {
      /* skip */
    }
  }
  return null;
}

export async function traceTelegramSend(
  config: RuntimeConfig,
  opts: {
    event_id: string;
    correlation_id: string;
    message_text: string;
    chat_id: string | null;
    delivery_method: string;
    api_called?: boolean;
  },
): Promise<void> {
  const err = new Error("trace");
  const stack = parseStack(err.stack ?? "");
  const caller = stack[0] ?? "unknown";
  const callerFile = caller.match(/\((.+):\d+:\d+\)/)?.[1] ?? caller;
  const callerFn = caller.replace(/^at\s+/, "").split(" (")[0] ?? "unknown";
  const timestamp = new Date().toISOString();
  const hash = messageHash(opts.message_text);

  const duplicateOf = await findDuplicateHash(config, hash, timestamp);

  const entry: TelegramSendTraceEntry = {
    timestamp,
    event_id: opts.event_id,
    correlation_id: opts.correlation_id,
    message_hash: hash,
    chat_id: opts.chat_id,
    caller_function: callerFn,
    caller_file: callerFile,
    worker: inferWorker(),
    pid: process.pid,
    stack,
    delivery_method: opts.delivery_method,
    duplicate_of: duplicateOf,
    api_called: opts.api_called ?? true,
  };

  const dir = join(config.logsRoot, "telegram");
  await mkdir(dir, { recursive: true });
  await appendFile(tracePath(config), `${JSON.stringify(entry)}\n`, "utf8");
}

export async function readSendTrace(
  config: RuntimeConfig,
): Promise<TelegramSendTraceEntry[]> {
  const path = tracePath(config);
  if (!existsSync(path)) return [];
  const raw = await readFile(path, "utf8");
  return raw
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as TelegramSendTraceEntry);
}
