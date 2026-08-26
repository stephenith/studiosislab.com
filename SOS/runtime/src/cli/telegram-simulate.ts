#!/usr/bin/env node
import { loadConfig } from "../config.js";
import { getApprovalsPaths } from "../approvals/paths.js";
import { ensureApprovalsDirs } from "../approvals/state.js";
import { processTelegramInboundMessage } from "../approvals/telegram/process.js";
import type { TelegramInboundMessage } from "../approvals/telegram/types.js";

function parseArgs(argv: string[]): { command: string; approvalId?: string } {
  let command = "APPROVE A";
  let approvalId: string | undefined;

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--command" && argv[i + 1]) command = argv[++i];
    else if (a === "--approval" && argv[i + 1]) approvalId = argv[++i];
    else if (!a.startsWith("--") && command === "APPROVE A" && a !== "APPROVE A") {
      command = a;
    } else if (a === "--help" || a === "-h") {
      console.log(`Simulate a Telegram Commander reply through the inbound pipeline.

Usage:
  npm run telegram:simulate -- "APPROVE A"
  npm run telegram:simulate -- --approval APP-YYYYMMDD-001 --command "REJECT"
`);
      process.exit(0);
    }
  }

  if (approvalId && !command.includes(approvalId)) {
    // Keep command as-is; approval id resolved separately when replying to bot message
  }

  return { command, approvalId };
}

async function main(): Promise<void> {
  const { command, approvalId } = parseArgs(process.argv.slice(2));
  const config = loadConfig();
  const paths = getApprovalsPaths(config);
  await ensureApprovalsDirs(paths);

  const inbound: TelegramInboundMessage = {
    update_id: Date.now(),
    message_id: Date.now(),
    chat_id: config.telegramChatId ?? "",
    user_id: config.telegramAllowedUserIds[0] ?
      parseInt(config.telegramAllowedUserIds[0], 10)
    : undefined,
    text: command,
    hint_approval_id: approvalId,
    received_at: new Date().toISOString(),
  };

  console.log("Simulating Telegram inbound:", inbound);
  const result = await processTelegramInboundMessage(config, paths, inbound);
  console.log("Result:", result);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
