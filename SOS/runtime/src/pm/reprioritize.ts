/**
 * Dynamic Reprioritization Engine — Phase 8 Step 4.
 * Compares active developer work vs freshly scored highest task each planning cycle.
 */
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import type { RuntimeConfig } from "../config.js";
import { loadConfig } from "../config.js";
import { getDeveloperPaths } from "../developer/paths.js";
import { clearDeveloperForNewAssignment } from "../developer/handoff.js";
import { loadDeveloperState } from "../developer/state.js";
import type { PmPaths } from "./paths.js";
import {
  readMasterBacklog,
  readKnowledgeSummary,
  filterActionableBacklogItems,
} from "./readers.js";
import {
  assessLaunchReadiness,
  enrichLaunchReadinessWithKnowledge,
  FOUNDER_CATEGORY_ORDER,
  type FounderCategory,
} from "./founder-priority.js";
import { maintainRoadmap } from "./roadmap-planner.js";
import {
  buildSelectionReportWithKnowledge,
  scoreBacklogItem,
  type SelectionReport,
} from "./scoring.js";
import { backlogItemToTask } from "./tasks.js";
import { assignDeveloper } from "./agents.js";
import { appendJsonl, saveState } from "./state.js";
import { sendLifecycleNotification } from "../services/notification-pipeline.js";
import type {
  BacklogItem,
  PausedTaskRecord,
  PmState,
  ReprioritizationDecision,
  ReprioritizationNotificationRecord,
  ReprioritizationSnapshot,
  Task,
} from "./types.js";
import { isFounderExecuteNowTask } from "./founder-execute.js";

const PROTECTED_STATUSES = new Set([
  "assigned_qa",
  "qa_working",
  "awaiting_qa_report",
  "reviewing_qa",
  "awaiting_approval",
]);

const DEVELOPER_INTERRUPTIBLE = new Set(["assigned_developer", "developer_working"]);

export type PlanningContext = {
  backlog: BacklogItem[];
  knowledge: string[];
  actionable: BacklogItem[];
  report: SelectionReport;
  readiness: Awaited<ReturnType<typeof assessLaunchReadiness>>;
};

export function taskToBacklogItem(task: Task): BacklogItem {
  return {
    id: task.backlog_id,
    section: (task.metadata?.section as BacklogItem["section"]) ?? "planned",
    sectionRef:
      (task.metadata?.sectionRef as string)
      ?? task.backlog_id.replace(/^BL-/, "").replace("-", "."),
    title: task.title,
    description: task.description,
    priority: task.backlog_priority,
    completionPct: 0,
    evidence: task.evidence,
    needsVerification: false,
    dependencies: [],
    blockers: [],
    status: "in_progress",
  };
}

function queuedTasksAsBacklogItems(state: PmState): BacklogItem[] {
  const seen = new Set<string>();
  const items: BacklogItem[] = [];
  for (const task of state.task_queue) {
    if (task.status !== "queued") continue;
    if (seen.has(task.backlog_id)) continue;
    seen.add(task.backlog_id);
    items.push(taskToBacklogItem(task));
  }
  return items;
}

export async function reloadPlanningContext(
  paths: PmPaths,
  state: PmState,
): Promise<PlanningContext> {
  const backlog = await readMasterBacklog(paths);
  await maintainRoadmap(paths, state, backlog);
  const knowledge = await readKnowledgeSummary(paths);

  let readiness = assessLaunchReadiness(state, backlog);
  readiness = await enrichLaunchReadinessWithKnowledge(readiness, paths.knowledgeDir);

  const backlogActionable = filterActionableBacklogItems(backlog, state);
  const queueActionable = queuedTasksAsBacklogItems(state);
  const seen = new Set(backlogActionable.map((i) => i.id));
  const actionable = [
    ...backlogActionable,
    ...queueActionable.filter((i) => !seen.has(i.id)),
  ];

  const report = await buildSelectionReportWithKnowledge(
    actionable,
    backlog,
    state,
    paths.knowledgeDir,
  );

  return { backlog, knowledge, actionable, report, readiness };
}

export function scoreTask(
  task: Task,
  readiness: PlanningContext["readiness"],
): ReturnType<typeof scoreBacklogItem> {
  return scoreBacklogItem(taskToBacklogItem(task), readiness);
}

export function founderPriorityChanged(
  activeScore: ReturnType<typeof scoreBacklogItem>,
  topScore: ReturnType<typeof scoreBacklogItem>,
): boolean {
  const activeOrder = FOUNDER_CATEGORY_ORDER[activeScore.founder_category as FounderCategory] ?? 0;
  const topOrder = FOUNDER_CATEGORY_ORDER[topScore.founder_category as FounderCategory] ?? 0;

  if (topOrder > activeOrder) return true;
  if (topOrder < activeOrder) return false;

  return topScore.combined_score > activeScore.combined_score + 500;
}

export function isTaskProtectedFromInterrupt(task: Task): boolean {
  if (isFounderExecuteNowTask(task)) return true;
  return PROTECTED_STATUSES.has(task.status);
}

export function canInterruptDeveloper(task: Task): boolean {
  return DEVELOPER_INTERRUPTIBLE.has(task.status);
}

function findTaskForBacklog(state: PmState, backlogId: string): Task | undefined {
  return state.task_queue.find(
    (t) =>
      t.backlog_id === backlogId
      && !["completed", "cancelled", "paused"].includes(t.status),
  );
}

async function archiveDeveloperBrief(
  paths: PmPaths,
  task: Task,
): Promise<string | null> {
  const briefPath = task.developer_brief_path ?? join(paths.devBriefs, `${task.task_id}.md`);
  if (!existsSync(briefPath)) return null;

  await mkdir(paths.devBriefsArchived, { recursive: true });
  const archivedPath = join(paths.devBriefsArchived, `${task.task_id}.md`);
  await copyFile(briefPath, archivedPath);
  return archivedPath;
}

async function collectDeveloperArtifacts(
  config: RuntimeConfig,
  task: Task,
): Promise<PausedTaskRecord["preserved_artifacts"]> {
  const devPaths = getDeveloperPaths(config);
  let devState = null;
  try {
    if (existsSync(devPaths.state)) {
      devState = await loadDeveloperState(devPaths);
    }
  } catch {
    /* optional */
  }

  const briefPath = task.developer_brief_path ?? join(devPaths.pmBriefs, `${task.task_id}.md`);

  return {
    work_plan_path: devState?.work_plan_path ?? null,
    implementation_plan_path: devState?.implementation_plan_path ?? null,
    execution_report_path: devState?.execution_report_path ?? null,
    developer_brief_path: existsSync(briefPath) ? briefPath : null,
  };
}

export function buildPauseEventId(
  pausedTaskId: string,
  pausedBacklogId: string,
  replacementTaskId: string,
  replacementBacklogId: string,
): string {
  return `reprio:${pausedTaskId}:${pausedBacklogId}:${replacementTaskId}:${replacementBacklogId}`;
}

export function isPauseNotificationSent(
  state: PmState,
  eventId: string,
  pausedTaskId: string,
): boolean {
  if (state.notified_pause_ids?.includes(pausedTaskId)) return true;
  return (
    state.reprioritization_notifications?.some(
      (n) =>
        (n.event_id === eventId || n.paused_task_id === pausedTaskId) && n.telegram_sent,
    ) ?? false
  );
}

export function isTaskAlreadyPausedForReprioritization(
  state: PmState,
  task: Task,
): boolean {
  if (task.status === "paused") return true;
  return state.paused_tasks?.some((p) => p.task_id === task.task_id) ?? false;
}

export function reservePauseNotification(
  state: PmState,
  eventId: string,
  paused: PausedTaskRecord,
  replacementTask: Task,
): { shouldNotify: boolean; record: ReprioritizationNotificationRecord } {
  state.reprioritization_notifications ??= [];

  const existing = state.reprioritization_notifications.find(
    (n) => n.event_id === eventId || n.paused_task_id === paused.task_id,
  );

  if (existing?.telegram_sent) {
    return { shouldNotify: false, record: existing };
  }

  if (existing) {
    return { shouldNotify: true, record: existing };
  }

  const record: ReprioritizationNotificationRecord = {
    event_id: eventId,
    paused_task_id: paused.task_id,
    paused_backlog_id: paused.backlog_id,
    replacement_task_id: replacementTask.task_id,
    replacement_backlog_id: replacementTask.backlog_id,
    notified_at: new Date().toISOString(),
    telegram_sent: false,
  };
  state.reprioritization_notifications.push(record);
  return { shouldNotify: true, record };
}

export function markPauseNotificationSent(
  state: PmState,
  record: ReprioritizationNotificationRecord,
  pausedTaskId: string,
): void {
  record.telegram_sent = true;
  record.notified_at = new Date().toISOString();
  state.notified_pause_ids ??= [];
  if (!state.notified_pause_ids.includes(pausedTaskId)) {
    state.notified_pause_ids.push(pausedTaskId);
  }
}

export function unmarkPauseNotificationSent(
  state: PmState,
  record: ReprioritizationNotificationRecord,
  pausedTaskId: string,
): void {
  record.telegram_sent = false;
  state.notified_pause_ids = (state.notified_pause_ids ?? []).filter((id) => id !== pausedTaskId);
}

async function setDeveloperPaused(config: RuntimeConfig, taskId: string): Promise<void> {
  const devPaths = getDeveloperPaths(config);
  if (!existsSync(devPaths.state)) return;
  const { loadDeveloperState, saveDeveloperState } = await import("../developer/state.js");
  const devState = await loadDeveloperState(devPaths);
  devState.state = "paused";
  devState.current_task_id = taskId;
  await saveDeveloperState(devPaths, devState);
}

export async function notifyTaskPaused(
  config: RuntimeConfig,
  paths: PmPaths,
  state: PmState,
  paused: PausedTaskRecord,
  replacementTask: Task,
  eventId: string,
): Promise<boolean> {
  if (isPauseNotificationSent(state, eventId, paused.task_id)) return false;

  const { shouldNotify, record } = reservePauseNotification(
    state,
    eventId,
    paused,
    replacementTask,
  );
  if (!shouldNotify) return false;

  if (!config.telegramBotToken || !config.telegramChatId) return false;

  const text = [
    "⏸ Task paused: " + paused.title,
    `Reason: ${paused.reason}`,
    `New task: ${paused.replacement_title ?? "—"}`,
    `Why it changed: ${paused.why_changed}`,
  ].join("\n");

  markPauseNotificationSent(state, record, paused.task_id);

  const result = await sendLifecycleNotification(config, paths, {
    event_id: eventId,
    correlation_id: replacementTask.correlation_id,
    source: "pm",
    caller: "notifyTaskPaused",
    task_id: paused.task_id,
    title: `Task paused: ${paused.title}`,
    body: text,
    type: "info",
    priority: "P2",
    metadata: {
      paused_task_id: paused.task_id,
      replacement_task_id: replacementTask.task_id,
      replacement_title: paused.replacement_title,
    },
  });
  if (!result.telegram_ok) {
    unmarkPauseNotificationSent(state, record, paused.task_id);
  }
  return result.telegram_ok;
}

async function ensureReplacementTask(
  state: PmState,
  topItem: BacklogItem,
  report: SelectionReport,
): Promise<Task> {
  const existing = findTaskForBacklog(state, topItem.id);
  if (existing) return existing;

  const task = backlogItemToTask(topItem);
  task.metadata = {
    ...task.metadata,
    section: topItem.section,
    sectionRef: topItem.sectionRef,
    selected_at: new Date().toISOString(),
    selection_score: report.selected?.combined_score,
    selection_founder_score: report.selected?.founder_score,
    selection_technical_score: report.selected?.technical_score,
    selection_founder_category: report.selected?.founder_category,
    launch_stage: report.launch_readiness.launch_stage,
    selection_reason: report.selected_reason,
    reprioritized: true,
  };
  state.task_queue.push(task);
  return task;
}

export async function pauseTaskForReprioritization(
  config: RuntimeConfig,
  paths: PmPaths,
  state: PmState,
  activeTask: Task,
  topItem: BacklogItem,
  replacementTask: Task,
  activeScore: ReturnType<typeof scoreBacklogItem>,
  topScore: ReturnType<typeof scoreBacklogItem>,
  whyChanged: string,
  eventId: string,
): Promise<PausedTaskRecord> {
  const archivedPath = await archiveDeveloperBrief(paths, activeTask);
  const artifacts = await collectDeveloperArtifacts(config, activeTask);

  await setDeveloperPaused(config, activeTask.task_id);

  activeTask.status = "paused";
  activeTask.updated_at = new Date().toISOString();
  activeTask.metadata = {
    ...activeTask.metadata,
    paused_at: new Date().toISOString(),
    pause_reason: whyChanged,
    founder_override: true,
  };

  state.developer_assignment = null;
  state.current_task_id = null;

  const paused: PausedTaskRecord = {
    task_id: activeTask.task_id,
    backlog_id: activeTask.backlog_id,
    title: activeTask.title,
    paused_at: new Date().toISOString(),
    reason: `Founder priority override: ${topScore.founder_category_label} (${topScore.combined_score}) over ${activeScore.founder_category_label} (${activeScore.combined_score})`,
    why_changed: whyChanged,
    founder_override: true,
    active_founder_category: activeScore.founder_category,
    active_founder_score: activeScore.founder_score,
    active_combined_score: activeScore.combined_score,
    replacement_backlog_id: replacementTask.backlog_id,
    replacement_task_id: replacementTask.task_id,
    replacement_title: replacementTask.title,
    archived_brief_path: archivedPath,
    preserved_artifacts: artifacts,
    decision: "pause",
    can_resume: true,
    reprioritization_event_id: eventId,
  };

  state.paused_tasks ??= [];
  const existingIdx = state.paused_tasks.findIndex((p) => p.task_id === paused.task_id);
  if (existingIdx >= 0) state.paused_tasks[existingIdx] = paused;
  else state.paused_tasks.push(paused);

  await appendJsonl(paths.executionLog, {
    timestamp: new Date().toISOString(),
    message: "task_paused_reprioritization",
    paused_task_id: paused.task_id,
    replacement_task_id: replacementTask.task_id,
    reason: paused.reason,
    archived_brief: archivedPath,
    preserved_artifacts: artifacts,
  });

  return paused;
}

export type ReprioritizeResult = {
  decision: ReprioritizationDecision;
  founder_override: boolean;
  paused: PausedTaskRecord | null;
  replacement_task: Task | null;
  reason: string;
  why_changed: string | null;
  context: PlanningContext;
};

export async function runReprioritizationCycle(
  config: RuntimeConfig,
  paths: PmPaths,
  state: PmState,
  options: { assignReplacement?: boolean; notify?: boolean } = {},
): Promise<ReprioritizeResult> {
  const assignReplacement = options.assignReplacement ?? true;
  const notify = options.notify ?? true;

  const context = await reloadPlanningContext(paths, state);
  const { report, readiness } = context;

  const activeTask = state.current_task_id
    ? state.task_queue.find((t) => t.task_id === state.current_task_id)
    : state.task_queue.find((t) => canInterruptDeveloper(t) || isTaskProtectedFromInterrupt(t));

  const snapshot: ReprioritizationSnapshot = {
    last_cycle_at: new Date().toISOString(),
    decision: "none",
    founder_override: false,
    current_task_id: activeTask?.task_id ?? null,
    current_task_title: activeTask?.title ?? null,
    highest_backlog_id: report.selected?.item.id ?? null,
    highest_task_title: report.selected?.item.title ?? null,
    replacement_task_id: null,
    reason: null,
    why_changed: null,
  };

  if (!activeTask || !report.selected) {
    snapshot.decision = "continue";
    snapshot.reason = activeTask
      ? "Active task remains — no higher-ranked alternative"
      : "No active developer task";
    state.reprioritization = snapshot;
    return {
      decision: snapshot.decision,
      founder_override: false,
      paused: null,
      replacement_task: null,
      reason: snapshot.reason,
      why_changed: null,
      context,
    };
  }

  if (isFounderExecuteNowTask(activeTask)) {
    snapshot.decision = "continue";
    snapshot.reason = "Founder EXECUTE_NOW task — reprioritization blocked until complete";
    snapshot.founder_override = true;
    state.reprioritization = snapshot;
    return {
      decision: snapshot.decision,
      founder_override: true,
      paused: null,
      replacement_task: null,
      reason: snapshot.reason,
      why_changed: null,
      context,
    };
  }

  if (isTaskProtectedFromInterrupt(activeTask)) {
    snapshot.decision = "continue";
    snapshot.reason = `Protected status: ${activeTask.status} — no interrupt`;
    state.reprioritization = snapshot;
    return {
      decision: "continue",
      founder_override: false,
      paused: null,
      replacement_task: null,
      reason: snapshot.reason,
      why_changed: null,
      context,
    };
  }

  if (!canInterruptDeveloper(activeTask)) {
    snapshot.decision = "continue";
    snapshot.reason = `Task status ${activeTask.status} not interruptible`;
    state.reprioritization = snapshot;
    return {
      decision: "continue",
      founder_override: false,
      paused: null,
      replacement_task: null,
      reason: snapshot.reason,
      why_changed: null,
      context,
    };
  }

  const activeScore = scoreTask(activeTask, readiness);
  const topScore = report.selected;
  const sameWork =
    activeTask.backlog_id === topScore.item.id
    || activeTask.task_id === findTaskForBacklog(state, topScore.item.id)?.task_id;

  if (sameWork) {
    snapshot.decision = "continue";
    snapshot.reason = "Active task is still highest ranked";
    state.reprioritization = snapshot;
    return {
      decision: "continue",
      founder_override: false,
      paused: null,
      replacement_task: null,
      reason: snapshot.reason,
      why_changed: null,
      context,
    };
  }

  if (!founderPriorityChanged(activeScore, topScore)) {
    snapshot.decision = "continue";
    snapshot.reason = "Founder priority unchanged — continue current work";
    state.reprioritization = snapshot;
    return {
      decision: "continue",
      founder_override: false,
      paused: null,
      replacement_task: null,
      reason: snapshot.reason,
      why_changed: null,
      context,
    };
  }

  const whyChanged = `Founder engine re-ranked: ${topScore.founder_category_label} (${topScore.combined_score}) now beats ${activeScore.founder_category_label} (${activeScore.combined_score})`;

  const replacementTask = await ensureReplacementTask(state, topScore.item, report);
  const eventId = buildPauseEventId(
    activeTask.task_id,
    activeTask.backlog_id,
    replacementTask.task_id,
    replacementTask.backlog_id,
  );

  if (isTaskAlreadyPausedForReprioritization(state, activeTask)) {
    snapshot.decision = "continue";
    snapshot.reason = "Task already paused — skipping duplicate reprioritization";
    state.reprioritization = snapshot;
    return {
      decision: "continue",
      founder_override: false,
      paused: state.paused_tasks?.find((p) => p.task_id === activeTask.task_id) ?? null,
      replacement_task: replacementTask,
      reason: snapshot.reason,
      why_changed: null,
      context,
    };
  }

  if (isPauseNotificationSent(state, eventId, activeTask.task_id)) {
    snapshot.decision = "continue";
    snapshot.reason = "Pause notification already sent for this reprioritization event";
    state.reprioritization = snapshot;
    return {
      decision: "continue",
      founder_override: false,
      paused: null,
      replacement_task: replacementTask,
      reason: snapshot.reason,
      why_changed: null,
      context,
    };
  }

  const paused = await pauseTaskForReprioritization(
    config,
    paths,
    state,
    activeTask,
    topScore.item,
    replacementTask,
    activeScore,
    topScore,
    whyChanged,
    eventId,
  );

  await clearDeveloperForNewAssignment(config);

  if (assignReplacement) {
    await assignDeveloper(paths, state, replacementTask);
    if (notify) {
      await notifyTaskPaused(config, paths, state, paused, replacementTask, eventId);
    }
    await saveState(paths, state);
  }

  snapshot.decision = "pause";
  snapshot.founder_override = true;
  snapshot.replacement_task_id = replacementTask.task_id;
  snapshot.reason = paused.reason;
  snapshot.why_changed = whyChanged;
  state.reprioritization = snapshot;

  await appendJsonl(paths.executionLog, {
    timestamp: new Date().toISOString(),
    message: "reprioritization_cycle",
    decision: "pause",
    founder_override: true,
    paused_task_id: paused.task_id,
    replacement_task_id: replacementTask.task_id,
  });

  return {
    decision: "pause",
    founder_override: true,
    paused,
    replacement_task: replacementTask,
    reason: paused.reason,
    why_changed: whyChanged,
    context,
  };
}

export async function resumePausedTask(
  paths: PmPaths,
  state: PmState,
  taskId: string,
): Promise<Task | null> {
  const paused = state.paused_tasks?.find((p) => p.task_id === taskId && p.can_resume);
  if (!paused) return null;

  const task = state.task_queue.find((t) => t.task_id === taskId);
  if (!task) return null;

  task.status = "queued";
  task.updated_at = new Date().toISOString();
  task.metadata = {
    ...task.metadata,
    resumed_at: new Date().toISOString(),
    resumed_from_pause: true,
  };

  paused.can_resume = false;

  await appendJsonl(paths.executionLog, {
    timestamp: new Date().toISOString(),
    message: "task_resumed_from_pause",
    task_id: taskId,
    archived_brief: paused.archived_brief_path,
    preserved_artifacts: paused.preserved_artifacts,
  });

  return task;
}

export function clonePmStateForVerify(state: PmState): PmState {
  return JSON.parse(JSON.stringify(state)) as PmState;
}
