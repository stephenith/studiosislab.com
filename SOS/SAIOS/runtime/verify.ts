#!/usr/bin/env node
/**
 * SAIOS Runtime Loop verification
 * Run: npm run loop:verify (from SOS/SAIOS/runtime)
 */
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { QueueManager } from "./queue/QueueManager.js";
import { RegistryManager } from "./registry/RegistryManager.js";
import { ExecutiveOrchestrator } from "./chief/ExecutiveOrchestrator.js";
import { RuntimeLoop } from "./RuntimeLoop.js";
import { resolveQueuePaths } from "./queue/paths.js";
import { resolveRegistryPaths } from "./registry/paths.js";
import { resolveRuntimePaths } from "./runtime-paths.js";
import { reportFilePath } from "./cursor/paths.js";
import type { SaiosJob } from "./queue/types.js";
import type { CursorExecutorLike } from "./runtime-types.js";

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(msg);
}

class SimulatedCursorExecutor implements CursorExecutorLike {
  private readonly queue: QueueManager;
  private readonly reportsDir: string;

  constructor(queue: QueueManager, reportsDir: string) {
    this.queue = queue;
    this.reportsDir = reportsDir;
  }

  async execute(job: SaiosJob) {
    let current = job;
    if (current.status === "QUEUED" || current.status === "PLANNING") {
      current = await this.queue.updateStatus(
        job.id,
        { status: "RUNNING", note: "simulated cursor run" },
        "cursor-runner",
      );
    }

    await mkdir(this.reportsDir, { recursive: true });
    const relPath = `SOS/07_LOGS/saios/reports/${job.id.replace(/[^a-zA-Z0-9_-]/g, "_")}.json`;
    const absPath = reportFilePath(this.reportsDir, job.id);
    await writeFile(
      absPath,
      JSON.stringify({
        job_id: job.id,
        ok: true,
        simulated: true,
        finished_at: new Date().toISOString(),
      }),
      "utf8",
    );

    current = await this.queue.updateStatus(
      job.id,
      { status: "WAITING_QA", report_path: relPath, note: "simulated cursor complete" },
      "cursor-runner",
    );

    return {
      job: current,
      outcome: { ok: true, report_path: relPath, error: null },
      report_written: true,
    };
  }
}

async function main(): Promise<void> {
  const ts = String(Date.now());
  const jobsBase = resolveQueuePaths().jobsDir;
  const registryBase = resolveRegistryPaths().registryDir;
  const verifyJobsDir = join(jobsBase, "verify-runs", `loop-${ts}`);
  const verifyRegistryDir = join(registryBase, "verify-runs", `loop-${ts}`);
  const verifyRuntimeDir = join(resolveRuntimePaths().runtimeDir, "verify-runs", ts);
  const verifyReportsDir = join(verifyRuntimeDir, "reports");
  const stateFile = join(verifyRuntimeDir, "state.json");
  const planId = `PLAN-LOOP-VERIFY-${ts}`;

  await mkdir(verifyJobsDir, { recursive: true });
  await mkdir(verifyRegistryDir, { recursive: true });
  await mkdir(verifyRuntimeDir, { recursive: true });

  const queue = new QueueManager({
    jobsDir: verifyJobsDir,
    eventsFile: join(verifyJobsDir, "events.jsonl"),
  });
  const registry = new RegistryManager({
    registryDir: verifyRegistryDir,
    eventsFile: join(verifyRegistryDir, "events.jsonl"),
  });
  const orchestrator = new ExecutiveOrchestrator({ queue, registry });
  const cursorExecutor = new SimulatedCursorExecutor(queue, verifyReportsDir);
  const loop = new RuntimeLoop({
    queue,
    registry,
    orchestrator,
    cursorExecutor,
    stateFile,
    cycleIntervalMs: 10,
  });

  const workerIds: string[] = [];
  for (let i = 1; i <= 5; i++) {
    const w = await registry.registerWorker({
      id: `WRK-LOOP-${i}`,
      name: `Loop Worker ${i}`,
      type: "cursor-dev",
      version: "1.0.0",
      capabilities: ["implement"],
      host: "verify-host",
      metadata: { verify: true },
    });
    await registry.heartbeat(w.id);
    workerIds.push(w.id);
  }

  const jobIds: string[] = [];
  for (let i = 1; i <= 25; i++) {
    const job = await queue.createJob({
      id: `JOB-LOOP-${ts}-${String(i).padStart(2, "0")}`,
      title: `Loop verify job ${i}`,
      description: `Simulated implement task ${i}`,
      priority: i <= 5 ? "P0" : "P2",
      creator: "loop-verify",
      metadata: {
        plan_id: planId,
        required_capability: "implement",
        step: i,
        verify: true,
      },
    });
    jobIds.push(job.id);
  }

  const summary = await loop.runUntilIdle({ maxCycles: 200 });
  assert(summary.jobs_completed === 25, `expected 25 completed, got ${summary.jobs_completed}`);
  assert(summary.jobs_failed === 0, `expected 0 failed, got ${summary.jobs_failed}`);

  for (const jobId of jobIds) {
    const reportAbs = reportFilePath(verifyReportsDir, jobId);
    assert(existsSync(reportAbs), `missing report for ${jobId}`);
  }

  assert(existsSync(stateFile), "state.json should exist");
  const state = JSON.parse(await readFile(stateFile, "utf8")) as {
    cycle_count: number;
    jobs_completed: number;
    heartbeat: { last_cycle_at: string | null; workers_online: number };
  };
  assert(state.cycle_count > 0, "cycle_count should be > 0");
  assert(state.jobs_completed === 25, `state jobs_completed should be 25, got ${state.jobs_completed}`);
  assert(Boolean(state.heartbeat.last_cycle_at), "heartbeat last_cycle_at should be set");
  assert(state.heartbeat.workers_online === 5, "workers_online should be 5");

  const queueReload = new QueueManager({
    jobsDir: verifyJobsDir,
    eventsFile: join(verifyJobsDir, "events.jsonl"),
  });
  const reloaded = await queueReload.listJobs();
  assert(reloaded.length === 25, "reloaded job count mismatch");
  assert(
    reloaded.every((j) => j.status === "COMPLETED"),
    "all reloaded jobs should be COMPLETED",
  );

  await rm(verifyJobsDir, { recursive: true, force: true });
  await rm(verifyRegistryDir, { recursive: true, force: true });
  await rm(verifyRuntimeDir, { recursive: true, force: true });

  console.log(
    JSON.stringify(
      {
        pass: true,
        component: "runtime-loop",
        workers: 5,
        jobs: 25,
        cycles: summary.cycles,
        jobs_completed: summary.jobs_completed,
        state_file: stateFile,
        checks: {
          all_jobs_completed: true,
          reports_exist: true,
          heartbeat_updated: true,
          runtime_state_updated: true,
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
