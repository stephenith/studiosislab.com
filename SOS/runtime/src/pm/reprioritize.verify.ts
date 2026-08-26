/**
 * Read-only dynamic reprioritization verification — no state mutation on disk.
 * Run: npm run pm:reprioritize-verify
 */
import { loadConfig } from "../config.js";
import { getPmPaths } from "./paths.js";
import { loadState } from "./state.js";
import {
  clonePmStateForVerify,
  founderPriorityChanged,
  reloadPlanningContext,
  runReprioritizationCycle,
  scoreTask,
  resumePausedTask,
} from "./reprioritize.js";
import type { PmState, Task } from "./types.js";

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(`ASSERT: ${message}`);
}

function buildConstitutionActiveState(base: PmState): PmState {
  const state = clonePmStateForVerify(base);
  const constitution: Task = {
    task_id: "TASK-BL-4-4-VERIFY",
    correlation_id: "verify-constitution",
    backlog_id: "BL-4-4",
    title: "Author SOS Constitution documents",
    description: "Constitution and knowledge docs",
    priority: "P2",
    backlog_priority: "Medium",
    status: "developer_working",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    evidence: ["SOS/00_CONSTITUTION/Mission.md", "SOS/01_KNOWLEDGE/"],
    requires_commander_approval: false,
    hard_gate_ids: [],
    confidence: 80,
    qa_required: false,
    metadata: { section: "planned", sectionRef: "4.4", founder_category: "documentation" },
  };

  state.current_task_id = constitution.task_id;
  state.developer_assignment = {
    agent: "developer",
    task_id: constitution.task_id,
    correlation_id: constitution.correlation_id,
    assigned_at: new Date().toISOString(),
    brief_path: "/tmp/verify-constitution-brief.md",
    status: "assigned",
  };
  state.task_queue = [
    ...state.task_queue.filter((t) => t.backlog_id !== "BL-4-4"),
    constitution,
  ];
  state.paused_tasks = [];
  state.notified_pause_ids = [];
  state.reprioritization = null;
  return state;
}

async function main(): Promise<void> {
  const config = loadConfig();
  const paths = getPmPaths(config);
  const liveState = await loadState(paths);
  const liveSliceCount = liveState.roadmap?.known_slice_ids.length ?? 0;
  const livePausedCount = liveState.paused_tasks?.length ?? 0;
  const liveNotifyPauseCount = liveState.notified_pause_ids?.length ?? 0;

  const simState = buildConstitutionActiveState(liveState);
  const context = await reloadPlanningContext(paths, simState);

  assert(context.backlog.length > 0, "Backlog reloaded");
  assert(context.knowledge.length > 0, "Knowledge reloaded");
  assert(context.report.selected !== null, "Highest ranked task selected");

  const activeTask = simState.task_queue.find((t) => t.task_id === simState.current_task_id)!;
  const activeScore = scoreTask(activeTask, context.readiness);
  const topScore = context.report.selected!;

  assert(
    activeScore.founder_category === "documentation" || activeScore.tier === 5,
    "Constitution scores as documentation/low launch value",
  );

  const higherIsProduct =
    topScore.founder_category === "mobile"
    || topScore.founder_category === "seo"
    || topScore.founder_category === "launch_blocker"
    || topScore.founder_category === "resume";
  assert(higherIsProduct, `Highest task is product work (${topScore.founder_category})`);

  assert(
    founderPriorityChanged(activeScore, topScore),
    "Founder priority changed — constitution should yield to product work",
  );

  const result = await runReprioritizationCycle(config, paths, simState, {
    assignReplacement: false,
    notify: false,
  });

  assert(result.decision === "pause", `Reprioritization pauses constitution, got ${result.decision}`);
  assert(result.founder_override === true, "Founder override flagged");
  assert(result.paused !== null, "Paused record created");
  assert(result.paused!.task_id === activeTask.task_id, "Constitution task paused");
  assert(
    result.replacement_task !== null || result.context.report.selected !== null,
    "Replacement task identified",
  );

  const paused = simState.paused_tasks?.find((p) => p.task_id === activeTask.task_id);
  assert(Boolean(paused), "Paused task in state.paused_tasks");
  assert(paused!.preserved_artifacts !== undefined, "Artifacts manifest preserved");
  assert(paused!.can_resume === true, "Task marked resumable");

  const duplicatePaused = simState.paused_tasks?.filter((p) => p.task_id === activeTask.task_id);
  assert(duplicatePaused?.length === 1, "No duplicate paused records");

  const resumed = await resumePausedTask(paths, simState, activeTask.task_id);
  assert(resumed !== null, "Developer can resume paused task later");
  assert(resumed!.status === "queued", "Resumed task returns to queued");

  const simNotify = clonePmStateForVerify(simState);
  simNotify.notified_pause_ids = [];
  const pauseRecord = paused!;
  const { notifyTaskPaused, buildPauseEventId } = await import("./reprioritize.js");
  const replacementStub = {
    task_id: pauseRecord.replacement_task_id ?? "TASK-REPLACEMENT",
    backlog_id: pauseRecord.replacement_backlog_id ?? "BL-REPLACEMENT",
  } as import("./types.js").Task;
  const eventId =
    pauseRecord.reprioritization_event_id
    ?? buildPauseEventId(
      pauseRecord.task_id,
      pauseRecord.backlog_id,
      replacementStub.task_id,
      replacementStub.backlog_id,
    );
  const sent1 = await notifyTaskPaused(config, paths, simNotify, pauseRecord, replacementStub, eventId);
  const sent2 = await notifyTaskPaused(config, paths, simNotify, pauseRecord, replacementStub, eventId);
  if (config.telegramBotToken && config.telegramChatId) {
    assert(sent1 === true || sent1 === false, "Telegram notify callable");
  }
  assert(sent2 === false, "No duplicate Telegram on second notify");

  const afterLive = await loadState(paths);
  assert(
    (afterLive.roadmap?.known_slice_ids.length ?? 0) === liveSliceCount,
    "No new roadmap slices on live state",
  );
  assert(
    (afterLive.paused_tasks?.length ?? 0) === livePausedCount,
    "Live paused_tasks unchanged",
  );
  assert(
    (afterLive.notified_pause_ids?.length ?? 0) === liveNotifyPauseCount,
    "Live notify_pause_ids unchanged",
  );

  console.log(
    JSON.stringify(
      {
        ok: true,
        live_state_preserved: true,
        constitution_scoring: {
          founder_category: activeScore.founder_category,
          combined_score: activeScore.combined_score,
        },
        highest_ranked: {
          backlog_id: topScore.item.id,
          title: topScore.item.title,
          founder_category: topScore.founder_category,
          combined_score: topScore.combined_score,
        },
        reprioritization: {
          decision: result.decision,
          founder_override: result.founder_override,
          reason: result.reason,
          why_changed: result.why_changed,
          paused_task: result.paused?.title,
          replacement: result.replacement_task?.title ?? topScore.item.title,
        },
        artifacts_preserved: paused?.preserved_artifacts,
        resume: { task_id: resumed?.task_id, status: resumed?.status },
        duplicate_checks: {
          paused_records: duplicatePaused?.length,
          telegram_second_send: sent2,
          live_slice_count_unchanged: true,
        },
      },
      null,
      2,
    ),
  );
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
