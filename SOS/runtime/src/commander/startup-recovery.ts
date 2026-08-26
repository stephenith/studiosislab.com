import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import type { RuntimeConfig } from "../config.js";
import { getPmPaths } from "../pm/paths.js";
import { loadState, saveState } from "../pm/state.js";
import { updateAgentStatus } from "../pm/agents.js";
import { getDeveloperPaths } from "../developer/paths.js";
import { loadDeveloperState, saveDeveloperState } from "../developer/state.js";
import { getQaPaths } from "../qa/paths.js";
import { loadQaState, saveQaState } from "../qa/state.js";
import { releaseQaLock } from "../qa/queue.js";
import { recoverStaleLocks } from "./lock-recovery.js";
import { clearShutdownFlag } from "../runtime/shutdown.js";
import { getCommanderPaths } from "./paths.js";

export type StartupRecoveryReport = {
  recovered_at: string;
  lock_recovery: Awaited<ReturnType<typeof recoverStaleLocks>>;
  pm: {
    loop_status: string;
    current_task_id: string | null;
    action: string;
  };
  developer: {
    state: string;
    current_task_id: string | null;
    execution_submitted: boolean;
    action: string;
  };
  qa: {
    state: string;
    current_task_id: string | null;
    action: string;
  };
  telegram: {
    poll_offset_path: string;
    offset: number | null;
    action: string;
  };
  dispatcher: {
    retry_queue_exists: boolean;
    action: string;
  };
};

const QA_INTERRUPTIBLE = new Set([
  "waiting_brief",
  "claimed",
  "prepare_checklist",
  "verification",
]);

export async function runStartupRecovery(config: RuntimeConfig): Promise<StartupRecoveryReport> {
  const commanderPaths = getCommanderPaths(config);
  await clearShutdownFlag(config.logsRoot);

  const lockRecovery = await recoverStaleLocks(config);

  const pmPaths = getPmPaths(config);
  const pmState = await loadState(pmPaths);
  let pmAction = "unchanged";
  if (pmState.loop_status === "paused" || pmState.loop_status === "stopped") {
    pmState.loop_status = "running";
    pmAction = "resumed loop_status → running";
    await saveState(pmPaths, pmState);
    await updateAgentStatus(pmPaths, pmState);
  } else if (pmState.current_task_id) {
    pmAction = "preserved active task — pipeline will resume";
    pmState.loop_status = "running";
    await saveState(pmPaths, pmState);
  }

  const devPaths = getDeveloperPaths(config);
  const devState = await loadDeveloperState(devPaths);
  let devAction = "unchanged";
  if (
    devState.current_task_id
    && (devState.state === "working" || devState.state === "prepared")
    && !devState.execution_submitted
  ) {
    devAction = "unfinished execution preserved — Developer will resume";
  } else if (devState.state === "awaiting_qa") {
    devAction = "awaiting_qa preserved — handoff intact";
  }

  const qaPaths = getQaPaths(config);
  const qaState = await loadQaState(qaPaths);
  let qaAction = "unchanged";
  if (qaState.current_task_id && QA_INTERRUPTIBLE.has(qaState.state)) {
    const taskId = qaState.current_task_id;
    const pmQaReport = join(qaPaths.pmQaReports, `${taskId}.json`);
    if (!existsSync(pmQaReport)) {
      await releaseQaLock(qaPaths, taskId).catch(() => undefined);
      qaState.state = "idle";
      qaState.current_task_id = null;
      qaState.current_correlation_id = null;
      qaState.claimed_brief_path = null;
      qaAction = "interrupted verification reset — will re-verify (no duplicate report)";
      await saveQaState(qaPaths, qaState);
    } else {
      qaAction = "QA report exists — PM will consume";
    }
  } else if (qaState.current_task_id) {
    qaAction = "QA task preserved";
  }

  const telegramOffsetPath = join(config.logsRoot, "approvals", "telegram-offset.json");
  let telegramOffset: number | null = null;
  let telegramAction = "poll offset file missing — will start from 0";
  if (existsSync(telegramOffsetPath)) {
    try {
      const raw = JSON.parse(await readFile(telegramOffsetPath, "utf8")) as { last_update_id?: number };
      telegramOffset = raw.last_update_id ?? null;
      telegramAction = `poll offset preserved (${telegramOffset})`;
    } catch {
      telegramAction = "poll offset file corrupt — Telegram may reprocess updates (dedup active)";
    }
  }

  const retryQueuePath = join(config.dispatchRoot, "retry-queue.jsonl");
  const dispatcherAction = existsSync(retryQueuePath)
    ? "retry queue preserved — Dispatcher will resume"
    : "no retry queue file — normal";

  await writeFile(
    join(commanderPaths.root, "last-recovery.json"),
    JSON.stringify(
      {
        recovered_at: new Date().toISOString(),
        pm: pmAction,
        developer: devAction,
        qa: qaAction,
        telegram: telegramAction,
        dispatcher: dispatcherAction,
      },
      null,
      2,
    ),
    "utf8",
  );

  return {
    recovered_at: new Date().toISOString(),
    lock_recovery: lockRecovery,
    pm: {
      loop_status: pmState.loop_status,
      current_task_id: pmState.current_task_id,
      action: pmAction,
    },
    developer: {
      state: devState.state,
      current_task_id: devState.current_task_id,
      execution_submitted: devState.execution_submitted,
      action: devAction,
    },
    qa: {
      state: qaState.state,
      current_task_id: qaState.current_task_id,
      action: qaAction,
    },
    telegram: {
      poll_offset_path: telegramOffsetPath,
      offset: telegramOffset,
      action: telegramAction,
    },
    dispatcher: {
      retry_queue_exists: existsSync(retryQueuePath),
      action: dispatcherAction,
    },
  };
}
