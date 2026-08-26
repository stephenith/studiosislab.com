#!/usr/bin/env node
/**
 * Dynamic Workforce Manager verification
 * Run: npm run workforce:verify (from SOS/SAIOS/runtime)
 */
import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { QueueManager } from "../../queue/QueueManager.js";
import { RegistryManager } from "../../registry/RegistryManager.js";
import { resolveQueuePaths } from "../../queue/paths.js";
import { resolveRegistryPaths } from "../../registry/paths.js";
import { WorkerFactory } from "../../workers/WorkerFactory.js";
import { EngineeringDirector } from "./EngineeringDirector.js";
import { DynamicWorkforceManager } from "./DynamicWorkforceManager.js";
import { resolveEngineeringPaths } from "./paths.js";

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(msg);
}

async function drainQueue(queue: QueueManager, factory: WorkerFactory): Promise<void> {
  const queued = await queue.listQueuedJobs();
  for (const job of queued) {
    await queue.cancelJob(job.id, "workforce verify drain");
  }
  const busy = await factory.listWorkers({ status: "BUSY" });
  for (const worker of busy) {
    await factory.releaseJob(worker.worker_id, "verify drain");
  }
}

async function main(): Promise<void> {
  const ts = String(Date.now());
  const jobsBase = resolveQueuePaths().jobsDir;
  const registryBase = resolveRegistryPaths().registryDir;
  const engineeringPaths = resolveEngineeringPaths();
  const verifyJobsDir = join(jobsBase, "verify-runs", `workforce-${ts}`);
  const verifyRegistryDir = join(registryBase, "verify-runs", `workforce-${ts}`);
  const verifyReportsDir = join(engineeringPaths.repoRoot, "SOS", "07_LOGS", "saios", "directors", "engineering", "workforce", "verify-runs", ts);

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
  const factory = new WorkerFactory({ registry });
  const workforceManager = new DynamicWorkforceManager({
    queue,
    registry,
    workerFactory: factory,
    reportsDir: verifyReportsDir,
    policy: { create_batch_size: 5, failure_retire_threshold: 3 },
  });
  const director = new EngineeringDirector({
    queue,
    registry,
    workforceManager,
  });

  const workers = [];
  for (let i = 0; i < 10; i++) {
    workers.push(
      await factory.createWorker({
        worker_type: "resume-worker",
        metadata: { permanent: true, workforce_tier: "permanent", default_execution_ms: 25_000 },
      }),
    );
  }

  for (let i = 0; i < 3; i++) {
    const busyJob = await queue.createJob({
      id: `JOB-WF-BUSY-${ts}-${i}`,
      title: `Busy slot ${i}`,
      description: "Occupies worker for verify",
      priority: "P2",
      creator: "workforce-verify",
    });
    await factory.assignJob(workers[i]!.worker_id, busyJob.id);
  }

  await factory.pauseWorker(workers[3]!.worker_id, "verify pause");
  await factory.pauseWorker(workers[4]!.worker_id, "verify pause");

  await factory.heartbeat(workers[5]!.worker_id, { failure_count: 5 });
  await factory.setStatus(workers[5]!.worker_id, "FAILED", "repeated failures");

  for (let i = 0; i < 200; i++) {
    await queue.createJob({
      id: `JOB-WF-QUEUE-${ts}-${i}`,
      title: `Queued engineering task ${i}`,
      description: "Simulated backlog for workforce scaling",
      priority: i % 10 === 0 ? "P0" : i % 3 === 0 ? "P1" : "P2",
      creator: "workforce-verify",
      metadata: {
        required_capability: "resume",
        worker_type: "resume-worker",
      },
    });
  }

  const cycle1 = await director.scaleWorkforce();
  assert(cycle1.report.actions_created > 0, "should create workers when queue exceeds idle capacity");
  assert(cycle1.report.actions_resumed > 0, "should resume paused workers during backlog");
  assert(cycle1.report.actions_retired > 0, "should retire repeatedly failing workers");

  await drainQueue(queue, factory);

  const cycle2 = await workforceManager.runScalingCycle();
  assert(cycle2.report.actions_retired > 0, "should retire temporary workers when queue is empty");

  for (let i = 0; i < 8; i++) {
    await factory.createWorker({
      worker_type: "resume-worker",
      metadata: { temporary: true, workforce_tier: "temporary", created_by: "verify-surplus" },
    });
  }

  const cycle3 = await workforceManager.runScalingCycle();
  assert(cycle3.report.actions_paused > 0, "should pause surplus idle temporary workers");

  for (let i = 0; i < 30; i++) {
    await queue.createJob({
      id: `JOB-WF-RESUME-${ts}-${i}`,
      title: `Resume backlog ${i}`,
      description: "Triggers resume of paused workers",
      priority: "P1",
      creator: "workforce-verify",
      metadata: { required_capability: "resume" },
    });
  }

  const pausedBefore = (await factory.listWorkers({ status: "PAUSED" })).length;
  const cycle4 = await workforceManager.runScalingCycle();
  assert(
    cycle4.report.actions_resumed > 0 || pausedBefore === 0,
    "should resume paused workers when backlog returns",
  );

  const finalSnapshot = await workforceManager.analyze();
  assert(finalSnapshot.queue_depth === 30, `expected 30 queued jobs, got ${finalSnapshot.queue_depth}`);

  await rm(verifyJobsDir, { recursive: true, force: true });
  await rm(verifyRegistryDir, { recursive: true, force: true });
  await rm(verifyReportsDir, { recursive: true, force: true });

  console.log(
    JSON.stringify(
      {
        pass: true,
        component: "dynamic-workforce-manager",
        initial_workers: 10,
        queued_jobs: 200,
        scaling_cycles: 4,
        cycle_1: {
          actions_created: cycle1.report.actions_created,
          actions_resumed: cycle1.report.actions_resumed,
          actions_retired: cycle1.report.actions_retired,
        },
        cycle_2: {
          actions_retired: cycle2.report.actions_retired,
        },
        cycle_3: {
          actions_paused: cycle3.report.actions_paused,
        },
        cycle_4: {
          actions_resumed: cycle4.report.actions_resumed,
        },
        final_report_id: cycle4.report.report_id,
        checks: {
          automatic_worker_creation: cycle1.report.actions_created > 0,
          automatic_retirement: cycle2.report.actions_retired > 0,
          automatic_pause: cycle3.report.actions_paused > 0,
          automatic_resume: cycle1.report.actions_resumed > 0 || cycle4.report.actions_resumed > 0,
          scaling_report_generated: Boolean(cycle4.report.report_id),
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
