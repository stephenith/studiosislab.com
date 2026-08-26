import type { PmPaths } from "./paths.js";
import type { DeveloperReport, PmState, QaReport, Task } from "./types.js";
import { evaluateTaskForApproval, loadCdeConfig, requiresQa } from "./cde.js";
import { appendJsonl } from "./state.js";
import { createTaskCompleteEvent, appendEvent } from "./events.js";
import { onTaskCompleted } from "./roadmap-planner.js";
import type { RuntimeConfig } from "../config.js";
import { isFounderExecuteNowTask } from "./founder-execute.js";
import { sendLifecycleNotification } from "../services/notification-pipeline.js";

export type ReviewOutcome = {
  qa_required: boolean;
  commander_required: boolean;
  evaluation: ReturnType<typeof evaluateTaskForApproval>;
  devReport?: DeveloperReport;
  qaReport?: QaReport;
  close_task: boolean;
  block_task: boolean;
  return_to_developer: boolean;
  reason: string;
};

export async function reviewDeveloperWork(
  paths: PmPaths,
  state: PmState,
  task: Task,
  devReport: DeveloperReport,
): Promise<ReviewOutcome> {
  const config = loadCdeConfig();

  if (devReport.blocker) {
    const evaluation = evaluateTaskForApproval(task, config, devReport);
    await logDecision(paths, task, evaluation, "developer_blocker");
    return {
      qa_required: false,
      commander_required: true,
      evaluation,
      devReport,
      close_task: false,
      block_task: true,
      return_to_developer: false,
      reason: devReport.blocker_reason ?? "Developer reported blocker",
    };
  }

  const qaNeeded = requiresQa(task, config, devReport);
  task.qa_required = qaNeeded;
  task.confidence = devReport.confidence;

  if (qaNeeded) {
    return {
      qa_required: true,
      commander_required: false,
      evaluation: evaluateTaskForApproval(task, config, devReport),
      devReport,
      close_task: false,
      block_task: false,
      return_to_developer: false,
      reason: "QA required per CDE launch-path rules",
    };
  }

  const evaluation = evaluateTaskForApproval(task, config, devReport);

  await logDecision(paths, task, evaluation, "post_dev_review");

  if (evaluation.commander_required) {
    return {
      qa_required: false,
      commander_required: true,
      evaluation,
      devReport,
      close_task: false,
      block_task: false,
      return_to_developer: false,
      reason: evaluation.reason,
    };
  }

  return {
    qa_required: false,
    commander_required: false,
    evaluation,
    devReport,
    close_task: true,
    block_task: false,
    return_to_developer: false,
    reason: "Developer work accepted; QA not required",
  };
}

export async function reviewQaWork(
  paths: PmPaths,
  task: Task,
  qaReport: QaReport,
  devReport?: DeveloperReport,
): Promise<ReviewOutcome> {
  const config = loadCdeConfig();

  if (qaReport.verdict === "fail" || qaReport.verdict === "blocked") {
    const evaluation = evaluateTaskForApproval(task, config, devReport);
    await logDecision(paths, task, evaluation, "qa_fail");
    return {
      qa_required: false,
      commander_required: false,
      evaluation,
      devReport,
      qaReport,
      close_task: false,
      block_task: false,
      return_to_developer: true,
      reason: `QA ${qaReport.verdict}: ${qaReport.summary}`,
    };
  }

  const evaluation = evaluateTaskForApproval(task, config, devReport);
  await logDecision(paths, task, evaluation, "post_qa_review");

  if (evaluation.commander_required) {
    return {
      qa_required: false,
      commander_required: true,
      evaluation,
      devReport,
      qaReport,
      close_task: false,
      block_task: false,
      return_to_developer: false,
      reason: evaluation.reason,
    };
  }

  return {
    qa_required: false,
    commander_required: false,
    evaluation,
    devReport,
    qaReport,
    close_task: true,
    block_task: false,
    return_to_developer: false,
    reason: "QA passed; task ready to close",
  };
}

async function logDecision(
  paths: PmPaths,
  task: Task,
  evaluation: ReturnType<typeof evaluateTaskForApproval>,
  stage: string,
): Promise<void> {
  await appendJsonl(paths.decisionHistory, {
    timestamp: new Date().toISOString(),
    task_id: task.task_id,
    correlation_id: task.correlation_id,
    stage,
    commander_required: evaluation.commander_required,
    cde_confidence: evaluation.confidence,
    hard_gate_ids: evaluation.hard_gate_ids,
    reason: evaluation.reason,
  });
}

export async function closeTask(
  paths: PmPaths,
  state: PmState,
  task: Task,
  summary: string,
): Promise<void> {
  task.status = "completed";
  task.updated_at = new Date().toISOString();
  state.completed_task_ids.push(task.task_id);
  state.current_task_id = null;

  await appendJsonl(paths.taskHistory, {
    timestamp: new Date().toISOString(),
    task_id: task.task_id,
    correlation_id: task.correlation_id,
    title: task.title,
    status: "completed",
    summary,
  });

  await appendEvent(
    paths,
    createTaskCompleteEvent(task.task_id, task.correlation_id, "pm", task.title, summary),
  );

  await onTaskCompleted(paths, state, task);

  state.task_queue = state.task_queue.filter((t) => t.task_id !== task.task_id);
}

export async function notifyFounderExecuteComplete(
  config: RuntimeConfig,
  paths: PmPaths,
  task: Task,
): Promise<boolean> {
  if (!isFounderExecuteNowTask(task)) return false;

  const title = task.title.length > 120 ? `${task.title.slice(0, 117)}...` : task.title;
  const eventId = `complete:${task.task_id}:${task.backlog_id}`;

  const result = await sendLifecycleNotification(config, paths, {
    event_id: eventId,
    correlation_id: task.correlation_id,
    source: "pm",
    caller: "notifyFounderExecuteComplete",
    task_id: task.task_id,
    title: `Completed: ${title}`,
    body: `Completed: ${title}. QA passed.`,
    type: "task_complete",
    priority: task.priority,
    metadata: {
      backlog_id: task.backlog_id,
      command_class: "EXECUTE_NOW",
      qa_verdict: "pass",
    },
  });

  return result.telegram_ok;
}

export async function blockTask(
  paths: PmPaths,
  state: PmState,
  task: Task,
  reason: string,
): Promise<void> {
  task.status = "blocked";
  task.blocked_reason = reason;
  task.updated_at = new Date().toISOString();
  state.blocked_task_ids.push(task.task_id);
  state.current_task_id = null;

  await appendJsonl(paths.taskHistory, {
    timestamp: new Date().toISOString(),
    task_id: task.task_id,
    correlation_id: task.correlation_id,
    title: task.title,
    status: "blocked",
    reason,
  });
}
