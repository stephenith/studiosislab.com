import { readFile, writeFile } from "node:fs/promises";
import type { RuntimeConfig } from "../../config.js";
import type { PmPaths } from "../../pm/paths.js";
import { loadState, saveState } from "../../pm/state.js";
import {
  reloadPlanningContext,
  pauseTaskForReprioritization,
  resumePausedTask,
  buildPauseEventId,
  notifyTaskPaused,
  scoreTask,
} from "../../pm/reprioritize.js";
import { assignDeveloper } from "../../pm/agents.js";
import { scoreBacklogItem } from "../../pm/scoring.js";
import type { BacklogItem, PmState, Task } from "../../pm/types.js";
import { readMasterBacklog } from "../../pm/readers.js";

export type TaskMatch = {
  task: Task;
  score: number;
};

function normalize(text: string): string {
  return text.toLowerCase().replace(/[^\w\s]/g, " ").replace(/\s+/g, " ").trim();
}

export function scoreNameMatch(query: string, title: string, backlogId: string): number {
  const q = normalize(query);
  const t = normalize(title);
  const b = normalize(backlogId);
  if (!q) return 0;
  if (t.includes(q) || q.includes(t) || b.includes(q.replace(/\s/g, "-"))) return 100;
  const words = q.split(" ").filter((w) => w.length > 2);
  if (words.length === 0) return 0;
  const hits = words.filter((w) => t.includes(w) || b.includes(w));
  return (hits.length / words.length) * 90;
}

export function findTaskByReference(
  state: PmState,
  backlog: BacklogItem[],
  query: string | null | undefined,
): TaskMatch | null {
  if (!query?.trim()) return null;
  let best: TaskMatch | null = null;
  for (const task of state.task_queue) {
    const score = scoreNameMatch(query, task.title, task.backlog_id);
    if (!best || score > best.score) best = { task, score };
  }
  for (const item of backlog) {
    const score = scoreNameMatch(query, item.title, item.id);
    if (score < 50) continue;
    const task = state.task_queue.find((t) => t.backlog_id === item.id);
    if (task && (!best || score > best.score)) best = { task, score };
  }
  return best && best.score >= 40 ? best : null;
}

export function findBacklogByReference(
  backlog: BacklogItem[],
  query: string | null | undefined,
  state?: PmState,
): BacklogItem | null {
  if (!query?.trim()) return null;
  let best: { item: BacklogItem; score: number } | null = null;
  for (const item of backlog) {
    const score = scoreNameMatch(query, item.title, item.id);
    if (!best || score > best.score) best = { item, score };
  }
  if (state) {
    for (const task of state.task_queue) {
      const score = scoreNameMatch(query, task.title, task.backlog_id);
      if (score < 50) continue;
      const item = backlog.find((b) => b.id === task.backlog_id)
        ?? {
          id: task.backlog_id,
          section: (task.metadata?.section as BacklogItem["section"]) ?? "planned",
          sectionRef: (task.metadata?.sectionRef as string) ?? task.backlog_id,
          title: task.title,
          description: task.description,
          priority: task.backlog_priority,
          completionPct: 0,
          evidence: task.evidence,
          needsVerification: false,
          dependencies: [],
          blockers: [],
          status: "actionable",
        };
      if (!best || score > best.score) best = { item, score };
    }
  }
  return best && best.score >= 40 ? best.item : null;
}

export async function pauseTaskByReference(
  config: RuntimeConfig,
  paths: PmPaths,
  state: PmState,
  query: string,
): Promise<{ ok: boolean; message: string; details?: Record<string, unknown> }> {
  const backlog = await readMasterBacklog(paths);
  const match = findTaskByReference(state, backlog, query);
  if (!match) {
    return { ok: false, message: `I could not find a task matching "${query}".` };
  }

  const activeId = state.current_task_id;
  const activeTask = activeId
    ? state.task_queue.find((t) => t.task_id === activeId)
    : state.task_queue.find((t) => ["developer_working", "assigned_developer"].includes(t.status));

  if (!activeTask || activeTask.task_id !== match.task.task_id) {
    match.task.status = "paused";
    match.task.updated_at = new Date().toISOString();
    match.task.metadata = {
      ...match.task.metadata,
      paused_at: new Date().toISOString(),
      pause_reason: `Commander inbox: ${query}`,
    };
    await saveState(paths, state);
    return {
      ok: true,
      message: `Paused "${match.task.title}".`,
      details: { task_id: match.task.task_id, backlog_id: match.task.backlog_id },
    };
  }

  const ctx = await reloadPlanningContext(paths, state);
  const replacement = ctx.report.selected?.item;
  if (!replacement || replacement.id === match.task.backlog_id) {
    return {
      ok: false,
      message: `No replacement task available to swap out "${match.task.title}".`,
    };
  }

  const replacementTask =
    state.task_queue.find((t) => t.backlog_id === replacement.id)
    ?? (await import("../../pm/tasks.js")).backlogItemToTask(replacement);

  if (!state.task_queue.some((t) => t.task_id === replacementTask.task_id)) {
    state.task_queue.push(replacementTask);
  }

  const activeScore = scoreTask(activeTask, ctx.readiness);
  const topScore = ctx.report.selected!;
  const eventId = buildPauseEventId(
    activeTask.task_id,
    activeTask.backlog_id,
    replacementTask.task_id,
    replacementTask.backlog_id,
  );

  const paused = await pauseTaskForReprioritization(
    config,
    paths,
    state,
    activeTask,
    replacement,
    replacementTask,
    activeScore,
    topScore,
    `Founder inbox: pause ${query}`,
    eventId,
  );

  await assignDeveloper(paths, state, replacementTask);
  await notifyTaskPaused(config, paths, state, paused, replacementTask, eventId);
  await saveState(paths, state);

  return {
    ok: true,
    message: `Paused "${activeTask.title}" and reassigned Developer to "${replacementTask.title}".`,
    details: {
      paused_task_id: activeTask.task_id,
      replacement_task_id: replacementTask.task_id,
    },
  };
}

export async function resumeTaskByReference(
  config: RuntimeConfig,
  paths: PmPaths,
  state: PmState,
  query: string,
): Promise<{ ok: boolean; message: string; details?: Record<string, unknown> }> {
  const backlog = await readMasterBacklog(paths);
  const match = findTaskByReference(state, backlog, query);
  const pausedRecord = state.paused_tasks?.find(
    (p) => scoreNameMatch(query, p.title, p.backlog_id) >= 40,
  );

  const taskId = match?.task.task_id ?? pausedRecord?.task_id;
  if (!taskId) {
    return { ok: false, message: `I could not find a paused task matching "${query}".` };
  }

  let resumed = await resumePausedTask(paths, state, taskId);
  if (!resumed && match) {
    if (match.task.status === "paused") {
      match.task.status = "queued";
      match.task.updated_at = new Date().toISOString();
      resumed = match.task;
    } else {
      return { ok: false, message: `"${match.task.title}" is not paused.` };
    }
  }

  if (!resumed) {
    return { ok: false, message: `Could not resume task for "${query}".` };
  }

  await assignDeveloper(paths, state, resumed);
  await saveState(paths, state);

  return {
    ok: true,
    message: `Resumed "${resumed.title}" and assigned Developer.`,
    details: { task_id: resumed.task_id },
  };
}

export async function prioritizeTaskByReference(
  config: RuntimeConfig,
  paths: PmPaths,
  state: PmState,
  query: string,
): Promise<{ ok: boolean; message: string; details?: Record<string, unknown> }> {
  const backlog = await readMasterBacklog(paths);
  const targetItem = findBacklogByReference(backlog, query, state);
  if (!targetItem) {
    return { ok: false, message: `I could not find work matching "${query}" in the roadmap.` };
  }

  const ctx = await reloadPlanningContext(paths, state);
  const activeTask = state.current_task_id
    ? state.task_queue.find((t) => t.task_id === state.current_task_id)
    : state.task_queue.find((t) => ["developer_working", "assigned_developer"].includes(t.status));

  let replacementTask = state.task_queue.find((t) => t.backlog_id === targetItem.id);
  if (!replacementTask) {
    const { backlogItemToTask } = await import("../../pm/tasks.js");
    replacementTask = backlogItemToTask(targetItem);
    state.task_queue.push(replacementTask);
  }

  if (!activeTask || activeTask.backlog_id === targetItem.id) {
    await assignDeveloper(paths, state, replacementTask);
    state.current_task_id = replacementTask.task_id;
    await saveState(paths, state);
    return {
      ok: true,
      message: `Developer is now focused on "${replacementTask.title}".`,
      details: { task_id: replacementTask.task_id },
    };
  }

  const activeScore = scoreTask(activeTask, ctx.readiness);
  const topScore = scoreBacklogItem(targetItem, ctx.readiness);
  const eventId = buildPauseEventId(
    activeTask.task_id,
    activeTask.backlog_id,
    replacementTask.task_id,
    replacementTask.backlog_id,
  );

  const paused = await pauseTaskForReprioritization(
    config,
    paths,
    state,
    activeTask,
    targetItem,
    replacementTask,
    activeScore,
    topScore,
    `Founder inbox priority: finish ${query} first`,
    eventId,
  );

  await assignDeveloper(paths, state, replacementTask);
  await notifyTaskPaused(config, paths, state, paused, replacementTask, eventId);
  await saveState(paths, state);

  return {
    ok: true,
    message: `Priority updated. Developer reassigned to "${replacementTask.title}". Roadmap reflects the new order.`,
    details: {
      paused: activeTask.title,
      assigned: replacementTask.title,
    },
  };
}

export async function appendBacklogItem(
  paths: PmPaths,
  item: {
    sectionRef: string;
    title: string;
    description: string;
    priority: string;
  },
): Promise<{ backlog_id: string }> {
  const content = await readFile(paths.backlog, "utf8");
  const section5 = content.indexOf("\n## 5. Future Ideas");
  const insertAt = section5 === -1 ? content.length : section5;
  const block = `
### ${item.sectionRef} ${item.title}

| Field | Value |
|-------|-------|
| **Title** | ${item.title} |
| **Description** | ${item.description} |
| **Priority** | ${item.priority} |
| **Estimated Completion (%)** | 0 |
| **Dependencies** | None |
| **Repository evidence** | Commander inbox request |
| **Needs Verification** | Scope to be refined by PM |

---

`;
  const updated = content.slice(0, insertAt) + block + content.slice(insertAt);
  await writeFile(paths.backlog, updated, "utf8");
  const backlogId = `BL-${item.sectionRef.replace(".", "-")}`;
  return { backlog_id: backlogId };
}
