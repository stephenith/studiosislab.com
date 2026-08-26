#!/usr/bin/env node
/**
 * SAIOS Telegram Bridge verification
 * Run: npm run telegram:verify (from SOS/SAIOS/runtime)
 */
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { QueueManager } from "../queue/QueueManager.js";
import { RegistryManager } from "../registry/RegistryManager.js";
import { ExecutiveOrchestrator } from "../chief/ExecutiveOrchestrator.js";
import { RuntimeLoop } from "../RuntimeLoop.js";
import { resolveQueuePaths } from "../queue/paths.js";
import { resolveRegistryPaths } from "../registry/paths.js";
import { resolveRuntimePaths } from "../runtime-paths.js";
import { reportFilePath } from "../cursor/paths.js";
import type { SaiosJob } from "../queue/types.js";
import type { CursorExecutorLike } from "../runtime-types.js";
import { SaiosGateway } from "./SaiosGateway.js";
import { TelegramBridge } from "./TelegramBridge.js";
import { FounderSession } from "./FounderSession.js";
import { RecordingTelegramAdapter } from "./LegacyTelegramAdapter.js";
import type { TelegramInboundLike } from "./types.js";

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
        { status: "RUNNING", note: "simulated cursor" },
        "cursor-runner",
      );
    }

    await mkdir(this.reportsDir, { recursive: true });
    const relPath = `SOS/07_LOGS/saios/reports/${job.id.replace(/[^a-zA-Z0-9_-]/g, "_")}.json`;
    await writeFile(
      reportFilePath(this.reportsDir, job.id),
      JSON.stringify({ job_id: job.id, ok: true, simulated: true }),
      "utf8",
    );

    current = await this.queue.updateStatus(
      job.id,
      { status: "WAITING_QA", report_path: relPath, note: "simulated complete" },
      "cursor-runner",
    );

    return {
      job: current,
      outcome: { ok: true, report_path: relPath, error: null },
      report_written: true,
    };
  }
}

const FOUNDER_COMMANDS = [
  "Build another invoice template.",
  "Create a new receipt template for mobile.",
  "Add a quote template with urgent priority.",
  "Implement a simple estimate template.",
  "Build a delivery note template.",
  "Create a packing slip template.",
  "Add a purchase order template.",
  "Implement a credit note template.",
  "Build a proforma invoice template.",
  "Create a work order template for contractors.",
];

async function main(): Promise<void> {
  const ts = String(Date.now());
  const jobsBase = resolveQueuePaths().jobsDir;
  const registryBase = resolveRegistryPaths().registryDir;
  const verifyJobsDir = join(jobsBase, "verify-runs", `telegram-${ts}`);
  const verifyRegistryDir = join(registryBase, "verify-runs", `telegram-${ts}`);
  const verifyRuntimeDir = join(resolveRuntimePaths().runtimeDir, "verify-runs", `telegram-${ts}`);
  const verifyReportsDir = join(verifyRuntimeDir, "reports");
  const stateFile = join(verifyRuntimeDir, "state.json");
  const sessionFile = join(verifyRuntimeDir, "sessions.json");
  const chatId = "verify-founder-chat";

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

  for (let i = 1; i <= 2; i++) {
    const w = await registry.registerWorker({
      id: `WRK-TG-PLAN-${i}`,
      name: `Plan Worker ${i}`,
      type: "planner",
      capabilities: ["plan"],
      version: "1.0.0",
      host: "verify",
    });
    await registry.heartbeat(w.id);
  }

  for (let i = 1; i <= 3; i++) {
    const w = await registry.registerWorker({
      id: `WRK-TG-DEV-${i}`,
      name: `Dev Worker ${i}`,
      type: "cursor-dev",
      capabilities: ["implement"],
      version: "1.0.0",
      host: "verify",
    });
    await registry.heartbeat(w.id);
  }

  const orchestrator = new ExecutiveOrchestrator({ queue, registry });
  const session = new FounderSession({ persistPath: sessionFile });
  await session.load();
  const telegram = new RecordingTelegramAdapter();
  const cursorExecutor = new SimulatedCursorExecutor(queue, verifyReportsDir);
  const runtimeLoop = new RuntimeLoop({
    queue,
    registry,
    orchestrator,
    cursorExecutor,
    stateFile,
    cycleIntervalMs: 10,
  });
  const gateway = new SaiosGateway({
    queue,
    registry,
    orchestrator,
    session,
    telegram,
    runtimeLoop,
  });
  const bridge = new TelegramBridge({ gateway, telegram });

  const planIds: string[] = [];
  const allJobIds: string[] = [];

  for (let i = 0; i < FOUNDER_COMMANDS.length; i++) {
    const inbound: TelegramInboundLike = {
      update_id: 1000 + i,
      message_id: 2000 + i,
      chat_id: chatId,
      user_id: 42,
      username: "founder",
      text: FOUNDER_COMMANDS[i]!,
      received_at: new Date().toISOString(),
    };

    const result = await bridge.handleInbound(inbound);
    assert(result.handled, `command ${i + 1} should be handled`);
    assert(Boolean(result.plan_id), `command ${i + 1} should create plan`);
    planIds.push(result.plan_id!);
    if (result.job_ids) allJobIds.push(...result.job_ids);
  }

  assert(planIds.length === 10, `expected 10 plans, got ${planIds.length}`);
  assert(new Set(planIds).size === 10, "plan ids should be unique");
  assert(allJobIds.length >= 20, `expected at least 20 jobs, got ${allJobIds.length}`);

  const queued = await queue.listJobs();
  assert(queued.length === allJobIds.length, "queue should contain all plan jobs");

  const summary = await runtimeLoop.runUntilIdle({ maxCycles: 300 });
  assert(summary.jobs_failed === 0, `expected 0 failed, got ${summary.jobs_failed}`);
  assert(summary.jobs_completed === allJobIds.length, "all jobs should complete");

  const notifications = await gateway.notifyCompletedPlans(chatId);
  assert(notifications.length === 10, `expected 10 completion notifications, got ${notifications.length}`);
  assert(telegram.completionNotifications.length === 10, "telegram adapter should record 10 completions");
  assert(telegram.inboxReplies.length === 10, "telegram adapter should record 10 inbox replies");

  for (const jobId of allJobIds) {
    const job = await queue.loadJob(jobId);
    if (job?.metadata?.required_capability === "plan") continue;
    assert(existsSync(reportFilePath(verifyReportsDir, jobId)), `missing report for ${jobId}`);
  }

  assert(existsSync(stateFile), "runtime state.json should exist");
  const state = JSON.parse(await readFile(stateFile, "utf8")) as { jobs_completed: number };
  assert(state.jobs_completed === allJobIds.length, "state should reflect completed jobs");

  assert(existsSync(sessionFile), "founder session file should exist");
  const sessionData = JSON.parse(await readFile(sessionFile, "utf8")) as {
    sessions: Array<{ plans: unknown[] }>;
  };
  assert(sessionData.sessions[0]?.plans.length === 10, "session should track 10 plans");

  await rm(verifyJobsDir, { recursive: true, force: true });
  await rm(verifyRegistryDir, { recursive: true, force: true });
  await rm(verifyRuntimeDir, { recursive: true, force: true });

  console.log(
    JSON.stringify(
      {
        pass: true,
        component: "telegram-bridge",
        founder_commands: 10,
        execution_plans: planIds.length,
        jobs: allJobIds.length,
        jobs_completed: summary.jobs_completed,
        completion_notifications: notifications.length,
        cycles: summary.cycles,
        checks: {
          plans_created: true,
          jobs_queued: true,
          runtime_loop_processed: true,
          completion_notifications: true,
          heartbeat_state_updated: true,
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
