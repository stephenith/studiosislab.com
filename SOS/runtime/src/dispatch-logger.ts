import { appendFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import type { RuntimeConfig } from "./config.js";

export type DispatchLogMessage =
  | "telegram_dispatch_started"
  | "telegram_dispatch_success"
  | "telegram_dispatch_failed"
  | "telegram_api_response"
  | "delivery_result"
  | "dispatch_error";

export type DispatchLogEntry = {
  timestamp: string;
  message: DispatchLogMessage;
  event_id?: string;
  approval_id?: string;
  channel?: string;
  status?: string;
  error?: string;
  api_response?: unknown;
  delivery_result?: unknown;
};

function todayFile(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function logDispatch(
  config: RuntimeConfig,
  entry: Omit<DispatchLogEntry, "timestamp">,
): Promise<void> {
  const full: DispatchLogEntry = {
    timestamp: new Date().toISOString(),
    ...entry,
  };
  const file = join(config.dispatchRoot, `dispatch-log-${todayFile()}.jsonl`);
  await mkdir(config.dispatchRoot, { recursive: true });
  await appendFile(file, `${JSON.stringify(full)}\n`, "utf8");

  const parts = [
    `[dispatch] ${full.message}`,
    full.approval_id ? `approval_id=${full.approval_id}` : null,
    full.event_id ? `event_id=${full.event_id}` : null,
    full.channel ? `channel=${full.channel}` : null,
    full.status ? `status=${full.status}` : null,
    full.error ? `error=${full.error}` : null,
  ].filter(Boolean);
  console.log(parts.join(" "));
}

export function approvalIdFromEvent(event: {
  metadata?: Record<string, unknown>;
}): string | undefined {
  const id = event.metadata?.approval_id;
  return typeof id === "string" ? id : undefined;
}
