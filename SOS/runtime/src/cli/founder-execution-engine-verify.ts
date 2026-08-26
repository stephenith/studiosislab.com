#!/usr/bin/env node
/**
 * Founder execution engine — strategy, PM protection, QA, end-to-end file write.
 * Run: npm run founder:execution-engine-verify
 */
import { readFile, unlink } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { loadConfig } from "../config.js";
import { getPmPaths } from "../pm/paths.js";
import { loadState, saveState } from "../pm/state.js";
import { routeInboxCommand } from "../commander/inbox-ai/command-router.js";
import { isFounderExecuteNowTask } from "../pm/founder-execute.js";
import { runReprioritizationCycle } from "../pm/reprioritize.js";
import { getDeveloperPaths } from "../developer/paths.js";
import { loadDeveloperState } from "../developer/state.js";
import {
  executeFounderFileStrategy,
  parseFounderFileInstruction,
} from "../developer/strategies/founder-file.js";
import { parseBriefMarkdown } from "../developer/queue.js";
import type { WorkPlan } from "../developer/types.js";
import { runFounderFileChecks } from "../qa/strategies/founder-file.js";
import type { DeveloperReportInput, ParsedQaBrief } from "../qa/types.js";

const TEST_FILE = "SOS/07_LOGS/test/founder-engine-verify.txt";
const TEST_CONTENT = "founder-engine-ok";

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(msg);
}

async function main(): Promise<void> {
  const config = loadConfig();
  const pmPaths = getPmPaths(config);
  const devPaths = getDeveloperPaths(config);
  const testRel = join(config.repoRoot, TEST_FILE);

  if (existsSync(testRel)) {
    await unlink(testRel);
  }

  const msg = `Create file ${TEST_FILE} containing ${TEST_CONTENT}`;
  assert(parseFounderFileInstruction(msg)?.type === "file", "parse founder instruction");

  const routed = await routeInboxCommand(config, msg);
  assert(routed.result.ok, "route EXECUTE_NOW");
  assert(routed.result.intent === "EXECUTE_NOW", "intent EXECUTE_NOW");

  const taskId = routed.result.details?.task_id as string;
  assert(Boolean(taskId), "task_id assigned");

  const pmAfter = await loadState(pmPaths);
  const task = pmAfter.task_queue.find((t) => t.task_id === taskId);
  assert(Boolean(task), "INBOX task in pm state");
  assert(task!.backlog_id === "INBOX-EXEC", "backlog_id INBOX-EXEC");
  assert(isFounderExecuteNowTask(task!), "isFounderExecuteNowTask");
  assert(pmAfter.current_task_id === taskId, "current_task_id is INBOX task");
  assert(pmAfter.developer_assignment?.task_id === taskId, "developer_assignment matches");

  const reprio = await runReprioritizationCycle(config, pmPaths, pmAfter, {
    assignReplacement: false,
    notify: false,
  });
  assert(reprio.decision === "continue", "reprioritization does not pause INBOX-EXEC");
  assert(
    pmAfter.current_task_id === taskId,
    "INBOX task still current after reprioritization",
  );

  const briefPath = join(pmPaths.devBriefs, `${taskId}.md`);
  const briefContent = await readFile(briefPath, "utf8");
  const brief = parseBriefMarkdown(briefContent, briefPath);
  const workPlan: WorkPlan = {
    work_plan_id: "verify",
    task_id: taskId,
    correlation_id: brief.correlation_id,
    created_at: new Date().toISOString(),
    objective: msg,
    title: msg,
    acceptance_criteria: [],
    files_in_scope: [TEST_FILE],
    hard_gates: [],
    pm_recommendation: "",
    risks: [],
    unknowns: [],
  };

  const strategyOut = await executeFounderFileStrategy(config, brief, workPlan);
  assert(strategyOut.files_changed.includes(TEST_FILE), "strategy files_changed");
  assert(existsSync(testRel), "file created on disk");
  const disk = await readFile(testRel, "utf8");
  assert(disk === TEST_CONTENT, "file content matches");

  const devReport: DeveloperReportInput = {
    task_id: taskId,
    correlation_id: brief.correlation_id,
    completed_at: new Date().toISOString(),
    summary: strategyOut.implementation_summary,
    files_changed: strategyOut.files_changed,
    build_passed: true,
    confidence: 90,
    blocker: false,
    evidence: [TEST_FILE],
  };

  const qaBrief: ParsedQaBrief = {
    task_id: taskId,
    correlation_id: brief.correlation_id,
    priority: "P0",
    title: msg,
    objective: msg,
    brief_path: briefPath,
    acceptance_criteria: [],
    files_in_scope: [TEST_FILE],
    dev_report_path: `SOS/07_LOGS/pm/reports/developer/${taskId}.json`,
    pm_requirements: "",
    qa_checklist: [],
    founder_instruction: brief.founder_instruction,
  };

  const qaChecks = runFounderFileChecks(config.repoRoot, qaBrief, devReport);
  assert(
    qaChecks.every((c) => c.passed),
    `QA founder checks: ${qaChecks.filter((c) => !c.passed).map((c) => c.item_id).join(", ")}`,
  );

  const devState = await loadDeveloperState(devPaths);
  const devMatches = devState.current_task_id === taskId;

  task!.status = "completed";
  pmAfter.task_queue = pmAfter.task_queue.filter((t) => t.task_id !== taskId);
  pmAfter.completed_task_ids.push(taskId);
  pmAfter.current_task_id = null;
  await saveState(pmPaths, pmAfter);

  if (existsSync(testRel)) {
    await unlink(testRel);
  }

  const report = {
    verified_at: new Date().toISOString(),
    task_id: taskId,
    file_created: true,
    content_ok: true,
    reprioritization_blocked: reprio.decision === "continue",
    pm_state_persisted: true,
    qa_checks_passed: qaChecks.every((c) => c.passed),
    developer_handoff: devMatches,
    pass: true,
  };

  console.log(JSON.stringify(report, null, 2));
  process.exit(0);
}

main().catch(async (e) => {
  const config = loadConfig();
  const testRel = join(config.repoRoot, TEST_FILE);
  if (existsSync(testRel)) {
    await unlink(testRel).catch(() => {});
  }
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
