import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { RuntimeConfig } from "../config.js";
import type { PmPaths } from "./paths.js";
import { getPmPaths } from "./paths.js";
import {
  readMasterBacklog,
  filterActionableBacklogItems,
} from "./readers.js";
import {
  selectHighestPriorityTaskWithKnowledge,
  hasActivePipelineTask,
  buildSelectionReportWithKnowledge,
} from "./scoring.js";
import { reloadPlanningContext } from "./reprioritize.js";
import { backlogItemToTask } from "./tasks.js";
import type { PmState, Task } from "./types.js";
import { assignDeveloper } from "./agents.js";
import { saveState, appendJsonl } from "./state.js";
import { sendLifecycleNotification } from "../services/notification-pipeline.js";

export type PlanResult =
  | {
      action: "assigned";
      task: Task;
      brief_path: string;
      backlog_id: string;
      telegram_sent: boolean;
      selection_score: number;
      selection_tier: number;
    }
  | {
      action: "already_active";
      task: Task;
      brief_path?: string;
      reason: string;
    }
  | {
      action: "idle";
      report_path: string;
      telegram_sent: boolean;
      reason: string;
    };

const ACTIVE_STATUSES = new Set([
  "queued",
  "assigned_developer",
  "developer_working",
  "awaiting_dev_report",
  "reviewing_dev",
  "assigned_qa",
  "qa_working",
  "awaiting_qa_report",
  "reviewing_qa",
  "awaiting_approval",
]);

export function findActiveTask(state: PmState): Task | undefined {
  if (state.current_task_id) {
    const current = state.task_queue.find((t) => t.task_id === state.current_task_id);
    if (current && ACTIVE_STATUSES.has(current.status)) return current;
  }
  return state.task_queue.find((t) => ACTIVE_STATUSES.has(t.status));
}

export async function notifyTaskAssignment(
  config: RuntimeConfig,
  state: PmState,
  task: Task,
): Promise<boolean> {
  if (state.notified_backlog_ids.includes(task.backlog_id)) {
    return false;
  }

  const founderReason = "Selected because it is currently the highest launch-value task.";

  const text = [
    "ℹ️ PM selected task: " + task.title,
    "Assigned to Developer",
    `Reason: ${founderReason}`,
    "No action needed from Commander",
  ].join("\n");

  if (!config.telegramBotToken || !config.telegramChatId) return false;

  const paths = getPmPaths(config);
  const result = await sendLifecycleNotification(config, paths, {
    event_id: `assign:${task.task_id}:${task.backlog_id}`,
    correlation_id: task.correlation_id,
    source: "pm",
    caller: "notifyTaskAssignment",
    task_id: task.task_id,
    title: `PM selected task: ${task.title}`,
    body: text,
    type: "info",
    priority: "P2",
    metadata: { backlog_id: task.backlog_id },
  });
  if (result.telegram_ok) {
    state.notified_backlog_ids.push(task.backlog_id);
  }
  return result.telegram_ok;
}

async function writeIdleReport(
  paths: PmPaths,
  reason: string,
  scanned: number,
): Promise<string> {
  const reportPath = join(paths.root, "idle-report.md");
  const body = `# PM Idle Report

**Generated:** ${new Date().toISOString()}

## Status

No actionable backlog task available for autonomous assignment.

## Reason

${reason}

## Backlog scan

- Items scanned: ${scanned}
`;

  await writeFile(reportPath, body, "utf8");
  return reportPath;
}

function persistSelectionReport(
  state: PmState,
  report: Awaited<ReturnType<typeof buildSelectionReportWithKnowledge>>,
): void {
  state.last_selection = {
    backlog_id: report.selected?.item.id ?? null,
    title: report.selected?.item.title ?? null,
    score: report.selected?.combined_score ?? report.selected?.score ?? null,
    technical_score: report.selected?.technical_score ?? null,
    founder_score: report.selected?.founder_score ?? null,
    combined_score: report.selected?.combined_score ?? null,
    tier: report.selected?.tier ?? null,
    founder_category: report.selected?.founder_category ?? null,
    launch_stage: report.launch_readiness.launch_stage,
    reason: report.selected_reason,
    skipped: report.skipped.map((s) => ({
      backlog_id: s.backlog_id,
      title: s.title,
      tier: s.tier,
      why_skipped: s.why_skipped,
    })),
    remaining_by_tier: report.remaining_by_tier,
    at: new Date().toISOString(),
  };
}

export async function planNextTask(
  config: RuntimeConfig,
  paths: PmPaths,
  state: PmState,
  options: { assign?: boolean; notify?: boolean; skipReprioritize?: boolean } = {},
): Promise<PlanResult> {
  const assign = options.assign ?? true;
  const notify = options.notify ?? true;
  const skipReprioritize = options.skipReprioritize ?? false;

  if (!skipReprioritize) {
    const { runReprioritizationCycle } = await import("./reprioritize.js");
    const reprio = await runReprioritizationCycle(config, paths, state, {
      assignReplacement: assign && notify,
      notify,
    });

    if (reprio.decision === "pause" && reprio.replacement_task) {
      await saveState(paths, state);
      return {
        action: "assigned",
        task: reprio.replacement_task,
        brief_path: reprio.replacement_task.developer_brief_path ?? "",
        backlog_id: reprio.replacement_task.backlog_id,
        telegram_sent: Boolean(state.notified_pause_ids?.includes(reprio.paused?.task_id ?? "")),
        selection_score: reprio.context.report.selected?.combined_score ?? 0,
        selection_tier: reprio.context.report.selected?.tier ?? 0,
      };
    }
  }

  if (hasActivePipelineTask(state)) {
    const active = findActiveTask(state);
    if (active) {
      return {
        action: "already_active",
        task: active,
        brief_path: active.developer_brief_path ?? active.qa_brief_path,
        reason: `Pipeline busy — ${active.task_id} is ${active.status}`,
      };
    }
  }

  const context = await reloadPlanningContext(paths, state);
  const actionable = context.actionable;
  const { item: selected, report } = await selectHighestPriorityTaskWithKnowledge(
    actionable,
    context.backlog,
    state,
    paths.knowledgeDir,
  );
  persistSelectionReport(state, report);

  if (!selected) {
    const reason =
      actionable.length === 0
        ? "All backlog items are completed, in progress, blocked, or already assigned."
        : "No task passed tier scoring filters.";
    const reportPath = await writeIdleReport(paths, reason, context.backlog.length);

    await appendJsonl(paths.executionLog, {
      timestamp: new Date().toISOString(),
      message: "plan_idle",
      reason,
      scanned: context.backlog.length,
    });

    return { action: "idle", report_path: reportPath, telegram_sent: false, reason };
  }

  const alreadyQueued = state.task_queue.find(
    (t) => t.backlog_id === selected.id && !["completed", "cancelled", "blocked"].includes(t.status),
  );
  let task: Task;

  if (alreadyQueued) {
    task = alreadyQueued;
  } else {
    task = backlogItemToTask(selected);
    task.metadata = {
      ...task.metadata,
      section: selected.section,
      sectionRef: selected.sectionRef,
      backlog_status: selected.status,
      blockers: selected.blockers,
      selected_at: new Date().toISOString(),
      selection_score: report.selected?.combined_score ?? report.selected?.score,
      selection_technical_score: report.selected?.technical_score,
      selection_founder_score: report.selected?.founder_score,
      selection_tier: report.selected?.tier,
      selection_founder_category: report.selected?.founder_category,
      launch_stage: report.launch_readiness.launch_stage,
      selection_reason: report.selected_reason,
    };
    state.task_queue.push(task);
    await appendJsonl(paths.executionLog, {
      timestamp: new Date().toISOString(),
      message: "task_selected",
      backlog_id: selected.id,
      task_id: task.task_id,
      title: task.title,
      priority: task.priority,
      tier: report.selected?.tier,
      score: report.selected?.score,
    });
  }

  if (task.requires_commander_approval && task.status === "queued") {
    state.current_task_id = task.task_id;
    await saveState(paths, state);
    return {
      action: "already_active",
      task,
      reason: "Task requires Commander approval before Developer assignment",
    };
  }

  if (!assign) {
    await saveState(paths, state);
    return {
      action: "already_active",
      task,
      reason: "Task queued; assignment deferred to PM loop",
    };
  }

  const assignment = await assignDeveloper(paths, state, task);

  let telegramSent = false;
  if (notify) {
    telegramSent = await notifyTaskAssignment(config, state, task);
    if (telegramSent) {
      await appendJsonl(paths.executionLog, {
        timestamp: new Date().toISOString(),
        message: "telegram_assignment_info",
        task_id: task.task_id,
        backlog_id: task.backlog_id,
        sent: true,
      });
    }
  }

  await saveState(paths, state);

  return {
    action: "assigned",
    task,
    brief_path: assignment.brief_path,
    backlog_id: selected.id,
    telegram_sent: telegramSent,
    selection_score: report.selected?.score ?? 0,
    selection_tier: report.selected?.tier ?? 0,
  };
}

export async function buildPmSelectionStatus(
  paths: PmPaths,
  state: PmState,
): Promise<Awaited<ReturnType<typeof reloadPlanningContext>>["report"]> {
  const context = await reloadPlanningContext(paths, state);
  return context.report;
}
