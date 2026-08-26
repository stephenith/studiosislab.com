import type { QueueManager } from "./queue/QueueManager.js";
import type { RegistryManager } from "./registry/RegistryManager.js";
import type { ExecutiveOrchestrator } from "./chief/ExecutiveOrchestrator.js";
import type { SaiosJob } from "./queue/types.js";
import { RuntimeHeartbeat } from "./RuntimeHeartbeat.js";
import { RuntimeState } from "./RuntimeState.js";
import { RuntimeSupervisor } from "./RuntimeSupervisor.js";
import type { CursorExecutorLike, RuntimeCycleResult, RuntimeRunSummary } from "./runtime-types.js";
import { resolveRuntimePaths } from "./runtime-paths.js";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function requiredCapability(job: SaiosJob): string {
  const cap = job.metadata?.required_capability;
  return typeof cap === "string" ? cap : "implement";
}

export type RuntimeLoopOptions = {
  queue: QueueManager;
  registry: RegistryManager;
  orchestrator: ExecutiveOrchestrator;
  cursorExecutor: CursorExecutorLike;
  stateFile?: string;
  cycleIntervalMs?: number;
};

/**
 * Autonomous SAIOS runtime loop — the operating system heartbeat.
 * Uses only Queue, Registry, Executive Orchestrator, and Cursor Runner.
 */
export class RuntimeLoop {
  private readonly queue: QueueManager;
  private readonly registry: RegistryManager;
  private readonly orchestrator: ExecutiveOrchestrator;
  private readonly cursorExecutor: CursorExecutorLike;
  private readonly heartbeat: RuntimeHeartbeat;
  private readonly state: RuntimeState;
  private readonly supervisor: RuntimeSupervisor;
  private readonly cycleIntervalMs: number;

  private stopped = false;
  private running = false;

  constructor(options: RuntimeLoopOptions) {
    this.queue = options.queue;
    this.registry = options.registry;
    this.orchestrator = options.orchestrator;
    this.cursorExecutor = options.cursorExecutor;
    this.state = new RuntimeState(options.stateFile);
    this.heartbeat = new RuntimeHeartbeat();
    this.supervisor = new RuntimeSupervisor(this.queue, this.registry);
    this.cycleIntervalMs = options.cycleIntervalMs ?? 1000;
  }

  stop(): void {
    this.stopped = true;
  }

  isQueueIdle(): Promise<boolean> {
    return this.queue.listJobs().then((jobs) => {
      return jobs.every(
        (j) => j.status === "COMPLETED" || j.status === "FAILED" || j.status === "CANCELLED",
      );
    });
  }

  async runCycle(): Promise<RuntimeCycleResult> {
    const errors: string[] = [];
    let assignments = 0;
    let executed = 0;
    let completed = 0;

    // 1–2. Load queue and registry (always reload from disk via managers)
    const supervisorResult = await this.supervisor.inspect();
    errors.push(...supervisorResult.issues.map((i) => i.message));
    await this.supervisor.releaseStaleBusyWorkers();

    // Complete jobs waiting for QA handoff (no QA runtime yet)
    const allBefore = await this.queue.listJobs();
    for (const job of allBefore) {
      if (job.status === "WAITING_QA") {
        try {
          await this.orchestrator.recordDelegatedCompletion(job.id, job.report_path ?? undefined);
          completed++;
        } catch (e) {
          errors.push(e instanceof Error ? e.message : String(e));
        }
      }
    }

    // 3–6. Find queued jobs, idle workers, orchestrator decides + assigns
    const runnable = await this.orchestrator.decideRunnableJobs();
    const batch = await this.orchestrator.scheduleNextBatch();
    if (batch.length > 0) {
      await this.orchestrator.assignJobs(batch);
      assignments = batch.length;
    }

    void runnable;

    // 7–9. Execute assigned jobs via Cursor Runner (or orchestrator for plan jobs)
    const all = await this.queue.listJobs();
    const toExecute = all.filter(
      (j) =>
        j.assigned_worker &&
        (j.status === "QUEUED" || j.status === "RUNNING") &&
        requiredCapability(j) !== "plan",
    );

    for (const job of toExecute) {
      try {
        const result = await this.cursorExecutor.execute(job);
        executed++;
        if (result.outcome.ok) {
          await this.orchestrator.recordDelegatedCompletion(
            result.job.id,
            result.outcome.report_path ?? undefined,
          );
          completed++;
        } else {
          errors.push(result.outcome.error ?? `cursor failed for ${job.id}`);
        }
      } catch (e) {
        errors.push(e instanceof Error ? e.message : String(e));
      }
    }

    const planJobs = all.filter(
      (j) =>
        j.assigned_worker &&
        j.status === "QUEUED" &&
        requiredCapability(j) === "plan",
    );
    for (const job of planJobs) {
      try {
        await this.orchestrator.recordDelegatedCompletion(job.id);
        completed++;
      } catch (e) {
        errors.push(e instanceof Error ? e.message : String(e));
      }
    }

    this.heartbeat.recordCycle();
    const snapshot = await this.heartbeat.snapshot(this.queue, this.registry);
    const hasErrors = errors.length > 0;
    this.heartbeat.setStatus(
      snapshot.jobs_queued === 0 && snapshot.jobs_running === 0 ? "idle" : hasErrors ? "degraded" : "running",
    );
    const finalSnapshot = await this.heartbeat.snapshot(this.queue, this.registry);
    this.state.applyHeartbeat(finalSnapshot, errors);
    await this.state.save();

    return {
      cycle: finalSnapshot.cycle_count,
      assignments,
      executed,
      completed,
      errors,
      at: new Date().toISOString(),
    };
  }

  async runForever(): Promise<void> {
    if (this.running) return;
    this.running = true;
    this.stopped = false;
    this.heartbeat.setStatus("running");
    this.state.setStatus("running");
    await this.state.save();

    while (!this.stopped) {
      await this.runCycle();
      await sleep(this.cycleIntervalMs);
    }

    this.heartbeat.setStatus("stopped");
    this.state.setStatus("stopped");
    await this.state.save();
    this.running = false;
  }

  async runUntilIdle(options?: { maxCycles?: number }): Promise<RuntimeRunSummary> {
    const maxCycles = options?.maxCycles ?? 500;
    this.heartbeat.setStatus("running");
    this.state.setStatus("running");
    await this.state.save();

    const errors: string[] = [];
    let cycles = 0;

    while (cycles < maxCycles) {
      const result = await this.runCycle();
      cycles++;
      errors.push(...result.errors);

      const idle = await this.isQueueIdle();
      if (idle) break;

      const jobs = await this.queue.listJobs();
      const pending = jobs.filter(
        (j) => !["COMPLETED", "FAILED", "CANCELLED"].includes(j.status),
      );
      if (pending.length === 0) break;

      await sleep(10);
    }

    this.heartbeat.setStatus("idle");
    this.state.setStatus("idle");
    const snapshot = await this.heartbeat.snapshot(this.queue, this.registry);
    this.state.applyHeartbeat(snapshot, errors);
    await this.state.save();

    const jobs = await this.queue.listJobs();
    return {
      cycles,
      jobs_completed: jobs.filter((j) => j.status === "COMPLETED").length,
      jobs_failed: jobs.filter((j) => j.status === "FAILED").length,
      errors: [...new Set(errors)],
      finished_at: new Date().toISOString(),
    };
  }

  getState(): RuntimeState {
    return this.state;
  }

  getHeartbeat(): RuntimeHeartbeat {
    return this.heartbeat;
  }
}
