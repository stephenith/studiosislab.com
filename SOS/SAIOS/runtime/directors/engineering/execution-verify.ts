#!/usr/bin/env node
/**
 * Engineering Director → Cursor Runner execution verification
 * Run: npm run engineering:execution-verify (from SOS/SAIOS/runtime)
 */
import { mkdir, readFile, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { QueueManager } from "../../queue/QueueManager.js";
import { RegistryManager } from "../../registry/RegistryManager.js";
import { WorkerFactory } from "../../workers/WorkerFactory.js";
import { CursorJobExecutor } from "../../cursor/CursorJobExecutor.js";
import { resolveQueuePaths } from "../../queue/paths.js";
import { resolveRegistryPaths } from "../../registry/paths.js";
import { resolveCursorPaths } from "../../cursor/paths.js";
import {
  ENGINEERING_EXECUTION_VERIFY_CONTENT,
  ENGINEERING_EXECUTION_VERIFY_PATH,
  ENGINEERING_EXECUTION_VERIFY_PROMPT,
} from "../../cursor/EngineeringCursorAdapter.js";
import { EngineeringDirector } from "./EngineeringDirector.js";
import { EngineeringExecutionCoordinator } from "./EngineeringExecutionCoordinator.js";
import { engineeringExecutionReportPath, resolveEngineeringPaths } from "./paths.js";

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(msg);
}

function normalizeContent(text: string): string {
  return text.replace(/\r\n/g, "\n").trim();
}

async function main(): Promise<void> {
  const ts = String(Date.now());
  const paths = resolveEngineeringPaths();
  const cursorPaths = resolveCursorPaths();
  const jobsBase = resolveQueuePaths().jobsDir;
  const registryBase = resolveRegistryPaths().registryDir;
  const verifyJobsDir = join(jobsBase, "verify-runs", `eng-exec-${ts}`);
  const verifyRegistryDir = join(registryBase, "verify-runs", `eng-exec-${ts}`);
  const verifyCursorReportsDir = join(cursorPaths.reportsDir, "verify-runs", `eng-exec-${ts}`);
  const verifyExecutionReportsDir = join(paths.reportsDir, "execution-reports", "verify-runs", ts);
  const outputAbs = join(cursorPaths.repoRoot, ENGINEERING_EXECUTION_VERIFY_PATH);

  await mkdir(verifyJobsDir, { recursive: true });
  await mkdir(verifyRegistryDir, { recursive: true });
  await mkdir(verifyExecutionReportsDir, { recursive: true });
  await mkdir(join(cursorPaths.repoRoot, "SOS/07_LOGS/saios/directors/engineering/execution/verify"), {
    recursive: true,
  });

  if (existsSync(outputAbs)) {
    await rm(outputAbs, { force: true });
  }

  const queue = new QueueManager({
    jobsDir: verifyJobsDir,
    eventsFile: join(verifyJobsDir, "events.jsonl"),
  });
  const registry = new RegistryManager({
    registryDir: verifyRegistryDir,
    eventsFile: join(verifyRegistryDir, "events.jsonl"),
  });

  const workerFactory = new WorkerFactory({ registry });
  const resumeWorker = await workerFactory.createWorker({
    worker_type: "resume-worker",
    display_name: "Resume Worker (verify)",
    metadata: { verify: true },
  });

  const job = await queue.createJob({
    id: `JOB-ENG-EXEC-VERIFY-${ts}`,
    title: "Build ATS resume template sample",
    description: "Engineering execution pipeline verification for Resume Worker",
    priority: "P1",
    creator: "engineering-director",
    metadata: {
      worker_type: "resume-worker",
      required_capability: "resume",
      engineering_execution: true,
      prompt: ENGINEERING_EXECUTION_VERIFY_PROMPT,
    },
  });

  await queue.assignWorker(job.id, resumeWorker.worker_id);
  await registry.assignJob(resumeWorker.worker_id, job.id);

  const cursorExecutor = new CursorJobExecutor({
    queue,
    reportsDir: verifyCursorReportsDir,
    workspaceRoot: cursorPaths.repoRoot,
  });

  const executionCoordinator = new EngineeringExecutionCoordinator({
    cursorExecutor,
    executionReportsDir: verifyExecutionReportsDir,
  });

  const director = new EngineeringDirector({
    queue,
    registry,
    executionCoordinator,
  });

  const loadedJob = (await queue.loadJob(job.id))!;
  const executionReport = await director.executeDelegatedJob(resumeWorker, loadedJob, {
    prompt_override: ENGINEERING_EXECUTION_VERIFY_PROMPT,
  });

  assert(executionReport.status === "success", `execution should succeed, got ${executionReport.status}`);
  assert(Boolean(executionReport.cursor_run_id), "cursor_run_id required");
  assert(executionReport.duration_ms >= 0, "duration_ms required");
  assert(existsSync(outputAbs), "resume-task.md should exist");

  const content = normalizeContent(await readFile(outputAbs, "utf8"));
  assert(content === normalizeContent(ENGINEERING_EXECUTION_VERIFY_CONTENT), "resume-task.md content mismatch");

  const reportAbs = engineeringExecutionReportPath(verifyExecutionReportsDir, job.id);
  assert(existsSync(reportAbs), "EngineeringExecutionReport file should exist");

  const reloadedJob = await queue.loadJob(job.id);
  assert(reloadedJob?.status === "WAITING_QA", `job should be WAITING_QA, got ${reloadedJob?.status}`);

  await rm(verifyJobsDir, { recursive: true, force: true });
  await rm(verifyRegistryDir, { recursive: true, force: true });
  await rm(verifyExecutionReportsDir, { recursive: true, force: true });
  await rm(verifyCursorReportsDir, { recursive: true, force: true });

  console.log(
    JSON.stringify(
      {
        pass: true,
        component: "engineering-execution-pipeline",
        worker_type: "resume-worker",
        worker_id: resumeWorker.worker_id,
        job_id: job.id,
        cursor_run_id: executionReport.cursor_run_id,
        duration_ms: executionReport.duration_ms,
        status: executionReport.status,
        output_path: ENGINEERING_EXECUTION_VERIFY_PATH,
        checks: {
          engineering_director_delegated: true,
          cursor_runner_executed: true,
          execution_report_generated: true,
          queue_updated: true,
        },
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error(JSON.stringify({ pass: false, error: String(err) }, null, 2));
  process.exit(1);
});
