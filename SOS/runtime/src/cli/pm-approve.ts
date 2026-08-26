#!/usr/bin/env node
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { loadEnvFile } from "../load-env.js";
import { loadConfig } from "../config.js";
import { getPmPaths } from "../pm/paths.js";
import { loadState, saveState } from "../pm/state.js";
import { recordApprovalResponse } from "../pm/approvals.js";
import { appendEvent } from "../pm/events.js";
import type { EventEnvelope } from "../types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
loadEnvFile(join(__dirname, "../../.env"));

async function main(): Promise<void> {
  const [approvalId, ...commandParts] = process.argv.slice(2);
  if (!approvalId || commandParts.length === 0) {
    console.error("Usage: npm run pm:approve -- APP-YYYYMMDD-001 APPROVE A");
    process.exit(1);
  }

  const command = commandParts.join(" ");
  const config = loadConfig();
  const paths = getPmPaths(config);
  const state = await loadState(paths);

  const waiting = state.waiting_approvals.find((w) => w.approval_id === approvalId);
  if (!waiting) {
    console.error(`No waiting approval found for ${approvalId}`);
    process.exit(1);
  }

  const response = await recordApprovalResponse(
    paths,
    approvalId,
    command,
    waiting.task_id,
    waiting.correlation_id,
  );

  if (!response) {
    console.error("Failed to parse command. Use CCP syntax: APPROVE A | REJECT | DEFER 24H");
    process.exit(1);
  }

  const event: EventEnvelope = {
    event_id: randomUUID(),
    timestamp: new Date().toISOString(),
    tenant_id: "studiosis",
    repo_id: "studiosislab",
    project_id: "sos-pm",
    agent: "pm",
    type: "approval_response",
    priority: "P2",
    title: `Approval response: ${response.command}`,
    body: response.raw,
    correlation_id: response.correlation_id,
    requires_approval: false,
    approval_status:
      response.command === "APPROVE" ? "approved"
      : response.command === "REJECT" ? "rejected"
      : "deferred",
    metadata: {
      approval_id: approvalId,
      option_key: response.option_key,
      notes: response.notes,
    },
  };

  await appendEvent(paths, event);
  await saveState(paths, state);

  console.log("Approval recorded:", JSON.stringify(response, null, 2));
  console.log("PM loop will resume on next poll. Run: npm run pm:run -- --once");
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
