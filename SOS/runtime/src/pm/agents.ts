import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import type { PmPaths } from "./paths.js";
import type {
  AgentAssignment,
  DeveloperReport,
  PmState,
  QaReport,
  Task,
} from "./types.js";
import { saveState } from "./state.js";
import { buildDeveloperBrief, buildQaBrief, writeBrief } from "./tasks.js";
import { createTaskAssignedEvent, appendEvent } from "./events.js";
import { loadConfig } from "../config.js";
import { propagateDeveloperAssignment } from "../developer/handoff.js";

export async function assignDeveloper(
  paths: PmPaths,
  state: PmState,
  task: Task,
): Promise<AgentAssignment> {
  const briefPath = join(paths.devBriefs, `${task.task_id}.md`);
  if (!existsSync(briefPath)) {
    const brief = buildDeveloperBrief(task);
    await writeBrief(paths.devBriefs, task.task_id, brief);
  }

  const assignment: AgentAssignment = {
    agent: "developer",
    task_id: task.task_id,
    correlation_id: task.correlation_id,
    assigned_at: new Date().toISOString(),
    brief_path: briefPath,
    status: "assigned",
  };

  task.status = "developer_working";
  task.developer_brief_path = briefPath;
  task.updated_at = new Date().toISOString();

  state.developer_assignment = assignment;
  state.current_task_id = task.task_id;

  await writeFile(
    paths.developerQueue,
    JSON.stringify({ assignment, task }, null, 2),
    "utf8",
  );

  await appendEvent(
    paths,
    createTaskAssignedEvent(
      task.task_id,
      task.correlation_id,
      "developer",
      task.title,
      `Brief: ${briefPath}`,
      task.evidence,
    ),
  );

  await updateAgentStatus(paths, state);
  await saveState(paths, state);
  await propagateDeveloperAssignment(loadConfig(), task, briefPath);
  return assignment;
}

export async function assignQa(
  paths: PmPaths,
  state: PmState,
  task: Task,
): Promise<AgentAssignment> {
  const brief = buildQaBrief(task);
  const briefPath = await writeBrief(paths.qaBriefs, task.task_id, brief);

  const assignment: AgentAssignment = {
    agent: "qa",
    task_id: task.task_id,
    correlation_id: task.correlation_id,
    assigned_at: new Date().toISOString(),
    brief_path: briefPath,
    status: "assigned",
  };

  task.status = "qa_working";
  task.qa_brief_path = briefPath;
  task.updated_at = new Date().toISOString();

  state.qa_assignment = assignment;

  await writeFile(
    paths.qaQueue,
    JSON.stringify({ assignment, task }, null, 2),
    "utf8",
  );

  await appendEvent(
    paths,
    createTaskAssignedEvent(
      task.task_id,
      task.correlation_id,
      "qa",
      task.title,
      `Brief: ${briefPath}`,
      task.evidence,
    ),
  );

  await updateAgentStatus(paths, state);
  await saveState(paths, state);
  return assignment;
}

export async function readDeveloperReport(
  paths: PmPaths,
  taskId: string,
): Promise<DeveloperReport | null> {
  const file = join(paths.devReports, `${taskId}.json`);
  if (!existsSync(file)) return null;
  const raw = await readFile(file, "utf8");
  return JSON.parse(raw) as DeveloperReport;
}

export async function readQaReport(
  paths: PmPaths,
  taskId: string,
): Promise<QaReport | null> {
  const file = join(paths.qaReports, `${taskId}.json`);
  if (!existsSync(file)) return null;
  const raw = await readFile(file, "utf8");
  return JSON.parse(raw) as QaReport;
}

export async function clearDeveloperAssignment(
  paths: PmPaths,
  state: PmState,
  status: "complete" | "failed",
): Promise<void> {
  if (state.developer_assignment) {
    state.developer_assignment.status = status;
  }
  await writeFile(paths.developerQueue, JSON.stringify({ cleared: true }, null, 2), "utf8");
  state.developer_assignment = null;
  await updateAgentStatus(paths, state);
  await saveState(paths, state);
}

export async function clearQaAssignment(
  paths: PmPaths,
  state: PmState,
  status: "complete" | "failed",
): Promise<void> {
  if (state.qa_assignment) {
    state.qa_assignment.status = status;
  }
  await writeFile(paths.qaQueue, JSON.stringify({ cleared: true }, null, 2), "utf8");
  state.qa_assignment = null;
  await updateAgentStatus(paths, state);
  await saveState(paths, state);
}

export async function updateAgentStatus(paths: PmPaths, state: PmState): Promise<void> {
  const status = {
    updated_at: new Date().toISOString(),
    loop_status: state.loop_status,
    current_task_id: state.current_task_id,
    developer: state.developer_assignment,
    qa: state.qa_assignment,
    waiting_approvals: state.waiting_approvals.map((w) => w.approval_id),
    completed_count: state.completed_task_ids.length,
    blocked_count: state.blocked_task_ids.length,
  };
  await writeFile(paths.agentStatus, JSON.stringify(status, null, 2), "utf8");
}

export function devReportExists(paths: PmPaths, taskId: string): boolean {
  return existsSync(join(paths.devReports, `${taskId}.json`));
}

export function qaReportExists(paths: PmPaths, taskId: string): boolean {
  return existsSync(join(paths.qaReports, `${taskId}.json`));
}
