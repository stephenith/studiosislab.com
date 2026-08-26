import type { Priority } from "../shared/types.js";
import type { FounderCommand } from "../chief/types.js";
import type { ParsedFounderCommand } from "./types.js";

function detectPriority(text: string): Priority {
  if (/\b(urgent|asap|p0|critical)\b/i.test(text)) return "P0";
  if (/\b(important|p1|high)\b/i.test(text)) return "P1";
  if (/\b(low|p3|minor)\b/i.test(text)) return "P3";
  return "P2";
}

function extractGoal(text: string): string {
  const trimmed = text.trim();
  const withoutPrefix = trimmed
    .replace(/^(build|create|implement|add|fix|update)\s+/i, "")
    .trim();
  return withoutPrefix || trimmed || "Unspecified founder goal";
}

/**
 * Convert Telegram text into a structured founder command.
 */
export class FounderCommandParser {
  parse(inbound: {
    text: string;
    chat_id: string;
    user_id?: number;
    received_at?: string;
  }): ParsedFounderCommand {
    const raw = inbound.text.trim();
    const lower = raw.toLowerCase();

    const founder_command: FounderCommand = {
      source: "telegram",
      raw_text: raw,
      chat_id: inbound.chat_id,
      user_id: inbound.user_id !== undefined ? String(inbound.user_id) : undefined,
      received_at: inbound.received_at ?? new Date().toISOString(),
    };

    const cancelMatch = raw.match(/\bcancel(?:\s+job)?\s+(JOB-[A-Za-z0-9_-]+)/i);
    if (cancelMatch || /^cancel\b/i.test(lower)) {
      return {
        founder_command,
        goal: raw,
        priority: "P2",
        context: "cancel_request",
        attachments: [],
        intent: "cancel",
        target_job_id: cancelMatch?.[1],
      };
    }

    if (/^(show\s+)?(running\s+)?jobs?\b/i.test(lower) || lower === "list running") {
      return {
        founder_command,
        goal: raw,
        priority: "P2",
        context: "list_running",
        attachments: [],
        intent: "list_running",
      };
    }

    const statusMatch = raw.match(/\bstatus(?:\s+job)?\s+(JOB-[A-Za-z0-9_-]+)/i);
    if (statusMatch || lower === "status") {
      return {
        founder_command,
        goal: raw,
        priority: "P2",
        context: "status_request",
        attachments: [],
        intent: "status",
        target_job_id: statusMatch?.[1],
      };
    }

    const priority = detectPriority(raw);
    const goal = extractGoal(raw);

    return {
      founder_command,
      goal,
      priority,
      context: "founder_execute",
      attachments: [],
      intent: "execute",
    };
  }
}
