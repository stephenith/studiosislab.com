import type { RuntimeConfig } from "../../config.js";
import { loadConfig } from "../../config.js";
import { getApprovalsPaths } from "../paths.js";
import {
  loadApprovalsState,
  saveApprovalsState,
} from "../state.js";
import { logTelegramInbound } from "./inbound-log.js";
import {
  fetchTelegramUpdates,
  loadPollOffset,
  savePollOffset,
} from "./poll.js";
import { mapApiMessage, processTelegramInboundMessage } from "./process.js";
import { isShutdownRequested } from "../../runtime/shutdown.js";
import {
  loadPollTelemetry,
  savePollTelemetry,
} from "./telemetry.js";
import {
  isTelegramConflictError,
  reconcileTelegramPollers,
} from "../../commander/telegram-recovery.js";

export type TelegramPollOptions = {
  once?: boolean;
  longPollSec?: number;
};

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export async function pollTelegramReplies(
  options: TelegramPollOptions = {},
): Promise<number> {
  const config = loadConfig();
  const paths = getApprovalsPaths(config);
  const pollState = await loadPollOffset(config);
  const runtimeState = await loadApprovalsState(paths);

  const longPollSec = options.longPollSec ??
    parseInt(process.env.SOS_TELEGRAM_POLL_TIMEOUT_SEC ?? "0", 10);

  let processed = 0;
  let offset = pollState.last_update_id + 1;
  let lastUpdateId = pollState.last_update_id;
  let telemetry = await loadPollTelemetry(config);
  telemetry.polling_mode = longPollSec > 0 ? "long_poll" : "short_poll";
  telemetry.pid = process.pid;

  do {
    if (isShutdownRequested(config.logsRoot)) break;

    const pollStartedAt = new Date().toISOString();
    telemetry.last_poll_at = pollStartedAt;
    telemetry.polls_total += 1;

    let updates;
    try {
      updates = await fetchTelegramUpdates(config, offset, longPollSec);
      telemetry.last_poll_error = null;
      telemetry.telegram_conflict = false;
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      telemetry.last_poll_error = error;
      telemetry.errors_total += 1;
      await savePollTelemetry(config, telemetry);
      await logTelegramInbound(config, {
        message: "poll_error",
        error,
      });
      if (isTelegramConflictError(error)) {
        telemetry.telegram_conflict = true;
        telemetry.last_conflict_at = new Date().toISOString();
        await savePollTelemetry(config, telemetry);
        await reconcileTelegramPollers(config, process.pid);
        await sleep(2000);
        continue;
      }
      if (options.once) break;
      await sleep(parseInt(process.env.SOS_TELEGRAM_POLL_MS ?? "3000", 10));
      continue;
    }

    if (updates.length > 0) {
      telemetry.last_successful_poll_at = new Date().toISOString();
      await logTelegramInbound(config, {
        message: "poll_batch",
        details: { count: updates.length, offset },
      });
    }

    for (const update of updates) {
      lastUpdateId = Math.max(lastUpdateId, update.update_id);
      telemetry.last_update_id = lastUpdateId;

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
      telemetry.last_processed_update_id = update.update_id;
      telemetry.updates_processed_total += 1;
      processed += 1;
    }

    if (lastUpdateId > pollState.last_update_id) {
      await savePollOffset(config, lastUpdateId);
      pollState.last_update_id = lastUpdateId;
    }

    await savePollTelemetry(config, telemetry);

    runtimeState.last_processed_at = new Date().toISOString();
    runtimeState.updated_at = new Date().toISOString();
    if (runtimeState.processed_telegram_update_ids.length > 2000) {
      runtimeState.processed_telegram_update_ids =
        runtimeState.processed_telegram_update_ids.slice(-1000);
    }
    await saveApprovalsState(paths, runtimeState);

    offset = lastUpdateId + 1;

    if (!options.once) {
      await sleep(parseInt(process.env.SOS_TELEGRAM_POLL_MS ?? "3000", 10));
    }
  } while (!options.once);

  return processed;
}
