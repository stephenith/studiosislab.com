#!/usr/bin/env node
/**
 * SAIOS Executive Orchestrator verification
 * Run: npm run chief:verify (from SOS/SAIOS/runtime)
 */
import { mkdir, readFile, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { QueueManager } from "../queue/QueueManager.js";
import { RegistryManager } from "../registry/RegistryManager.js";
import { resolveQueuePaths } from "../queue/paths.js";
import { resolveRegistryPaths } from "../registry/paths.js";
import { ExecutiveOrchestrator } from "./ExecutiveOrchestrator.js";
import type { SaiosJob } from "../queue/types.js";

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(msg);
}

async function registerWorkers(reg: RegistryManager, count: number): Promise<string[]> {
  const ids: string[] = [];
  const planCount = 2;
  const qaCount = 3;
  const devCount = count - planCount - qaCount;

  for (let i = 1; i <= planCount; i++) {
    const w = await reg.registerWorker({
      id: `WRK-EO-plan-${i}`,
      name: `Plan Worker ${i}`,
      type: "planner",
      version: "1.0.0",
      capabilities: ["plan"],
      host: "verify-host",
      metadata: { verify: true, priority: "P1" },
    });
    await reg.heartbeat(w.id);
    ids.push(w.id);
  }

  for (let i = 1; i <= qaCount; i++) {
    const w = await reg.registerWorker({
      id: `WRK-EO-qa-${i}`,
      name: `QA Worker ${i}`,
      type: "cursor-qa",
      version: "1.0.0",
      capabilities: ["verify"],
      host: "verify-host",
      metadata: { verify: true, priority: "P2" },
    });
    await reg.heartbeat(w.id);
    ids.push(w.id);
  }

  for (let i = 1; i <= devCount; i++) {
    const w = await reg.registerWorker({
      id: `WRK-EO-dev-${i}`,
      name: `Dev Worker ${i}`,
      type: "cursor-dev",
      version: "1.0.0",
      capabilities: ["implement"],
      host: `verify-host-${(i % 3) + 1}`,
      metadata: { verify: true, priority: i <= 5 ? "P0" : "P2" },
    });
    await reg.heartbeat(w.id);
    ids.push(w.id);
  }

  return ids;
}

async function reloadPlanJobs(queue: QueueManager, planId: string): Promise<SaiosJob[]> {
  const all = await queue.listJobs();
  return all.filter((j) => j.metadata?.plan_id === planId);
}

async function runOrchestrationCycle(
  orchestrator: ExecutiveOrchestrator,
  planId: string,
  queue: QueueManager,
): Promise<void> {
  let safety = 0;
  while (safety++ < 200) {
    const plan = orchestrator.getActivePlan();
    assert(Boolean(plan), "active plan required during orchestration cycle");
    const jobs = await reloadPlanJobs(queue, planId);
    const progress = await orchestrator.trackExecution(planId);
    if (progress.completed === progress.total_jobs && progress.total_jobs > 0) break;

    const assignments = await orchestrator.selectWorkers(plan!, jobs);
    if (assignments.length > 0) {
      await orchestrator.assignJobs(assignments);
    }

    const refreshed = await reloadPlanJobs(queue, planId);
    const ready = refreshed
      .filter((j) => j.assigned_worker && j.status !== "COMPLETED" && j.status !== "FAILED")
      .sort((a, b) => {
        const stepA = typeof a.metadata?.step === "number" ? a.metadata.step : 0;
        const stepB = typeof b.metadata?.step === "number" ? b.metadata.step : 0;
        return stepA - stepB;
      });

    let advanced = false;
    for (const job of ready) {
      const depsOk = job.dependencies.every((depId) => {
        const dep = refreshed.find((j) => j.id === depId);
        return dep?.status === "COMPLETED";
      });
      if (!depsOk) continue;
      await orchestrator.recordDelegatedCompletion(
        job.id,
        `SOS/07_LOGS/saios/chief/reports/jobs/${job.id}.md`,
      );
      advanced = true;
      break;
    }

    if (!advanced && assignments.length === 0) {
      const stuck = refreshed.filter((j) => j.status !== "COMPLETED" && j.status !== "FAILED");
      if (stuck.length === 0) break;
      throw new Error(`Orchestrator verify stuck with ${stuck.length} incomplete job(s)`);
    }
  }
}

async function verifyConsistency(
  queue: QueueManager,
  registry: RegistryManager,
  planId: string,
  workerCount: number,
  expectedJobCount: number,
): Promise<void> {
  const jobs = await queue.listJobs();
  const planJobs = jobs.filter((j) => j.metadata?.plan_id === planId);
  assert(planJobs.length === expectedJobCount, `expected ${expectedJobCount} plan jobs, got ${planJobs.length}`);

  const workers = await registry.listWorkers();
  assert(workers.length === workerCount, `expected ${workerCount} workers, got ${workers.length}`);

  for (const worker of workers) {
    if (worker.current_job) {
      const job = await queue.loadJob(worker.current_job);
      assert(Boolean(job), `worker ${worker.id} references missing job ${worker.current_job}`);
      assert(
        job!.assigned_worker === worker.id,
        `worker ${worker.id} job assignment mismatch on ${job!.id}`,
      );
    }
    if (worker.status === "BUSY") {
      assert(Boolean(worker.current_job), `BUSY worker ${worker.id} has no current_job`);
    }
  }

  for (const job of planJobs) {
    if (job.assigned_worker && job.status !== "COMPLETED" && job.status !== "FAILED") {
      const worker = await registry.getWorker(job.assigned_worker);
      assert(Boolean(worker), `job ${job.id} assigned to missing worker`);
    }
  }

  const completed = planJobs.filter((j) => j.status === "COMPLETED").length;
  assert(completed === expectedJobCount, `expected all ${expectedJobCount} jobs completed, got ${completed}`);
}

async function main(): Promise<void> {
  const ts = String(Date.now());
  const jobsBase = resolveQueuePaths().jobsDir;
  const registryBase = resolveRegistryPaths().registryDir;
  const verifyJobsDir = join(jobsBase, "verify-runs", ts);
  const verifyRegistryDir = join(registryBase, "verify-runs", ts);
  const reportsDir = join(verifyJobsDir, "chief-reports");

  await mkdir(verifyJobsDir, { recursive: true });
  await mkdir(verifyRegistryDir, { recursive: true });

  const queueEvents = join(verifyJobsDir, "events.jsonl");
  const registryEvents = join(verifyRegistryDir, "events.jsonl");

  const queue = new QueueManager({ jobsDir: verifyJobsDir, eventsFile: queueEvents });
  const registry = new RegistryManager({ registryDir: verifyRegistryDir, eventsFile: registryEvents });
  const orchestrator = new ExecutiveOrchestrator({ queue, registry, reportsDir });

  const workerIds = await registerWorkers(registry, 20);
  assert(workerIds.length === 20, "expected 20 workers");

  const command = {
    source: "verify" as const,
    raw_text: "batch-50: Implement executive orchestrator module with full qa verification",
    received_at: new Date().toISOString(),
  };

  const received = await orchestrator.receiveFounderCommand(command);
  assert(received.accepted, "founder command should be accepted");
  assert(Boolean(received.plan_id), "plan_id required");
  const planId = received.plan_id!;

  const planJobs = await reloadPlanJobs(queue, planId);
  assert(planJobs.length === 50, `expected 50 jobs from plan, got ${planJobs.length}`);

  await runOrchestrationCycle(orchestrator, planId, queue);

  const progress = await orchestrator.trackExecution(planId);
  assert(progress.total_jobs === 50, `progress total_jobs should be 50, got ${progress.total_jobs}`);
  assert(progress.completed === 50, `progress completed should be 50, got ${progress.completed}`);
  assert(progress.overall_percent === 100, `overall_percent should be 100, got ${progress.overall_percent}`);

  const completion = await orchestrator.finishExecution(planId);
  assert(completion.success, "completion report should mark success");
  assert(completion.job_reports.length === 50, "completion report should list 50 jobs");

  const reportFile = join(reportsDir, `${planId}.json`);
  assert(existsSync(reportFile), "completion report file should exist on disk");

  // Reload from disk — fresh manager instances
  const queueReload = new QueueManager({ jobsDir: verifyJobsDir, eventsFile: queueEvents });
  const registryReload = new RegistryManager({
    registryDir: verifyRegistryDir,
    eventsFile: registryEvents,
  });
  const orchestratorReload = new ExecutiveOrchestrator({
    queue: queueReload,
    registry: registryReload,
    reportsDir,
  });

  await verifyConsistency(queueReload, registryReload, planId, 20, 50);

  const reloadedReport = JSON.parse(await readFile(reportFile, "utf8")) as { plan_id: string };
  assert(reloadedReport.plan_id === planId, "reloaded completion report plan_id mismatch");

  const reloadedProgress = await orchestratorReload.trackExecution(planId);
  assert(reloadedProgress.completed === 50, "reloaded progress should show 50 completed");

  await rm(verifyJobsDir, { recursive: true, force: true });
  await rm(verifyRegistryDir, { recursive: true, force: true });

  const result = {
    pass: true,
    component: "executive-orchestrator",
    workers: 20,
    jobs: 50,
    plan_id: planId,
    progress,
    completion_success: completion.success,
  };

  console.log(JSON.stringify(result, null, 2));
}

main().catch((err) => {
  console.error(JSON.stringify({ pass: false, error: String(err) }, null, 2));
  process.exit(1);
});
