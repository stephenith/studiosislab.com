/**
 * Read-only verification: reprioritization pause Telegram is idempotent.
 * Run: npm run pm:reprioritize-notify-verify
 */
import { loadConfig } from "../config.js";
import { getPmPaths } from "./paths.js";
import { loadState } from "./state.js";
import { readMasterBacklog } from "./readers.js";
import {
  buildPauseEventId,
  clonePmStateForVerify,
  isPauseNotificationSent,
  notifyTaskPaused,
  runReprioritizationCycle,
} from "./reprioritize.js";
import type { PmState, Task } from "./types.js";

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(`ASSERT: ${message}`);
}

function buildConstitutionActiveState(base: PmState): PmState {
  const state = clonePmStateForVerify(base);
  const constitution: Task = {
    task_id: "TASK-BL-4-4-NOTIFY-VERIFY",
    correlation_id: "notify-verify",
    backlog_id: "BL-4-4",
    title: "Author SOS Constitution documents",
    description: "Constitution and knowledge docs",
    priority: "P2",
    backlog_priority: "Medium",
    status: "developer_working",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    evidence: ["SOS/00_CONSTITUTION/Mission.md"],
    requires_commander_approval: false,
    hard_gate_ids: [],
    confidence: 80,
    qa_required: false,
    metadata: { section: "planned", sectionRef: "4.4" },
  };

  state.current_task_id = constitution.task_id;
  state.developer_assignment = {
    agent: "developer",
    task_id: constitution.task_id,
    correlation_id: constitution.correlation_id,
    assigned_at: new Date().toISOString(),
    brief_path: "/tmp/notify-verify-brief.md",
    status: "assigned",
  };
  state.task_queue = state.task_queue
    .filter((t) => t.backlog_id !== "BL-4-4")
    .map((t) =>
      t.status === "developer_working" && t.task_id !== constitution.task_id
        ? { ...t, status: "queued" as const }
        : t,
    );
  state.task_queue.push(constitution);
  state.paused_tasks = [];
  state.notified_pause_ids = [];
  state.reprioritization_notifications = [];
  state.reprioritization = null;
  return state;
}

async function main(): Promise<void> {
  const config = loadConfig();
  const paths = getPmPaths(config);
  const liveState = await loadState(paths);
  const backlog = await readMasterBacklog(paths);

  const liveCurrentId = liveState.current_task_id;
  const livePausedCount = liveState.paused_tasks?.length ?? 0;
  const liveNotifyRecords = liveState.reprioritization_notifications?.length ?? 0;

  const simState = buildConstitutionActiveState(liveState);

  const run1 = await runReprioritizationCycle(config, paths, simState, {
    assignReplacement: false,
    notify: true,
  });
  assert(run1.decision === "pause", `First run pauses, got ${run1.decision}`);
  assert(run1.paused !== null, "Paused record created");

  const notifyAttempts: boolean[] = [];
  const paused = run1.paused!;
  const replacement = run1.replacement_task!;
  const eventId = buildPauseEventId(
    paused.task_id,
    paused.backlog_id,
    replacement.task_id,
    replacement.backlog_id,
  );

  notifyAttempts.push(
    await notifyTaskPaused(config, paths, simState, paused, replacement, eventId),
  );
  notifyAttempts.push(
    await notifyTaskPaused(config, paths, simState, paused, replacement, eventId),
  );

  const sentCount = notifyAttempts.filter(Boolean).length;
  const telegramConfigured = Boolean(config.telegramBotToken && config.telegramChatId);
  const mockMode = process.env.SOS_NOTIFICATION_MODE === "mock";

  assert(mockMode, "pm:reprioritize-notify-verify must run with SOS_NOTIFICATION_MODE=mock");

  if (telegramConfigured) {
    assert(sentCount <= 1, `At most one notification delivery, got ${sentCount}`);
  }

  assert(
    isPauseNotificationSent(simState, eventId, paused.task_id),
    "Dedupe state marks notification sent after first attempt",
  );

  const run2 = await runReprioritizationCycle(config, paths, simState, {
    assignReplacement: false,
    notify: true,
  });
  assert(
    run2.decision === "continue",
    `Second reprioritization cycle must not re-pause, got ${run2.decision}`,
  );
  assert(
    run2.decision !== "pause",
    "Second run must never re-pause",
  );

  const duplicatePaused = simState.paused_tasks?.filter((p) => p.task_id === paused.task_id);
  assert(duplicatePaused?.length === 1, "Only one paused record");

  const duplicateNotifications = simState.reprioritization_notifications?.filter(
    (n) => n.paused_task_id === paused.task_id && n.telegram_sent,
  );
  assert(
    (duplicateNotifications?.length ?? 0) <= 1,
    "Only one sent notification record per paused task",
  );

  const afterLive = await loadState(paths);
  assert(afterLive.current_task_id === liveCurrentId, "Live active task unchanged");
  assert(
    (afterLive.paused_tasks?.length ?? 0) === livePausedCount,
    "Live paused_tasks unchanged",
  );
  assert(
    (afterLive.reprioritization_notifications?.length ?? 0) === liveNotifyRecords
      || (afterLive.reprioritization_notifications?.length ?? 0) >= liveNotifyRecords,
    "Live notification records not removed",
  );

  const activeTitle =
    afterLive.task_queue.find((t) => t.task_id === afterLive.current_task_id)?.title
    ?? afterLive.task_queue.find((t) => t.status === "developer_working")?.title
    ?? null;

  console.log(
    JSON.stringify(
      {
        ok: true,
        root_cause_fixed: "composite event dedupe + early exit on already-paused",
        notification_mode: process.env.SOS_NOTIFICATION_MODE ?? "production",
        simulation: {
          first_run_decision: run1.decision,
          second_run_decision: run2.decision,
          second_run_reason: run2.reason,
          event_id: eventId,
          telegram_configured: telegramConfigured,
          telegram_send_attempts: notifyAttempts,
          telegram_sends_succeeded: sentCount,
          paused_records: duplicatePaused?.length,
          notification_records_sent: duplicateNotifications?.length,
        },
        live_state: {
          active_task: activeTitle,
          current_task_id: afterLive.current_task_id,
          paused_tasks: afterLive.paused_tasks?.length ?? 0,
          reprioritization_notifications: afterLive.reprioritization_notifications?.length ?? 0,
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
