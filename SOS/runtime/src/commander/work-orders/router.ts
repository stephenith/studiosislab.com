import type { RuntimeConfig } from "../../config.js";
import type { StructuredAction } from "../inbox-ai/types.js";
import type { InboxCommandResult } from "../inbox-ai/types.js";
import type { WorkOrder } from "./types.js";
import { suggestedNextAction } from "./classifier.js";
import {
  createWorkOrder,
  listQueuedWorkOrders,
  listWorkOrders,
  updateWorkOrderStatus,
} from "./store.js";

const SIMPLE_INBOX_INTENTS = new Set([
  "HELP",
  "STATUS",
  "SHOW_DEVELOPER",
  "SHOW_QA",
  "SHOW_PM",
  "SHOW_QUEUE",
  "SHOW_ROADMAP",
  "NEXT_TASK",
  "PAUSE_TASK",
  "RESUME_TASK",
  "CHANGE_PRIORITY",
  "STOP_ALL",
  "START_ALL",
  "CREATE_ROADMAP",
  "CONFIRM",
  "EXECUTE_NOW",
]);

function normalizeCmd(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

export function isWorkOrderAdminCommand(text: string): boolean {
  const n = normalizeCmd(text);
  if (/\bshow work orders?\b/.test(n)) return true;
  if (/\bshow latest work order\b/.test(n)) return true;
  if (/\bshow work order queue\b/.test(n)) return true;
  if (/\bcancel work order\b/.test(n)) return true;
  if (/\bmark work order\b/.test(n) && /\bdone\b/.test(n)) return true;
  return false;
}

export function shouldCaptureAsWorkOrder(action: StructuredAction): boolean {
  if (SIMPLE_INBOX_INTENTS.has(action.intent)) return false;
  return action.intent === "CREATE_TASK" || action.intent === "CREATE_EPIC" || action.intent === "UNKNOWN";
}

function buildReceivedReply(order: WorkOrder): string {
  const next = suggestedNextAction(order.classification);
  return [
    "✅ Work order received.",
    "",
    `ID: ${order.work_order_id}`,
    `Type: ${order.classification}`,
    `Priority: ${order.priority}`,
    `Cursor prompt created:`,
    order.cursor_prompt_path,
    "",
    "I will keep it queued for Cursor execution.",
    "",
    `Next: ${next}`,
  ].join("\n");
}

function formatOrderLine(order: WorkOrder): string {
  return `${order.work_order_id} — ${order.classification} (${order.priority}) [${order.status}]`;
}

export async function tryHandleWorkOrderCommand(
  config: RuntimeConfig,
  userMessage: string,
): Promise<{ result: InboxCommandResult; reply: string } | null> {
  const n = normalizeCmd(userMessage);

  if (/\bshow work orders?\b/.test(n) || /\bshow work order queue\b/.test(n)) {
    const queued = await listQueuedWorkOrders(config);
    const lines =
      queued.length === 0
        ? ["No queued work orders."]
        : queued.map(formatOrderLine);
    return {
      result: {
        ok: true,
        intent: "UNKNOWN",
        action: { intent: "UNKNOWN", raw_text: userMessage, confidence: 1 },
        runtime_action: "work_order_list",
        details: { count: queued.length },
      },
      reply: ["📋 Work orders (queued):", "", ...lines].join("\n"),
    };
  }

  if (/\bshow latest work order\b/.test(n)) {
    const all = await listWorkOrders(config);
    if (all.length === 0) {
      return {
        result: {
          ok: true,
          intent: "UNKNOWN",
          action: { intent: "UNKNOWN", raw_text: userMessage, confidence: 1 },
          runtime_action: "work_order_latest",
          details: { found: false },
        },
        reply: "No work orders yet.",
      };
    }
    const latest = all[0];
    return {
      result: {
        ok: true,
        intent: "UNKNOWN",
        action: { intent: "UNKNOWN", raw_text: userMessage, confidence: 1 },
        runtime_action: "work_order_latest",
        details: { work_order_id: latest.work_order_id },
      },
      reply: [
        "📌 Latest work order:",
        "",
        formatOrderLine(latest),
        `Received: ${latest.received_at}`,
        `Prompt: ${latest.cursor_prompt_path}`,
        `Message: ${latest.raw_message.slice(0, 200)}${latest.raw_message.length > 200 ? "…" : ""}`,
      ].join("\n"),
    };
  }

  const cancelMatch = n.match(/\bcancel work order\s+(wo-\d{8}-\d{6})/i);
  if (cancelMatch) {
    const id = cancelMatch[1].toUpperCase();
    const updated = await updateWorkOrderStatus(config, id, "cancelled", "cancelled via Telegram");
    if (!updated) {
      return {
        result: {
          ok: false,
          intent: "UNKNOWN",
          action: { intent: "UNKNOWN", raw_text: userMessage, confidence: 1 },
          runtime_action: "work_order_cancel",
          error: "not_found",
        },
        reply: `Work order not found: ${id}`,
      };
    }
    return {
      result: {
        ok: true,
        intent: "UNKNOWN",
        action: { intent: "UNKNOWN", raw_text: userMessage, confidence: 1 },
        runtime_action: "work_order_cancel",
        details: { work_order_id: id },
      },
      reply: `Cancelled ${id}.`,
    };
  }

  const doneMatch = n.match(/\bmark work order\s+(wo-\d{8}-\d{6})\s+done/i);
  if (doneMatch) {
    const id = doneMatch[1].toUpperCase();
    const updated = await updateWorkOrderStatus(config, id, "done", "marked done via Telegram");
    if (!updated) {
      return {
        result: {
          ok: false,
          intent: "UNKNOWN",
          action: { intent: "UNKNOWN", raw_text: userMessage, confidence: 1 },
          runtime_action: "work_order_done",
          error: "not_found",
        },
        reply: `Work order not found: ${id}`,
      };
    }
    return {
      result: {
        ok: true,
        intent: "UNKNOWN",
        action: { intent: "UNKNOWN", raw_text: userMessage, confidence: 1 },
        runtime_action: "work_order_done",
        details: { work_order_id: id },
      },
      reply: `Marked ${id} done.`,
    };
  }

  return null;
}

export async function createWorkOrderFromMessage(
  config: RuntimeConfig,
  userMessage: string,
  action: StructuredAction,
): Promise<{ order: WorkOrder; reply: string; result: InboxCommandResult }> {
  const order = await createWorkOrder(config, userMessage);
  const reply = buildReceivedReply(order);
  return {
    order,
    reply,
    result: {
      ok: true,
      intent: action.intent,
      action,
      runtime_action: "work_order_created",
      details: {
        work_order_id: order.work_order_id,
        classification: order.classification,
        priority: order.priority,
        cursor_prompt_path: order.cursor_prompt_path,
      },
    },
  };
}
