#!/usr/bin/env node
/**
 * Work order runner verification (dry-run; no Cursor auth required).
 * Run: npm run work-order:runner-verify
 */
import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { loadConfig } from "../config.js";
import { discoverCursorAgentCli } from "../commander/work-orders/cursor-cli.js";
import { getWorkOrderPaths, promptMdPath } from "../commander/work-orders/paths.js";
import { executeWorkOrder } from "../commander/work-orders/runner.js";
import { createWorkOrder, loadWorkOrder, updateWorkOrderStatus } from "../commander/work-orders/store.js";

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(msg);
}

async function main(): Promise<void> {
  const config = loadConfig();
  const paths = getWorkOrderPaths(config);
  const discovery = await discoverCursorAgentCli();

  const msg = "Runner verify: create a small SOS report file only.";
  const order = await createWorkOrder(config, msg);
  const woId = order.work_order_id;
  assert(Boolean(woId), "work_order_id present");

  await updateWorkOrderStatus(config, woId, "in_progress", "runner verify dry-run");
  const report = await executeWorkOrder(config, order, { dryRun: true }, discovery);
  const reportPath = join(paths.reports, `${woId}.json`);
  await writeFile(reportPath, JSON.stringify(report, null, 2), "utf8");
  await updateWorkOrderStatus(config, woId, "done", "dry-run complete");

  assert(report.work_order_id === woId, "processed expected work order");
  assert(report.status === "done", "dry-run status done");
  assert(report.dry_run === true, "dry_run flag set");
  assert(existsSync(reportPath), "execution report written");

  const loaded = await loadWorkOrder(config, woId);
  assert(loaded?.status === "done", "work order marked done after dry-run");

  const prompt = await readFile(promptMdPath(paths, woId), "utf8");
  assert(prompt.includes(msg), "prompt contains founder message");

  const output = {
    verified_at: new Date().toISOString(),
    work_order_id: woId,
    discovery: {
      cursor_bin: discovery.cursor_bin,
      cursor_agent_bin: discovery.cursor_agent_bin,
      cursor_agent_version: discovery.cursor_agent_version,
      supports_headless_print: discovery.supports_headless_print,
      auth_status: discovery.auth_status,
    },
    dry_run_report: report,
    tests: {
      create_work_order: true,
      dry_run_execute: true,
      report_written: true,
      status_done: true,
    },
    pass: true,
  };

  console.log(JSON.stringify(output, null, 2));
  process.exit(0);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
