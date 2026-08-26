#!/usr/bin/env node
/**
 * Founder execution command acceptance — EXECUTE_NOW vs PLANNING routing.
 */
import { readFile } from "node:fs/promises";
import { loadConfig } from "../config.js";
import { getPmPaths } from "../pm/paths.js";
import { classifyIntent } from "../commander/inbox-ai/intent-classifier.js";
import { emptyConversation } from "../commander/inbox-ai/conversation.js";
import { routeInboxCommand } from "../commander/inbox-ai/command-router.js";
import { loadDeveloperState } from "../developer/state.js";
import { getDeveloperPaths } from "../developer/paths.js";
import { loadState } from "../pm/state.js";

async function main(): Promise<void> {
  const config = loadConfig();
  const pmPaths = getPmPaths(config);
  const backlogBefore = await readFile(pmPaths.backlog, "utf8");
  const backlogLinesBefore = backlogBefore.split("\n").length;

  const executeMsg = "Create file SOS/07_LOGS/test/demo.txt containing Hello.";
  const planMsg = "Build invoice generator.";

  const executeClassified = classifyIntent(executeMsg, emptyConversation());
  const planClassified = classifyIntent(planMsg, emptyConversation());

  const executeRouted = await routeInboxCommand(config, executeMsg);
  const devAfterExecute = await loadDeveloperState(getDeveloperPaths(config));
  const pmAfterExecute = await loadState(pmPaths);

  const backlogMid = await readFile(pmPaths.backlog, "utf8");
  const backlogLinesMid = backlogMid.split("\n").length;

  const planRouted = await routeInboxCommand(config, planMsg);
  const backlogAfter = await readFile(pmPaths.backlog, "utf8");
  const backlogLinesAfter = backlogAfter.split("\n").length;

  const executeTaskId = executeRouted.result.details?.task_id as string | undefined;
  const executeTask = pmAfterExecute.task_queue.find((t) => t.task_id === executeTaskId);

  const report = {
    verified_at: new Date().toISOString(),
    execute_now: {
      message: executeMsg,
      intent: executeClassified.intent,
      intent_ok: executeClassified.intent === "EXECUTE_NOW",
      routed_ok: executeRouted.result.ok,
      runtime_action: executeRouted.result.runtime_action,
      task_id: executeTaskId,
      developer_task_id: devAfterExecute.current_task_id,
      developer_state: devAfterExecute.state,
      developer_matches: devAfterExecute.current_task_id === executeTaskId,
      developer_working: devAfterExecute.state === "working" || devAfterExecute.state === "prepared",
      bypass_roadmap: executeTask?.metadata?.bypass_roadmap === true,
      backlog_lines_delta: backlogLinesMid - backlogLinesBefore,
      backlog_unchanged: backlogLinesMid === backlogLinesBefore,
    },
    planning: {
      message: planMsg,
      intent: planClassified.intent,
      intent_ok: planClassified.intent === "CREATE_TASK",
      routed_ok: planRouted.result.ok,
      runtime_action: planRouted.result.runtime_action,
      command_class: planRouted.result.details?.command_class,
      plan_action: planRouted.result.details?.plan_action,
      backlog_lines_delta: backlogLinesAfter - backlogLinesMid,
      backlog_updated: backlogLinesAfter > backlogLinesMid,
      no_immediate_execute: planRouted.result.runtime_action.includes("createTaskFromInbox"),
    },
    pass:
      executeClassified.intent === "EXECUTE_NOW"
      && executeRouted.result.ok
      && devAfterExecute.current_task_id === executeTaskId
      && backlogLinesMid === backlogLinesBefore
      && planClassified.intent === "CREATE_TASK"
      && planRouted.result.ok
      && backlogLinesAfter > backlogLinesMid,
  };

  console.log(JSON.stringify(report, null, 2));
  process.exit(report.pass ? 0 : 1);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
