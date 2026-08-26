import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import type { RuntimeConfig } from "../config.js";
import type { EventEnvelope } from "../types.js";
import type { PmPaths } from "./paths.js";
import { parseEventLine } from "../validate-event.js";

export async function appendEvent(
  paths: PmPaths,
  event: EventEnvelope,
): Promise<void> {
  const date = new Date().toISOString().slice(0, 10);
  const file = join(paths.events, `${date}.jsonl`);
  await mkdir(paths.events, { recursive: true });
  await appendFile(file, `${JSON.stringify(event)}\n`, "utf8");
}

export async function appendEventForDispatch(
  config: RuntimeConfig,
  paths: PmPaths,
  event: EventEnvelope,
): Promise<void> {
  await appendEvent(paths, event);

  const date = new Date().toISOString().slice(0, 10);
  const dispatchFile = join(config.dispatchRoot, `pm-pending-${date}.jsonl`);
  await mkdir(config.dispatchRoot, { recursive: true });

  if (existsSync(dispatchFile)) {
    const raw = await readFile(dispatchFile, "utf8");
    for (const line of raw.split("\n")) {
      if (!line.trim()) continue;
      try {
        const row = JSON.parse(line) as { event_id?: string };
        if (row.event_id === event.event_id) return;
      } catch {
        // skip malformed lines
      }
    }
  }

  await appendFile(dispatchFile, `${JSON.stringify(event)}\n`, "utf8");
}

export function createTaskAssignedEvent(
  taskId: string,
  correlationId: string,
  agent: "developer" | "qa",
  title: string,
  body: string,
  evidence: string[],
): EventEnvelope {
  return {
    event_id: randomUUID(),
    timestamp: new Date().toISOString(),
    tenant_id: "studiosis",
    repo_id: "studiosislab",
    project_id: "sos-pm",
    agent: "pm",
    type: "task_assigned",
    priority: "P2",
    title: `[${agent.toUpperCase()}] ${title}`,
    body,
    evidence,
    correlation_id: correlationId,
    requires_approval: false,
    approval_status: "not_required",
    metadata: { task_id: taskId, assignee: agent },
  };
}

export function createTaskCompleteEvent(
  taskId: string,
  correlationId: string,
  agent: "developer" | "qa" | "pm",
  title: string,
  body: string,
): EventEnvelope {
  return {
    event_id: randomUUID(),
    timestamp: new Date().toISOString(),
    tenant_id: "studiosis",
    repo_id: "studiosislab",
    project_id: "sos-pm",
    agent,
    type: "task_complete",
    priority: "P2",
    title,
    body,
    correlation_id: correlationId,
    requires_approval: false,
    approval_status: "not_required",
    metadata: { task_id: taskId },
  };
}

export async function readDispatchPendingEvents(
  config: RuntimeConfig,
): Promise<EventEnvelope[]> {
  const date = new Date().toISOString().slice(0, 10);
  const file = join(config.dispatchRoot, `pm-pending-${date}.jsonl`);
  if (!existsSync(file)) return [];
  const raw = await readFile(file, "utf8");
  const events: EventEnvelope[] = [];
  for (const [i, line] of raw.split("\n").entries()) {
    if (!line.trim()) continue;
    try {
      events.push(parseEventLine(line, i + 1));
    } catch {
      // skip
    }
  }
  return events;
}

export async function clearDispatchPending(config: RuntimeConfig): Promise<void> {
  const date = new Date().toISOString().slice(0, 10);
  const file = join(config.dispatchRoot, `pm-pending-${date}.jsonl`);
  if (existsSync(file)) await writeFile(file, "", "utf8");
}
