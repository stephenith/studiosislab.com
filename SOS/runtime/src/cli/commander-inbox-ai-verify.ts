#!/usr/bin/env node
/**
 * Commander Inbox AI verification — exercises intent routing without Telegram API.
 * Run: npm run commander:inbox-ai-verify
 */
import { loadConfig } from "../config.js";
import { routeInboxCommand } from "../commander/inbox-ai/command-router.js";
import { classifyIntent } from "../commander/inbox-ai/intent-classifier.js";
import { emptyConversation } from "../commander/inbox-ai/conversation.js";

type Case = {
  name: string;
  message: string;
  expectIntent: string;
  expectOk?: boolean;
};

const CASES: Case[] = [
  { name: "Pause SEO", message: "Pause SEO.", expectIntent: "PAUSE_TASK" },
  { name: "Resume Constitution", message: "Resume Constitution.", expectIntent: "RESUME_TASK" },
  { name: "Create Invoice Generator", message: "Build invoice generator.", expectIntent: "CREATE_TASK" },
  {
    name: "Execute now create file",
    message: "Create file SOS/07_LOGS/test/demo.txt containing Hello.",
    expectIntent: "EXECUTE_NOW",
  },
  { name: "Improve SEO planning", message: "Improve SEO.", expectIntent: "CREATE_TASK" },
  { name: "Current status", message: "What is happening?", expectIntent: "STATUS", expectOk: true },
  { name: "Developer status", message: "What is Developer doing?", expectIntent: "SHOW_DEVELOPER", expectOk: true },
  { name: "Show roadmap", message: "Show roadmap", expectIntent: "SHOW_ROADMAP", expectOk: true },
  { name: "Change priority", message: "Finish Mobile first.", expectIntent: "CHANGE_PRIORITY" },
  { name: "Show queue", message: "How many tasks are left?", expectIntent: "SHOW_QUEUE", expectOk: true },
  { name: "Unknown message", message: "xyzzy florp quantum", expectIntent: "UNKNOWN" },
];

async function main(): Promise<void> {
  const config = loadConfig();
  const results: Array<Record<string, unknown>> = [];

  for (const testCase of CASES) {
    const convo = emptyConversation();
    const classified = classifyIntent(testCase.message, convo);
    const intentOk = classified.intent === testCase.expectIntent;

    const routed = await routeInboxCommand(config, testCase.message);
    const okMatch = testCase.expectOk === undefined || routed.result.ok === testCase.expectOk;

    results.push({
      case: testCase.name,
      message: testCase.message,
      expected_intent: testCase.expectIntent,
      actual_intent: classified.intent,
      intent_match: intentOk,
      routed_ok: routed.result.ok,
      ok_match: okMatch,
      runtime_action: routed.result.runtime_action,
      reply_preview: routed.reply.split("\n").slice(0, 3).join(" | "),
    });
  }

  const passed = results.filter(
    (r) => r.intent_match && r.ok_match,
  ).length;

  const report = {
    verified_at: new Date().toISOString(),
    total: results.length,
    passed,
    failed: results.length - passed,
    cases: results,
  };

  console.log(JSON.stringify(report, null, 2));
  if (passed < results.length) process.exit(1);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
