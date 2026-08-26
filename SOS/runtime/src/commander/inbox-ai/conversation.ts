import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import type { RuntimeConfig } from "../../config.js";
import type { ConversationState, InboxIntent } from "./types.js";

function conversationPath(config: RuntimeConfig): string {
  return join(config.logsRoot, "commander", "inbox-conversation.json");
}

export function emptyConversation(): ConversationState {
  return {
    updated_at: new Date().toISOString(),
    last_intent: null,
    last_subject: null,
    last_task_id: null,
    last_backlog_id: null,
    pending_confirmation: null,
  };
}

export async function loadConversation(config: RuntimeConfig): Promise<ConversationState> {
  const path = conversationPath(config);
  if (!existsSync(path)) return emptyConversation();
  try {
    return JSON.parse(await readFile(path, "utf8")) as ConversationState;
  } catch {
    return emptyConversation();
  }
}

export async function saveConversation(
  config: RuntimeConfig,
  state: ConversationState,
): Promise<void> {
  const path = conversationPath(config);
  await mkdir(join(config.logsRoot, "commander"), { recursive: true });
  state.updated_at = new Date().toISOString();
  await writeFile(path, JSON.stringify(state, null, 2), "utf8");
}

export function rememberSubject(
  convo: ConversationState,
  opts: {
    intent: InboxIntent;
    subject?: string | null;
    task_id?: string | null;
    backlog_id?: string | null;
  },
): void {
  convo.last_intent = opts.intent;
  if (opts.subject) convo.last_subject = opts.subject;
  if (opts.task_id) convo.last_task_id = opts.task_id;
  if (opts.backlog_id) convo.last_backlog_id = opts.backlog_id;
}
