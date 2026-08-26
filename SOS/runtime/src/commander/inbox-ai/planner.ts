import { randomUUID } from "node:crypto";
import type { RuntimeConfig } from "../../config.js";
import { getPmPaths } from "../../pm/paths.js";
import { loadState, saveState } from "../../pm/state.js";
import { readMasterBacklog } from "../../pm/readers.js";
import { maintainRoadmap, buildRoadmapStatus } from "../../pm/roadmap-planner.js";
import { planNextTask, notifyTaskAssignment } from "../../pm/planning.js";
import { reloadPlanningContext } from "../../pm/reprioritize.js";
import { scoreBacklogItem } from "../../pm/scoring.js";
import { assignDeveloper } from "../../pm/agents.js";
import { buildDeveloperBrief, writeBrief } from "../../pm/tasks.js";
import type { Task } from "../../pm/types.js";
import { appendBacklogItem } from "./task-router.js";

function extractEvidencePaths(instruction: string): string[] {
  const matches = instruction.match(/(?:SOS|src)\/[\w./_-]+/g) ?? [];
  return [...new Set(matches)];
}

function buildExecuteNowBrief(task: Task): string {
  const base = buildDeveloperBrief(task);
  return `${base}
## Execution mode
Immediate founder command — bypass roadmap. Complete the instruction exactly, then hand off to QA.
`;
}

function demoteOtherDeveloperTasks(state: Awaited<ReturnType<typeof loadState>>, taskId: string): void {
  for (const t of state.task_queue) {
    if (t.task_id !== taskId && (t.status === "developer_working" || t.status === "assigned_developer")) {
      t.status = "queued";
      t.updated_at = new Date().toISOString();
    }
  }
}

export async function executeNowFromInbox(
  config: RuntimeConfig,
  instruction: string,
): Promise<{ ok: boolean; message: string; details?: Record<string, unknown> }> {
  const paths = getPmPaths(config);
  const state = await loadState(paths);
  const trimmed = instruction.trim();
  const taskId = `TASK-INBOX-EXEC-${Date.now()}`;
  const evidence = extractEvidencePaths(trimmed);

  const task: Task = {
    task_id: taskId,
    correlation_id: randomUUID(),
    backlog_id: "INBOX-EXEC",
    title: trimmed.length > 100 ? `${trimmed.slice(0, 97)}...` : trimmed,
    description: trimmed,
    priority: "P0",
    backlog_priority: "Critical",
    status: "queued",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    evidence: evidence.length > 0 ? evidence : ["SOS/"],
    requires_commander_approval: false,
    hard_gate_ids: [],
    confidence: 95,
    qa_required: true,
    metadata: {
      inbox_execute: true,
      founder_instruction: trimmed,
      bypass_roadmap: true,
      command_class: "EXECUTE_NOW",
      source: "telegram_execute_now",
    },
  };

  state.task_queue.push(task);
  demoteOtherDeveloperTasks(state, taskId);

  const brief = buildExecuteNowBrief(task);
  await writeBrief(paths.devBriefs, task.task_id, brief);
  task.developer_brief_path = `${paths.devBriefs}/${task.task_id}.md`;

  await assignDeveloper(paths, state, task);
  await notifyTaskAssignment(config, state, task);
  await saveState(paths, state);

  return {
    ok: true,
    message:
      `Executing now — Developer assigned immediately (no roadmap).\n`
      + `Task: ${taskId}\n`
      + `Instruction: ${trimmed}`,
    details: {
      task_id: taskId,
      backlog_id: "INBOX-EXEC",
      assigned: true,
      bypass_roadmap: true,
      command_class: "EXECUTE_NOW",
    },
  };
}

function nextSectionRef(existingRefs: string[]): string {
  const nums = existingRefs
    .map((r) => r.match(/^(\d+)\.(\d+)/))
    .filter(Boolean)
    .map((m) => parseInt(m![2], 10));
  const max = nums.length ? Math.max(...nums) : 7;
  return `4.${max + 1}`;
}

export async function createTaskFromInbox(
  config: RuntimeConfig,
  title: string,
  quantity = 1,
): Promise<{ ok: boolean; message: string; details?: Record<string, unknown> }> {
  const paths = getPmPaths(config);
  const state = await loadState(paths);
  const backlog = await readMasterBacklog(paths);
  const refs = backlog.map((b) => b.sectionRef);
  const created: string[] = [];

  for (let i = 0; i < Math.min(quantity, 20); i++) {
    const suffix = quantity > 1 ? ` (${i + 1}/${quantity})` : "";
    const sectionRef = nextSectionRef([...refs, ...created.map((id) => id.replace("BL-", "").replace("-", "."))]);
    const itemTitle = `${title}${suffix}`.trim();
    const { backlog_id } = await appendBacklogItem(paths, {
      sectionRef,
      title: itemTitle,
      description: `Created via Commander inbox: ${itemTitle}`,
      priority: "Medium",
    });
    created.push(backlog_id);
  }

  const freshBacklog = await readMasterBacklog(paths);
  await maintainRoadmap(paths, state, freshBacklog);
  const ctx = await reloadPlanningContext(paths, state);
  const plan = await planNextTask(config, paths, state, {
    assign: false,
    notify: false,
    skipReprioritize: true,
  });
  await saveState(paths, state);

  const scored = created.map((id) => {
    const item = freshBacklog.find((b) => b.id === id);
    if (!item) return null;
    const s = scoreBacklogItem(item, ctx.readiness);
    return { backlog_id: id, title: item.title, founder_score: s.founder_score, combined_score: s.combined_score };
  }).filter(Boolean);

  return {
    ok: true,
    message:
      created.length === 1
        ? `Added "${title}" to the roadmap for planning. PM will schedule by founder score — no immediate Developer execution.`
        : `Added ${created.length} items to the roadmap for planning. PM will queue by founder score.`,
    details: { created, scored, plan_action: plan.action, command_class: "PLANNING" },
  };
}

export async function createEpicFromInbox(
  config: RuntimeConfig,
  title: string,
): Promise<{ ok: boolean; message: string; details?: Record<string, unknown> }> {
  return createTaskFromInbox(config, title || "New epic", 1);
}

export async function refreshRoadmapFromInbox(
  config: RuntimeConfig,
): Promise<{ ok: boolean; message: string; details?: Record<string, unknown> }> {
  const paths = getPmPaths(config);
  const state = await loadState(paths);
  const backlog = await readMasterBacklog(paths);
  const result = await maintainRoadmap(paths, state, backlog);
  const status = await buildRoadmapStatus(paths, state);
  await saveState(paths, state);

  return {
    ok: true,
    message: `Roadmap refreshed. ${result.tasks_inserted.length} new slice(s) unlocked. Completion ${status.completion_pct ?? 0}%.`,
    details: {
      tasks_inserted: result.tasks_inserted.map((t) => t.title),
      completion_pct: status.completion_pct,
    },
  };
}
