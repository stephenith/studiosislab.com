import type { RuntimeConfig } from "../config.js";
import { getApprovalsPaths } from "../approvals/paths.js";
import {
  fetchTelegramUpdates,
  loadPollOffset,
  savePollOffset,
} from "../approvals/telegram/poll.js";
import { mapApiMessage, processTelegramInboundMessage } from "../approvals/telegram/process.js";
import { logTelegramInbound } from "../approvals/telegram/inbound-log.js";
import { updatePollTelemetry } from "../approvals/telegram/telemetry.js";
import {
  isProcessAlive,
  scanWorkerProcesses,
  terminateWorkerProcesses,
  type WorkerProcessInfo,
} from "./process-table.js";
import {
  loadApprovalsState,
  saveApprovalsState,
} from "../approvals/state.js";

export function isTelegramConflictError(error: string): boolean {
  return error.includes("terminated by other getUpdates request");
}

export async function reconcileTelegramPollers(
  config: RuntimeConfig,
  keepPid: number | null,
): Promise<{ terminated: WorkerProcessInfo[]; kept_pid: number | null }> {
  const processes = scanWorkerProcesses().filter((p) => p.worker_id === "telegram");
  const allowed = new Set<number>();

  if (keepPid && isProcessAlive(keepPid)) {
    allowed.add(keepPid);
  } else {
    const alive = processes.filter((p) => isProcessAlive(p.pid));
    if (alive.length > 0) {
      const keeper = alive.sort((a, b) => a.pid - b.pid)[0];
      allowed.add(keeper.pid);
    }
  }

  const terminated = terminateWorkerProcesses(processes, allowed);
  const keptPid = allowed.size > 0 ? [...allowed][0] : null;

  if (terminated.length > 0) {
    await updatePollTelemetry(config, {
      telegram_conflict: true,
      last_conflict_at: new Date().toISOString(),
      last_poll_error: "Conflict: terminated by other getUpdates request — duplicate pollers removed",
    });
    await logTelegramInbound(config, {
      message: "poll_conflict_recovery",
      details: {
        terminated: terminated.map((p) => ({ pid: p.pid, owner: p.owner })),
        kept_pid: keptPid,
      },
    });
  }

  return { terminated, kept_pid: keptPid };
}

export type BacklogDrainResult = {
  drained: number;
  last_update_id: number;
  pending_before: number | null;
};

export async function drainTelegramBacklog(
  config: RuntimeConfig,
): Promise<BacklogDrainResult> {
  if (!config.telegramBotToken) {
    const offset = await loadPollOffset(config);
    return { drained: 0, last_update_id: offset.last_update_id, pending_before: null };
  }

  await reconcileTelegramPollers(config, null);

  let pendingBefore: number | null = null;
  try {
    const response = await fetch(
      `https://api.telegram.org/bot${config.telegramBotToken}/getWebhookInfo`,
    );
    const payload = (await response.json()) as {
      result?: { pending_update_count?: number };
    };
    pendingBefore = payload.result?.pending_update_count ?? 0;
  } catch {
    pendingBefore = null;
  }

  const paths = getApprovalsPaths(config);
  const pollState = await loadPollOffset(config);
  const runtimeState = await loadApprovalsState(paths);

  let offset = pollState.last_update_id + 1;
  let lastUpdateId = pollState.last_update_id;
  let drained = 0;

  while (true) {
    let updates;
    try {
      updates = await fetchTelegramUpdates(config, offset, 0);
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      if (isTelegramConflictError(error)) {
        await reconcileTelegramPollers(config, null);
        await new Promise((r) => setTimeout(r, 1500));
        continue;
      }
      await logTelegramInbound(config, { message: "backlog_drain_error", error });
      break;
    }

    if (updates.length === 0) break;

    await logTelegramInbound(config, {
      message: "backlog_drain_batch",
      details: { count: updates.length, offset },
    });

    for (const update of updates) {
      lastUpdateId = Math.max(lastUpdateId, update.update_id);

      if (runtimeState.processed_telegram_update_ids.includes(update.update_id)) {
        continue;
      }

      if (!update.message?.text?.trim()) {
        runtimeState.processed_telegram_update_ids.push(update.update_id);
        continue;
      }

      const inbound = mapApiMessage(update.update_id, update.message);
      await processTelegramInboundMessage(config, paths, inbound);
      runtimeState.processed_telegram_update_ids.push(update.update_id);
      drained += 1;
    }

    offset = lastUpdateId + 1;
    await savePollOffset(config, lastUpdateId);
  }

  runtimeState.last_processed_at = new Date().toISOString();
  runtimeState.updated_at = new Date().toISOString();
  if (runtimeState.processed_telegram_update_ids.length > 2000) {
    runtimeState.processed_telegram_update_ids =
      runtimeState.processed_telegram_update_ids.slice(-1000);
  }
  await saveApprovalsState(paths, runtimeState);

  if (drained > 0) {
    await logTelegramInbound(config, {
      message: "backlog_drain_complete",
      details: { drained, last_update_id: lastUpdateId },
    });
  }

  return {
    drained,
    last_update_id: lastUpdateId,
    pending_before: pendingBefore,
  };
}
