import { readFile, rename, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { readdir } from "node:fs/promises";
import type { ApprovalsPaths } from "./paths.js";
import type { InboxMessage } from "./types.js";

export async function listInboxFiles(paths: ApprovalsPaths): Promise<string[]> {
  const entries = await readdir(paths.inbox);
  return entries
    .filter((f) => !f.startsWith(".") && (f.endsWith(".json") || f.endsWith(".txt") || f.endsWith(".md")))
    .sort();
}

export async function parseInboxFile(
  paths: ApprovalsPaths,
  filename: string,
): Promise<InboxMessage | null> {
  const filePath = `${paths.inbox}/${filename}`;
  const raw = await readFile(filePath, "utf8");

  if (filename.endsWith(".json")) {
    const data = JSON.parse(raw) as Partial<InboxMessage>;
    if (!data.approval_id || !data.command) return null;
    return {
      approval_id: data.approval_id,
      correlation_id: data.correlation_id,
      command: data.command,
      option: data.option,
      notes: data.notes,
      timestamp: data.timestamp ?? new Date().toISOString(),
    };
  }

  const approvalMatch = filename.match(/^(APP-\d{8}-\d{3})/);
  const approvalId = approvalMatch?.[1];
  if (!approvalId) return null;

  const trimmed = raw.trim();
  const command = trimmed.split("\n").find((l) => l.trim() && !l.startsWith("#"))?.trim() ?? trimmed;

  return {
    approval_id: approvalId,
    command,
    timestamp: new Date().toISOString(),
  };
}

export function validateInboxMessage(msg: InboxMessage): string | null {
  if (!msg.approval_id.match(/^APP-\d{8}-\d{3}$/)) {
    return `Invalid approval_id: ${msg.approval_id}`;
  }
  if (!msg.command?.trim()) {
    return "Missing command";
  }
  return null;
}

export async function moveInboxFile(
  paths: ApprovalsPaths,
  filename: string,
  dest: "processed" | "invalid",
): Promise<void> {
  const from = `${paths.inbox}/${filename}`;
  const to = `${paths[dest]}/${filename}`;
  if (existsSync(from)) {
    await rename(from, to);
  }
}

export async function writeInboxDecision(
  paths: ApprovalsPaths,
  message: InboxMessage,
): Promise<string> {
  const filename = `${message.approval_id}.json`;
  await writeFile(`${paths.inbox}/${filename}`, JSON.stringify(message, null, 2), "utf8");
  return filename;
}
