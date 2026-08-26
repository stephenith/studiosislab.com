#!/usr/bin/env node
/**
 * Telegram work-order inbox verification.
 * Run: npm run work-order:inbox-verify
 */
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { loadConfig } from "../config.js";
import { routeInboxCommand } from "../commander/inbox-ai/command-router.js";
import { classifyIntent } from "../commander/inbox-ai/intent-classifier.js";
import { emptyConversation } from "../commander/inbox-ai/conversation.js";
import { loadWorkOrder } from "../commander/work-orders/store.js";
import { getWorkOrderPaths, promptMdPath } from "../commander/work-orders/paths.js";

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(msg);
}

async function main(): Promise<void> {
  const config = loadConfig();
  const paths = getWorkOrderPaths(config);

  const agentMsg = "Create the first Cursor agent for StudiosisLab mobile editor.";
  const created = await routeInboxCommand(config, agentMsg);
  assert(created.result.ok, "work order create ok");
  assert(created.result.runtime_action === "work_order_created", "runtime_action work_order_created");
  const woId = created.result.details?.work_order_id as string;
  assert(Boolean(woId), "work_order_id present");
  assert(created.reply.includes("Work order received"), "telegram reply received");
  assert(created.reply.includes(woId), "reply contains id");

  const inboxJson = join(paths.inbox, `${woId}.json`);
  assert(existsSync(inboxJson), "inbox json exists");
  const order = await loadWorkOrder(config, woId);
  assert(order?.classification === "create_agent", "classified create_agent");
  assert(existsSync(promptMdPath(paths, woId)), "prompt md exists");
  const prompt = await readFile(promptMdPath(paths, woId), "utf8");
  assert(prompt.includes(agentMsg), "prompt contains founder message");

  const list = await routeInboxCommand(config, "show work orders");
  assert(list.result.ok, "show work orders ok");
  assert(list.reply.includes(woId), "list contains work order");

  const cancel = await routeInboxCommand(config, `cancel work order ${woId}`);
  assert(cancel.result.ok, "cancel ok");
  const cancelled = await loadWorkOrder(config, woId);
  assert(cancelled?.status === "cancelled", "status cancelled");

  const statusMsg = "What is happening?";
  const classified = classifyIntent(statusMsg, emptyConversation());
  assert(classified.intent === "STATUS", "status intent unchanged");
  const status = await routeInboxCommand(config, statusMsg);
  assert(status.result.intent === "STATUS", "status route intent");
  assert(status.result.runtime_action !== "work_order_created", "status not work order");

  const report = {
    verified_at: new Date().toISOString(),
    work_order_id: woId,
    classification: order?.classification,
    prompt_path: order?.cursor_prompt_path,
    prompt_preview_lines: prompt.split("\n").slice(0, 12),
    tests: {
      create_work_order: true,
      show_work_orders: true,
      cancel_work_order: true,
      status_unchanged: true,
    },
    pass: true,
  };

  console.log(JSON.stringify(report, null, 2));
  process.exit(0);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
