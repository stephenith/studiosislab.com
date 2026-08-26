#!/usr/bin/env node
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnvFile } from "../load-env.js";
import { loadConfig } from "../config.js";
import { getPmPaths } from "../pm/paths.js";
import { loadState, saveState } from "../pm/state.js";
import { submitApprovalRequest } from "../pm/approvals.js";
import { loadCdeConfig } from "../pm/cde.js";
import { getApprovalsPaths } from "../approvals/paths.js";
import { ensureApprovalsDirs } from "../approvals/state.js";
import { writeInboxDecision } from "../approvals/inbox.js";
import { runApprovalsListenLoop } from "../approvals/loop.js";
import type { InboxMessage } from "../approvals/types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
loadEnvFile(join(__dirname, "../../.env"));

function parseArgs(argv: string[]): { command: string; approvalId?: string } {
  let command = "APPROVE A";
  let approvalId: string | undefined;

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--command" && argv[i + 1]) command = argv[++i];
    else if (a === "--approval" && argv[i + 1]) approvalId = argv[++i];
    else if (a === "--help" || a === "-h") {
      console.log(`SOS Commander Approval Test (local simulation)

Usage:
  npm run approvals:test
  npm run approvals:test -- --command "APPROVE A"
  npm run approvals:test -- --approval APP-YYYYMMDD-001 --command "REJECT"

Creates a waiting approval if none exists, drops a decision file into inbox,
processes it, and triggers PM resume automatically.
`);
      process.exit(0);
    }
  }

  return { command, approvalId };
}

async function ensureWaitingApproval(approvalId?: string): Promise<{
  approval_id: string;
  correlation_id: string;
  task_id: string;
}> {
  const config = loadConfig();
  const pmPaths = getPmPaths(config);
  const state = await loadState(pmPaths);

  if (approvalId) {
    const waiting = state.waiting_approvals.find((w) => w.approval_id === approvalId);
    if (waiting) {
      return {
        approval_id: waiting.approval_id,
        correlation_id: waiting.correlation_id,
        task_id: waiting.task_id,
      };
    }
  }

  if (state.waiting_approvals.length > 0) {
    const w = state.waiting_approvals[0];
    return {
      approval_id: w.approval_id,
      correlation_id: w.correlation_id,
      task_id: w.task_id,
    };
  }

  const task = state.task_queue.find((t) => t.status === "awaiting_approval")
    ?? state.task_queue.find((t) => t.status === "queued")
    ?? state.task_queue[0];

  if (!task) {
    throw new Error("No task in PM queue. Run npm run pm:run -- --once first.");
  }

  const cde = loadCdeConfig();
  const evaluation = {
    commander_required: true,
    hard_gate_ids: task.hard_gate_ids,
    qa_required: task.qa_required,
    confidence: task.confidence,
    reason: "Test simulation approval",
    priority: task.priority,
  };

  task.status = "awaiting_approval";
  task.requires_commander_approval = true;
  state.loop_status = "waiting_approval";
  state.current_task_id = task.task_id;

  const seq = state.interruption_budget.approvals_sent + 1;
  const { approvalId: newId } = await submitApprovalRequest(
    config,
    pmPaths,
    state,
    task,
    evaluation,
    seq,
    "pre_dev",
  );
  task.approval_id = newId;
  await saveState(pmPaths, state);

  return {
    approval_id: newId,
    correlation_id: task.correlation_id,
    task_id: task.task_id,
  };
}

async function main(): Promise<void> {
  const { command, approvalId } = parseArgs(process.argv.slice(2));
  const config = loadConfig();
  const paths = getApprovalsPaths(config);
  await ensureApprovalsDirs(paths);

  const ctx = await ensureWaitingApproval(approvalId);
  console.log("Using approval context:", ctx);

  const message: InboxMessage = {
    approval_id: ctx.approval_id,
    correlation_id: ctx.correlation_id,
    command,
    timestamp: new Date().toISOString(),
  };

  const filename = await writeInboxDecision(paths, message);
  console.log(`Dropped simulation decision: inbox/${filename}`);
  console.log(`Command: ${command}`);

  await runApprovalsListenLoop({ once: true });
  console.log("Simulation complete. Check npm run approvals:status and npm run pm:status");
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
