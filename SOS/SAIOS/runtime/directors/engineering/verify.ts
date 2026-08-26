#!/usr/bin/env node
/**
 * Engineering Director verification
 * Run: npm run engineering:verify (from SOS/SAIOS/runtime)
 */
import { mkdir, readFile, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { QueueManager } from "../../queue/QueueManager.js";
import { RegistryManager } from "../../registry/RegistryManager.js";
import { resolveQueuePaths } from "../../queue/paths.js";
import { resolveRegistryPaths } from "../../registry/paths.js";
import { EngineeringDirector } from "./EngineeringDirector.js";
import { engineeringReportPath, resolveEngineeringPaths } from "./paths.js";
import { ENGINEERING_WORKER_TYPES } from "./EngineeringPolicies.js";

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(msg);
}

async function simulateJobCompletion(
  queue: QueueManager,
  registry: RegistryManager,
  jobId: string,
): Promise<void> {
  let job = await queue.loadJob(jobId);
  if (!job) return;

  if (job.status === "QUEUED") {
    job = await queue.updateStatus(jobId, { status: "RUNNING", note: "verify simulate" }, "engineering-director");
  }
  if (job.status === "RUNNING" || job.status === "WAITING_QA") {
    job = await queue.updateStatus(
      jobId,
      { status: "WAITING_QA", note: "verify ready" },
      "engineering-director",
    );
  }
  if (job.status === "WAITING_QA") {
    await queue.completeJob(jobId, `engineering/verify/${jobId}.md`);
  }

  if (job.assigned_worker) {
    try {
      await registry.releaseJob(job.assigned_worker, "verify complete");
    } catch {
      // may already be idle
    }
  }
}

async function main(): Promise<void> {
  const ts = String(Date.now());
  const jobsBase = resolveQueuePaths().jobsDir;
  const registryBase = resolveRegistryPaths().registryDir;
  const verifyJobsDir = join(jobsBase, "verify-runs", `engineering-${ts}`);
  const verifyRegistryDir = join(registryBase, "verify-runs", `engineering-${ts}`);
  const verifyReportsDir = join(resolveEngineeringPaths().reportsDir, "verify-runs", ts);

  await mkdir(verifyJobsDir, { recursive: true });
  await mkdir(verifyRegistryDir, { recursive: true });
  await mkdir(verifyReportsDir, { recursive: true });

  const queue = new QueueManager({
    jobsDir: verifyJobsDir,
    eventsFile: join(verifyJobsDir, "events.jsonl"),
  });
  const registry = new RegistryManager({
    registryDir: verifyRegistryDir,
    eventsFile: join(verifyRegistryDir, "events.jsonl"),
  });

  const director = new EngineeringDirector({
    queue,
    registry,
    reportsDir: verifyReportsDir,
  });

  const objective = {
    raw_text: "Build three ATS resume templates.",
    received_at: new Date().toISOString(),
    requester: "verify",
  };

  const plan = director.analyseObjective(objective);
  assert(plan.goal.includes("ATS resume"), "plan should reflect objective");
  assert(plan.worker_types.includes("resume-worker"), "plan should include resume-worker");
  assert(plan.worker_types.includes("testing-worker"), "plan should include testing-worker");
  assert(plan.estimated_jobs === 5, `expected 5 jobs (3+test+docs), got ${plan.estimated_jobs}`);

  const result = await director.executeWithMonitoring(objective, {
    maxWaves: 15,
    onJobReady: async (jobId) => {
      await simulateJobCompletion(queue, registry, jobId);
    },
  });

  assert(result.plan.estimated_jobs === 5, "result plan should have 5 jobs");
  assert(result.delegation.worker_requests.length >= 3, "workers should be requested");
  assert(result.delegation.job_ids.length === 5, `expected 5 jobs, got ${result.delegation.job_ids.length}`);

  const queued = await queue.listJobs();
  assert(queued.length === 5, "queue should be populated");
  assert(result.progress.completed === 5, `expected 5 completed, got ${result.progress.completed}`);
  assert(result.report.summary.success, "consolidated report should mark success");
  assert(result.report.job_reports.length === 5, "report should list 5 jobs");
  assert(existsSync(engineeringReportPath(verifyReportsDir, result.plan.id)), "report file should exist on disk");

  const reloaded = JSON.parse(
    await readFile(engineeringReportPath(verifyReportsDir, result.plan.id), "utf8"),
  ) as { plan_id: string; summary: { success: boolean } };
  assert(reloaded.plan_id === result.plan.id, "reloaded report plan_id mismatch");
  assert(reloaded.summary.success, "reloaded report should be success");

  assert(ENGINEERING_WORKER_TYPES.length === 12, "12 worker type definitions expected");

  await rm(verifyJobsDir, { recursive: true, force: true });
  await rm(verifyRegistryDir, { recursive: true, force: true });
  await rm(verifyReportsDir, { recursive: true, force: true });

  console.log(
    JSON.stringify(
      {
        pass: true,
        component: "engineering-director",
        objective: objective.raw_text,
        plan_id: result.plan.id,
        worker_types: result.plan.worker_types,
        jobs: result.delegation.job_ids.length,
        workers_requested: result.delegation.worker_requests.length,
        jobs_completed: result.progress.completed,
        report_path: result.report.report_path,
        checks: {
          engineering_plan_generated: true,
          workers_requested: true,
          jobs_created: true,
          queue_populated: true,
          reports_consolidated: true,
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
