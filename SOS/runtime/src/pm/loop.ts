import type { RuntimeConfig } from "../config.js";
import { loadConfig } from "../config.js";
import { getPmPaths } from "./paths.js";
import { loadState, saveState, appendJsonl } from "./state.js";
import {
  readMasterBacklog,
  readKnowledgeSummary,
  readLatestStandup,
  filterActionableBacklogItems,
} from "./readers.js";
import { selectHighestPriorityTaskWithKnowledge, hasActivePipelineTask } from "./scoring.js";
import { backlogItemToTask } from "./tasks.js";
import { planNextTask, notifyTaskAssignment, buildPmSelectionStatus } from "./planning.js";
import { buildRoadmapStatus } from "./roadmap-planner.js";
import { getRuntimeFreezeInfo, DEFAULT_PM_MISSION } from "../runtime/version.js";
import { returnTaskToDeveloperAfterQaFail } from "./qa-handoff.js";
import { isShutdownRequested } from "../runtime/shutdown.js";
import type { PmState, Task } from "./types.js";
import {
  assignDeveloper,
  assignQa,
  clearDeveloperAssignment,
  clearQaAssignment,
  devReportExists,
  qaReportExists,
  readDeveloperReport,
  readQaReport,
  updateAgentStatus,
} from "./agents.js";
import { reviewDeveloperWork, reviewQaWork, closeTask, blockTask, notifyFounderExecuteComplete } from "./review.js";
import { maintainRoadmap } from "./roadmap-planner.js";
import { runReprioritizationCycle } from "./reprioritize.js";
import {
  submitApprovalRequest,
  checkApprovalResponse,
  isApprovalGranted,
  isApprovalRejected,
  isApprovalDeferred,
  removeWaitingApproval,
} from "./approvals.js";
import { canSendApproval, loadCdeConfig } from "./cde.js";
import { clearDispatchPending } from "./events.js";
import { startWorkerHeartbeat } from "../runtime/worker-heartbeat.js";

export type LoopOptions = {
  once?: boolean;
  pollMs?: number;
  dryRun?: boolean;
};

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function findTask(state: PmState, taskId: string): Task | undefined {
  return state.task_queue.find((t) => t.task_id === taskId);
}

async function logExecution(paths: ReturnType<typeof getPmPaths>, msg: string, data?: unknown): Promise<void> {
  await appendJsonl(paths.executionLog, {
    timestamp: new Date().toISOString(),
    message: msg,
    data,
  });
}

async function refreshTaskQueue(
  paths: ReturnType<typeof getPmPaths>,
  state: PmState,
): Promise<void> {
  const items = await readMasterBacklog(paths);
  const knowledge = await readKnowledgeSummary(paths);
  const standup = await readLatestStandup(paths);

  await logExecution(paths, "backlog_refresh", {
    items: items.length,
    knowledge_files: knowledge.length,
    standup_loaded: Boolean(standup),
  });

  const actionable = filterActionableBacklogItems(items, state);
  await maintainRoadmap(paths, state, items);
  if (hasActivePipelineTask(state) || state.current_task_id) return;

  const { item: top, report } = await selectHighestPriorityTaskWithKnowledge(
    actionable,
    items,
    state,
    paths.knowledgeDir,
  );
  if (!top) return;

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

  const alreadyQueued = state.task_queue.some((t) => t.backlog_id === top.id);
  if (!alreadyQueued) {
    const task = backlogItemToTask(top);
    task.metadata = {
      ...task.metadata,
      section: top.section,
      sectionRef: top.sectionRef,
      backlog_status: top.status,
      blockers: top.blockers,
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
    await logExecution(paths, "task_queued", {
      task_id: task.task_id,
      backlog_id: top.id,
      title: task.title,
      tier: report.selected?.tier,
      score: report.selected?.score,
    });
  }
}

async function handleWaitingApprovals(
  config: RuntimeConfig,
  paths: ReturnType<typeof getPmPaths>,
  state: PmState,
): Promise<boolean> {
  if (state.waiting_approvals.length === 0) return false;

  const waiting = state.waiting_approvals[0];
  const response = await checkApprovalResponse(paths, waiting.approval_id);
  const resumeStage = waiting.resume_stage ?? "pre_dev";

  if (!response) {
    await logExecution(paths, "approval_pending", { approval_id: waiting.approval_id });
    return false;
  }

  const task = findTask(state, waiting.task_id);
  if (!task) {
    await removeWaitingApproval(state, paths, waiting.approval_id);
    return false;
  }

  if (isApprovalGranted(response)) {
    await logExecution(paths, "approval_granted", response);
    await removeWaitingApproval(state, paths, waiting.approval_id);
    task.requires_commander_approval = false;

    if (resumeStage === "post_qa") {
      await closeTask(paths, state, task, "Commander approved task completion");
      state.current_task_id = null;
    } else if (resumeStage === "post_dev") {
      if (task.qa_required) {
        task.status = "assigned_qa";
        state.current_task_id = task.task_id;
      } else {
        await closeTask(paths, state, task, "Commander approved after dev review");
        state.current_task_id = null;
      }
    } else {
      task.status = "assigned_developer";
      state.current_task_id = task.task_id;
    }

    state.loop_status = "running";
    return false;
  }

  if (isApprovalRejected(response)) {
    await logExecution(paths, "approval_rejected", response);
    await removeWaitingApproval(state, paths, waiting.approval_id);
    await blockTask(paths, state, task, "Commander rejected");
    await clearDispatchPending(config);
    state.loop_status = "running";
    return false;
  }

  if (isApprovalDeferred(response)) {
    await logExecution(paths, "approval_deferred", response);
    await removeWaitingApproval(state, paths, waiting.approval_id);
    task.status = "blocked";
    task.blocked_reason = "Commander deferred";
    state.loop_status = "running";
    return false;
  }

  return true;
}

async function pickNextQueuedTask(
  paths: ReturnType<typeof getPmPaths>,
  state: PmState,
): Promise<Task | undefined> {
  const allItems = await readMasterBacklog(paths);
  const actionable = filterActionableBacklogItems(allItems, state);
  const { item: best } = await selectHighestPriorityTaskWithKnowledge(
    actionable,
    allItems,
    state,
    paths.knowledgeDir,
  );

  if (best) {
    const match = state.task_queue.find(
      (t) =>
        t.backlog_id === best.id
        && (t.status === "queued" || t.status === "assigned_developer"),
    );
    if (match) return match;
  }

  return state.task_queue.find(
    (t) => t.status === "queued" || t.status === "assigned_developer",
  );
}

async function processCurrentTask(
  config: RuntimeConfig,
  paths: ReturnType<typeof getPmPaths>,
  state: PmState,
): Promise<void> {
  const taskId = state.current_task_id;
  if (!taskId) {
    const next = await pickNextQueuedTask(paths, state);
    if (!next) {
      const plan = await planNextTask(config, paths, state, {
        assign: true,
        notify: true,
        skipReprioritize: true,
      });
      if (plan.action === "assigned") {
        await logExecution(paths, "auto_planned", {
          task_id: plan.task.task_id,
          brief_path: plan.brief_path,
        });
      }
      return;
    }

    if (next.requires_commander_approval && next.status === "queued") {
      const cde = loadCdeConfig();
      const evaluation = {
        commander_required: true,
        hard_gate_ids: next.hard_gate_ids,
        qa_required: next.qa_required,
        confidence: next.confidence,
        reason: "Pre-execution Commander approval required",
        priority: next.priority === "P3" ? "P1" as const : next.priority,
      };

      if (!canSendApproval(state.interruption_budget, cde, evaluation.priority)) {
        await logExecution(paths, "approval_budget_exceeded", { task_id: next.task_id });
        next.status = "blocked";
        next.blocked_reason = "Interruption budget exceeded";
        return;
      }

      next.status = "awaiting_approval";
      const seq = state.interruption_budget.approvals_sent + 1;
      const { approvalId } = await submitApprovalRequest(
        config,
        paths,
        state,
        next,
        evaluation,
        seq,
        "pre_dev",
      );
      next.approval_id = approvalId;
      state.current_task_id = null;
      await saveState(paths, state);
      await logExecution(paths, "approval_submitted", { approval_id: approvalId });
      return;
    }

    state.current_task_id = next.task_id;
    await assignDeveloper(paths, state, next);
    await notifyTaskAssignment(config, state, next);
    await logExecution(paths, "developer_assigned", { task_id: next.task_id });
    return;
  }

  const task = findTask(state, taskId);
  if (!task) {
    state.current_task_id = null;
    return;
  }

  if (task.status === "assigned_developer") {
    await assignDeveloper(paths, state, task);
    await notifyTaskAssignment(config, state, task);
    await logExecution(paths, "developer_assigned", { task_id: taskId });
    return;
  }

  if (task.status === "developer_working" && devReportExists(paths, taskId)) {
    const devReport = await readDeveloperReport(paths, taskId);
    if (!devReport) return;

    task.status = "reviewing_dev";
    task.developer_report_path = `reports/developer/${taskId}.json`;
    const outcome = await reviewDeveloperWork(paths, state, task, devReport);
    await clearDeveloperAssignment(paths, state, "complete");

    if (outcome.block_task) {
      await blockTask(paths, state, task, outcome.reason);
      return;
    }

    if (outcome.qa_required) {
      await assignQa(paths, state, task);
      await logExecution(paths, "qa_assigned", { task_id: taskId });
      return;
    }

    if (outcome.commander_required) {
      task.status = "awaiting_approval";
      task.requires_commander_approval = true;
      const cde = loadCdeConfig();
      const seq = state.interruption_budget.approvals_sent + 1;
      const { approvalId } = await submitApprovalRequest(
        config,
        paths,
        state,
        task,
        outcome.evaluation,
        seq,
        "post_dev",
      );
      task.approval_id = approvalId;
      state.current_task_id = null;
      await saveState(paths, state);
      return;
    }

    if (outcome.close_task) {
      await closeTask(paths, state, task, outcome.reason);
      await saveState(paths, state);
      return;
    }
  }

  if (task.status === "assigned_qa") {
    await assignQa(paths, state, task);
    await logExecution(paths, "qa_assigned", { task_id: taskId });
    return;
  }

  if (task.status === "qa_working" && qaReportExists(paths, taskId)) {
    const qaReport = await readQaReport(paths, taskId);
    const devReport = await readDeveloperReport(paths, taskId);
    if (!qaReport) return;

    task.status = "reviewing_qa";
    const outcome = await reviewQaWork(paths, task, qaReport, devReport ?? undefined);
    await clearQaAssignment(paths, state, "complete");

    if (outcome.return_to_developer) {
      const bugFixPath = await returnTaskToDeveloperAfterQaFail(paths, task, qaReport);
      task.status = "assigned_developer";
      state.current_task_id = task.task_id;
      await clearDeveloperAssignment(paths, state, "failed");
      const assignment = await assignDeveloper(paths, state, task);
      task.developer_brief_path = bugFixPath;
      await logExecution(paths, "qa_failed_return_dev", {
        task_id: taskId,
        reason: outcome.reason,
        bug_fix_brief: bugFixPath,
      });
      await saveState(paths, state);
      return;
    }

    if (outcome.block_task) {
      await blockTask(paths, state, task, outcome.reason);
      return;
    }

    if (outcome.commander_required) {
      task.status = "awaiting_approval";
      const cde = loadCdeConfig();
      const seq = state.interruption_budget.approvals_sent + 1;
      const { approvalId } = await submitApprovalRequest(
        config,
        paths,
        state,
        task,
        outcome.evaluation,
        seq,
        "post_qa",
      );
      task.approval_id = approvalId;
      state.current_task_id = null;
      await saveState(paths, state);
      return;
    }

    if (outcome.close_task) {
      task.metadata = { ...task.metadata, qa_verdict: "pass", qa_completed_at: new Date().toISOString() };
      const notifyComplete = task.backlog_id === "INBOX-EXEC" || task.metadata?.bypass_roadmap === true;
      await closeTask(paths, state, task, outcome.reason);
      state.current_task_id = null;
      await saveState(paths, state);

      if (notifyComplete) {
        await notifyFounderExecuteComplete(config, paths, task);
      }

      if (!hasActivePipelineTask(state)) {
        const plan = await planNextTask(config, paths, state, {
        assign: true,
        notify: true,
        skipReprioritize: true,
      });
        if (plan.action === "assigned") {
          await logExecution(paths, "auto_planned_after_qa_pass", {
            task_id: plan.task.task_id,
            backlog_id: plan.backlog_id,
            brief_path: plan.brief_path,
          });
        }
      }
    }
  }
}

export async function runPmLoop(options: LoopOptions = {}): Promise<void> {
  const config = loadConfig();
  if (options.dryRun) config.dryRun = true;

  const paths = getPmPaths(config);
  let state = await loadState(paths);
  const pollMs = options.pollMs ?? parseInt(process.env.SOS_PM_POLL_MS ?? "5000", 10);
  const heartbeat = startWorkerHeartbeat(config, "pm", { initialPhase: "loop" });

  state.loop_status = "running";
  await saveState(paths, state);
  await logExecution(paths, "pm_loop_started", { pollMs, dryRun: config.dryRun });

  try {
    do {
      if (isShutdownRequested(config.logsRoot)) {
        state.loop_status = "stopped";
        await saveState(paths, state);
        await updateAgentStatus(paths, state);
        break;
      }

      const loopStatus = state.loop_status;
      state = await loadState(paths);
      state.loop_status = loopStatus;

      try {
        heartbeat.setPhase("reprioritize");
        heartbeat.setBusy("reprioritization");
        const reprio = await runReprioritizationCycle(config, paths, state, {
          assignReplacement: !config.dryRun,
          notify: !config.dryRun,
        });
        heartbeat.clearBusy();
        if (reprio.decision === "pause") {
          await logExecution(paths, "reprioritization_pause", {
            paused: reprio.paused?.task_id,
            replacement: reprio.replacement_task?.task_id,
            reason: reprio.reason,
          });
        }

        heartbeat.setPhase("approvals");
        const waiting = await handleWaitingApprovals(config, paths, state);
        if (waiting) {
          await updateAgentStatus(paths, state);
          if (!options.once) await sleep(pollMs);
          continue;
        }

        heartbeat.setPhase("backlog_refresh");
        heartbeat.setBusy("backlog_refresh");
        await refreshTaskQueue(paths, state);
        heartbeat.clearBusy();

        heartbeat.setPhase("process_task");
        heartbeat.setBusy("process_current_task", { task_id: state.current_task_id });
        await processCurrentTask(config, paths, state);
        heartbeat.clearBusy();

        await saveState(paths, state);
        await updateAgentStatus(paths, state);
      } catch (e) {
        heartbeat.clearBusy();
        const msg = e instanceof Error ? e.message : String(e);
        await logExecution(paths, "loop_error", { error: msg });
        await saveState(paths, state);
        if (options.once) {
          state.loop_status = "paused";
          await saveState(paths, state);
          throw e;
        }
        state.loop_status = "running";
        await logExecution(paths, "loop_recovered", { error: msg });
        await sleep(Math.min(pollMs * 2, 30_000));
        continue;
      }

      if (!options.once) await sleep(pollMs);
    } while (!options.once);

    if (options.once) {
      state.loop_status = "idle";
      await saveState(paths, state);
    }
  } finally {
    await heartbeat.stop();
  }
}

export async function getPmStatus(): Promise<Record<string, unknown>> {
  const config = loadConfig();
  const paths = getPmPaths(config);
  const state = await loadState(paths);
  const selection = await buildPmSelectionStatus(paths, state);
  const roadmap = await buildRoadmapStatus(paths, state);
  const reprioritization = state.reprioritization;
  const pausedTasks = state.paused_tasks ?? [];
  const activeTask = state.current_task_id
    ? state.task_queue.find((t) => t.task_id === state.current_task_id)
    : state.task_queue.find((t) =>
        ["developer_working", "assigned_developer", "qa_working", "assigned_qa", "queued"].includes(t.status),
      );

  return {
    loop_status: state.loop_status,
    current_task_id: state.current_task_id,
    active_task: activeTask
      ? {
          task_id: activeTask.task_id,
          backlog_id: activeTask.backlog_id,
          title: activeTask.title,
          status: activeTask.status,
          priority: activeTask.priority,
          developer_brief_path: activeTask.developer_brief_path,
          backlog_ref: activeTask.metadata?.sectionRef,
          selection_tier: activeTask.metadata?.selection_tier,
          selection_score: activeTask.metadata?.selection_score,
        }
      : null,
    developer: state.developer_assignment,
    qa: state.qa_assignment,
    waiting_approvals: state.waiting_approvals,
    queue_length: state.task_queue.length,
    completed: state.completed_task_ids.length,
    blocked: state.blocked_task_ids.length,
    interruption_budget: state.interruption_budget,
    notified_backlog_ids: state.notified_backlog_ids,
    selection: {
      pipeline_busy: hasActivePipelineTask(state),
      founder_score: selection.selected?.founder_score ?? null,
      technical_score: selection.selected?.technical_score ?? null,
      combined_score: selection.selected?.combined_score ?? null,
      current_score: selection.selected?.combined_score ?? selection.selected?.score ?? null,
      reason_selected: selection.selected_reason,
      launch_stage: selection.launch_readiness.launch_stage,
      launch_blockers_open: selection.launch_readiness.launch_blockers_open,
      founder_category: selection.selected?.founder_category ?? null,
      founder_category_label: selection.selected?.founder_category_label ?? null,
      selected_backlog_id: selection.selected?.item.id ?? null,
      selected_title: selection.selected?.item.title ?? null,
      selected_tier: selection.selected?.tier ?? null,
      example_ranking: selection.ranking,
      tasks_skipped: selection.skipped.map((s) => ({
        backlog_id: s.backlog_id,
        title: s.title,
        tier: s.tier,
        technical_score: s.technical_score,
        founder_score: s.founder_score,
        combined_score: s.combined_score,
        score: s.combined_score,
        why_skipped: s.why_skipped,
      })),
      remaining_tier_1: selection.remaining_by_tier.tier_1,
      remaining_tier_2: selection.remaining_by_tier.tier_2,
      remaining_tier_3: selection.remaining_by_tier.tier_3,
      remaining_tier_4: selection.remaining_by_tier.tier_4,
      remaining_tier_5: selection.remaining_by_tier.tier_5,
      last_recorded_selection: state.last_selection,
    },
    tasks: state.task_queue.map((t) => ({
      task_id: t.task_id,
      backlog_id: t.backlog_id,
      title: t.title,
      status: t.status,
      priority: t.priority,
      backlog_ref: t.metadata?.sectionRef,
      selection_tier: t.metadata?.selection_tier,
      roadmap_slice_id: t.metadata?.roadmap_slice_id ?? null,
    })),
    roadmap: {
      completion_pct: roadmap.roadmap_completion_pct,
      current_milestone: roadmap.current_milestone,
      current_feature: roadmap.current_feature,
      tasks_remaining: roadmap.tasks_remaining,
      estimated_days_to_launch: roadmap.estimated_days_to_launch,
      developer_utilization: roadmap.developer_utilization,
      qa_utilization: roadmap.qa_utilization,
      slices_total: roadmap.slices_total,
      slices_completed: roadmap.slices_completed,
      slices_queued: roadmap.slices_queued,
      slices_blocked_deps: roadmap.slices_blocked_deps,
      epics_decomposed: roadmap.epics_decomposed,
      launch_criteria_met: roadmap.launch_criteria_met,
      launch_criteria_total: roadmap.launch_criteria_total,
      epics: roadmap.epics.map((e) => ({
        epic_id: e.epic_id,
        title: e.title,
        milestone: e.milestone,
        feature: e.feature,
        slice_count: e.slice_ids.length,
      })),
      next_unlocked: roadmap.next_unlocked.map((s) => ({
        slice_id: s.slice_id,
        title: s.title,
        dependency: s.dependency,
      })),
    },
    runtime: {
      ...getRuntimeFreezeInfo(),
      mission: DEFAULT_PM_MISSION,
      product_only_mode: true,
    },
    reprioritization: {
      last_cycle_at: reprioritization?.last_cycle_at ?? null,
      decision: reprioritization?.decision ?? "none",
      founder_override: reprioritization?.founder_override ?? false,
      current_task: reprioritization?.current_task_title ?? activeTask?.title ?? null,
      current_task_id: reprioritization?.current_task_id ?? state.current_task_id,
      replacement_task: reprioritization?.highest_task_title ?? null,
      replacement_task_id: reprioritization?.replacement_task_id ?? null,
      reason: reprioritization?.reason ?? null,
      why_changed: reprioritization?.why_changed ?? null,
      paused_tasks: pausedTasks.map((p) => ({
        task_id: p.task_id,
        backlog_id: p.backlog_id,
        title: p.title,
        paused_at: p.paused_at,
        reason: p.reason,
        why_changed: p.why_changed,
        founder_override: p.founder_override,
        replacement_title: p.replacement_title,
        replacement_task_id: p.replacement_task_id,
        reprioritization_event_id: p.reprioritization_event_id ?? null,
        archived_brief_path: p.archived_brief_path,
        preserved_artifacts: p.preserved_artifacts,
        can_resume: p.can_resume,
      })),
      notification_dedupe: (state.reprioritization_notifications ?? []).map((n) => ({
        event_id: n.event_id,
        paused_task_id: n.paused_task_id,
        replacement_task_id: n.replacement_task_id,
        telegram_sent: n.telegram_sent,
      })),
    },
  };
}
