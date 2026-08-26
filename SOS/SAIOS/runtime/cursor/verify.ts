#!/usr/bin/env node
/**
 * SAIOS Cursor Runner verification — ONE real Cursor Agent execution
 * Run: npm run cursor:verify (from SOS/SAIOS/runtime)
 */
import { mkdir, readFile, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { QueueManager } from "../queue/QueueManager.js";
import { resolveQueuePaths } from "../queue/paths.js";
import { CursorJobExecutor } from "./CursorJobExecutor.js";
import { resolveCursorPaths } from "./paths.js";
import {
  CURSOR_VERIFY_HELLO_CONTENT,
  CURSOR_VERIFY_HELLO_PATH,
  CURSOR_VERIFY_PROMPT,
} from "./types.js";

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(msg);
}

function normalizeContent(text: string): string {
  return text.replace(/\r\n/g, "\n").trim();
}

async function main(): Promise<void> {
  const paths = resolveCursorPaths();
  const ts = String(Date.now());
  const jobsBase = resolveQueuePaths().jobsDir;
  const verifyJobsDir = join(jobsBase, "verify-runs", `cursor-${ts}`);
  const verifyReportsDir = join(paths.reportsDir, "verify-runs", ts);
  const helloAbs = join(paths.repoRoot, CURSOR_VERIFY_HELLO_PATH);

  await mkdir(verifyJobsDir, { recursive: true });
  await mkdir(verifyReportsDir, { recursive: true });
  await mkdir(join(paths.repoRoot, "SOS/07_LOGS/saios/test-output"), { recursive: true });

  if (existsSync(helloAbs)) {
    await rm(helloAbs, { force: true });
  }

  const queue = new QueueManager({
    jobsDir: verifyJobsDir,
    eventsFile: join(verifyJobsDir, "events.jsonl"),
  });

  const job = await queue.createJob({
    id: `JOB-CURSOR-VERIFY-${ts}`,
    title: "SAIOS Cursor Runner verification",
    description: "Create hello.md in test-output via Cursor Agent",
    priority: "P1",
    creator: "cursor-verify",
    metadata: {
      prompt: CURSOR_VERIFY_PROMPT,
      verify: true,
      required_capability: "implement",
    },
  });

  const executor = new CursorJobExecutor({
    queue,
    reportsDir: verifyReportsDir,
    workspaceRoot: paths.repoRoot,
  });

  const result = await executor.execute(job);

  const checks = {
    process_launched: result.outcome.launched,
    exit_code_zero: result.outcome.exit_code === 0,
    markdown_exists: existsSync(helloAbs),
    queue_waiting_qa: result.job.status === "WAITING_QA",
    report_created: existsSync(join(verifyReportsDir, `${job.id.replace(/[^a-zA-Z0-9_-]/g, "_")}.json`)),
  };

  if (checks.markdown_exists) {
    const content = normalizeContent(await readFile(helloAbs, "utf8"));
    const expected = normalizeContent(CURSOR_VERIFY_HELLO_CONTENT);
    assert(content === expected, `hello.md content mismatch:\n${content}`);
  }

  const queueReload = new QueueManager({
    jobsDir: verifyJobsDir,
    eventsFile: join(verifyJobsDir, "events.jsonl"),
  });
  const reloaded = await queueReload.loadJob(job.id);
  assert(Boolean(reloaded), "reloaded job missing");
  assert(reloaded!.status === "WAITING_QA", `reloaded status should be WAITING_QA, got ${reloaded!.status}`);
  assert(Boolean(reloaded!.report_path), "reloaded job should have report_path");

  const allPass = Object.values(checks).every(Boolean);
  assert(allPass, `checks failed: ${JSON.stringify(checks)}`);

  await rm(verifyJobsDir, { recursive: true, force: true });
  await rm(verifyReportsDir, { recursive: true, force: true });

  const output = {
    pass: true,
    component: "cursor-runner",
    job_id: job.id,
    duration_ms: result.outcome.duration_ms,
    exit_code: result.outcome.exit_code,
    checks,
    hello_path: CURSOR_VERIFY_HELLO_PATH,
  };

  console.log(JSON.stringify(output, null, 2));
}

main().catch((err) => {
  console.error(JSON.stringify({ pass: false, error: String(err) }, null, 2));
  process.exit(1);
});
