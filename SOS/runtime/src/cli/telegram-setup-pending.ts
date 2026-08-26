#!/usr/bin/env node
import { loadConfig } from "../config.js";
import { getPmPaths } from "../pm/paths.js";
import { loadState, saveState } from "../pm/state.js";
import { submitApprovalRequest } from "../pm/approvals.js";
import { loadCdeConfig } from "../pm/cde.js";

async function main(): Promise<void> {
  const config = loadConfig();
  const pmPaths = getPmPaths(config);
  const state = await loadState(pmPaths);

  const task = state.task_queue.find((t) => t.status === "awaiting_approval")
    ?? state.task_queue[0];

  if (!task) {
    throw new Error("No task in PM queue.");
  }

  if (state.waiting_approvals.length > 0) {
    const w = state.waiting_approvals[0];
    console.log(JSON.stringify({ approval_id: w.approval_id, task_id: w.task_id, existing: true }, null, 2));
    return;
  }

  const cde = loadCdeConfig();
  const evaluation = {
    commander_required: true,
    hard_gate_ids: task.hard_gate_ids,
    qa_required: task.qa_required,
    confidence: task.confidence,
    reason: "Telegram inbound E2E pending approval",
    priority: task.priority,
  };

  task.status = "awaiting_approval";
  task.requires_commander_approval = true;
  state.loop_status = "waiting_approval";
  state.current_task_id = task.task_id;

  const seq = state.interruption_budget.approvals_sent + 1;
  const { approvalId } = await submitApprovalRequest(
    config,
    pmPaths,
    state,
    task,
    evaluation,
    seq,
    "pre_dev",
  );
  task.approval_id = approvalId;
  await saveState(pmPaths, state);

  console.log(JSON.stringify({
    approval_id: approvalId,
    task_id: task.task_id,
    correlation_id: task.correlation_id,
    telegram_poll: "npm run telegram:poll -- --once",
    simulate: `npm run telegram:simulate -- --approval ${approvalId} --command "APPROVE A"`,
  }, null, 2));
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
