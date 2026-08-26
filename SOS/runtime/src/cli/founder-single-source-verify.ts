#!/usr/bin/env node
/**
 * AGENT #034 — Single source of truth for founder_instruction.
 * Verifies Developer and QA derive identical content from metadata.founder_instruction.
 */
import { readFile, unlink } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { loadConfig } from "../config.js";
import { getPmPaths } from "../pm/paths.js";
import { loadState } from "../pm/state.js";
import { routeInboxCommand } from "../commander/inbox-ai/command-router.js";
import { buildQaBrief, buildBugFixBrief } from "../pm/tasks.js";
import { founderInstructionFromTaskMetadata } from "../founder-instruction.js";
import { getDeveloperPaths } from "../developer/paths.js";
import { parseBriefMarkdown } from "../developer/queue.js";
import { parseQaBriefMarkdown } from "../qa/queue.js";
import {
  executeFounderFileStrategy,
  parseFounderFileInstruction,
} from "../developer/strategies/founder-file.js";
import { runFounderFileChecks } from "../qa/strategies/founder-file.js";
import type { WorkPlan } from "../developer/types.js";
import type { DeveloperReportInput } from "../qa/types.js";

const TEST_FILE = "SOS/07_LOGS/test/agent-034.txt";
const TEST_CONTENT = "ok";

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(msg);
}

async function main(): Promise<void> {
  const config = loadConfig();
  const pmPaths = getPmPaths(config);
  const testRel = join(config.repoRoot, TEST_FILE);

  if (existsSync(testRel)) {
    await unlink(testRel);
  }

  const msg = `Create file ${TEST_FILE} containing ${TEST_CONTENT}`;
  const routed = await routeInboxCommand(config, msg);
  assert(routed.result.ok && routed.result.intent === "EXECUTE_NOW", "EXECUTE_NOW routing");

  const taskId = routed.result.details?.task_id as string;
  const pmState = await loadState(pmPaths);
  const task = pmState.task_queue.find((t) => t.task_id === taskId);
  assert(Boolean(task), "task in pm state");

  const metadataInstruction = founderInstructionFromTaskMetadata(task!.metadata);
  assert(metadataInstruction === msg, "metadata.founder_instruction matches Telegram");

  const devBriefPath = join(pmPaths.devBriefs, `${taskId}.md`);
  const devBriefContent = await readFile(devBriefPath, "utf8");
  const devBrief = parseBriefMarkdown(devBriefContent, devBriefPath);
  assert(devBrief.founder_instruction === msg, "developer brief founder_instruction");
  assert(devBrief.founder_instruction === metadataInstruction, "dev brief === metadata");

  const workPlan: WorkPlan = {
    work_plan_id: "verify-034",
    task_id: taskId,
    correlation_id: devBrief.correlation_id,
    created_at: new Date().toISOString(),
    objective: "unused",
    title: "unused",
    acceptance_criteria: [],
    files_in_scope: [TEST_FILE],
    hard_gates: [],
    pm_recommendation: "",
    risks: [],
    unknowns: [],
  };

  const strategyOut = await executeFounderFileStrategy(config, devBrief, workPlan);
  const disk = await readFile(testRel, "utf8");
  assert(disk === TEST_CONTENT, `developer wrote "${TEST_CONTENT}"`);
  assert(
    parseFounderFileInstruction(msg)?.content === TEST_CONTENT,
    "parsed founder_instruction content is ok",
  );

  const qaBriefMd = buildQaBrief(task!);
  const qaBrief = parseQaBriefMarkdown(qaBriefMd, join(pmPaths.qaBriefs, `${taskId}.md`));
  assert(qaBrief.founder_instruction === msg, "QA brief founder_instruction");
  assert(qaBrief.founder_instruction === devBrief.founder_instruction, "QA brief === dev brief");

  const devReport: DeveloperReportInput = {
    task_id: taskId,
    correlation_id: devBrief.correlation_id,
    completed_at: new Date().toISOString(),
    summary: strategyOut.implementation_summary,
    files_changed: strategyOut.files_changed,
    build_passed: true,
    confidence: 90,
    blocker: false,
    evidence: [TEST_FILE],
  };

  const qaChecks = runFounderFileChecks(config.repoRoot, qaBrief, devReport);
  const failed = qaChecks.filter((c) => !c.passed);
  assert(failed.length === 0, `QA checks failed: ${failed.map((c) => c.item_id).join(", ")}`);

  const bugFixMd = buildBugFixBrief(task!, "content mismatch", ["CHK-FOUNDER-CONTENT"], []);
  const bugFixBrief = parseBriefMarkdown(bugFixMd, devBriefPath);
  assert(bugFixBrief.founder_instruction === msg, "bug-fix brief preserves founder_instruction");

  const bugFixQa = parseQaBriefMarkdown(qaBriefMd, "bug-qa.md");
  assert(bugFixQa.founder_instruction === msg, "QA brief unchanged after bug-fix cycle setup");

  if (existsSync(testRel)) {
    await unlink(testRel);
  }

  const report = {
    verified_at: new Date().toISOString(),
    telegram_message: msg,
    task_id: taskId,
    metadata_founder_instruction: metadataInstruction,
    developer_brief_founder_instruction: devBrief.founder_instruction,
    qa_brief_founder_instruction: qaBrief.founder_instruction,
    developer_wrote: TEST_CONTENT,
    qa_expected: parseFounderFileInstruction(msg)?.content,
    instructions_identical:
      metadataInstruction === devBrief.founder_instruction
      && devBrief.founder_instruction === qaBrief.founder_instruction,
    qa_checks_passed: failed.length === 0,
    bug_fix_preserves_instruction: bugFixBrief.founder_instruction === msg,
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
