#!/usr/bin/env node
/**
 * Read-only startup recovery verification.
 * Does not modify state, logs, or active work.
 */
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { loadConfig } from "../config.js";
import { getCommanderPaths } from "../commander/paths.js";
import { readPmTaskSnapshot } from "../commander/production-audit.js";
import { recoverStaleLocks } from "../commander/lock-recovery.js";
import { readDeveloperState, readQaState } from "./recovery-state.js";

async function main(): Promise<void> {
  const config = loadConfig();
  const paths = getCommanderPaths(config);
  const pm = await readPmTaskSnapshot();
  const dev = await readDeveloperState(config);
  const qa = await readQaState(config);
  const lockDryRun = await recoverStaleLocks(config, { dryRun: true });

  const recoveryPath = join(paths.root, "last-recovery.json");
  let lastRecovery: Record<string, unknown> | null = null;
  if (existsSync(recoveryPath)) {
    lastRecovery = JSON.parse(await readFile(recoveryPath, "utf8")) as Record<string, unknown>;
  }

  const telegramOffsetPath = join(config.logsRoot, "approvals", "telegram-offset.json");
  let telegramOffset: number | null = null;
  if (existsSync(telegramOffsetPath)) {
    try {
      const raw = JSON.parse(await readFile(telegramOffsetPath, "utf8")) as {
        last_update_id?: number;
      };
      telegramOffset = raw.last_update_id ?? null;
    } catch {
      telegramOffset = null;
    }
  }

  const retryQueuePath = join(config.dispatchRoot, "retry-queue.jsonl");
  let retryQueueLines = 0;
  if (existsSync(retryQueuePath)) {
    retryQueueLines = (await readFile(retryQueuePath, "utf8")).split("\n").filter(Boolean).length;
  }

  const checks = {
    pm_task_preserved: Boolean(pm.current_task_id) || pm.task_count > 0,
    developer_recoverable:
      dev.state === "idle"
      || dev.state === "working"
      || dev.state === "prepared"
      || dev.state === "awaiting_qa",
    qa_recoverable:
      qa.state === "idle" || qa.state === "pass" || qa.state === "fail" || Boolean(qa.current_task_id),
    no_stale_locks_pending: lockDryRun.total_removed === 0,
  };

  const informational = {
    telegram_offset_file: existsSync(telegramOffsetPath),
    telegram_offset: telegramOffset,
    dispatcher_retry_queue_lines: retryQueueLines,
    last_recovery_recorded: lastRecovery !== null,
  };

  const report = {
    verified_at: new Date().toISOString(),
    pm,
    developer: dev,
    qa,
    telegram: { offset_path: telegramOffsetPath, offset: telegramOffset },
    dispatcher: { retry_queue_path: retryQueuePath, lines: retryQueueLines },
    lock_recovery_dry_run: lockDryRun,
    last_recovery: lastRecovery,
    checks,
    informational,
    all_ok: Object.values(checks).every(Boolean),
  };

  console.log(JSON.stringify(report, null, 2));
  if (!report.all_ok) process.exit(1);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
