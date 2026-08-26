/**
 * Recovery — resume interrupted scheduler and retry jobs.
 */
import { loadSchedulerState, markResumed, saveSchedulerState } from "./SchedulerState.js";
import { createSchedulerQueue } from "./QueueIntegration.js";
import { resumeScheduler, tickScheduler } from "./SchedulerDirector.js";
import type { SchedulerOptions } from "./types.js";

export async function recoverScheduler(options: SchedulerOptions = {}) {
  const state = loadSchedulerState();
  if (!state) {
    return resumeScheduler(options);
  }

  if (state.status === "interrupted") {
    const resumed = markResumed(state);
    saveSchedulerState(resumed);
  }

  return resumeScheduler(options);
}

export async function retrySchedulerJob(jobId: string, options: SchedulerOptions = {}) {
  const queue = createSchedulerQueue();
  const job = await queue.loadJob(jobId);
  if (!job) throw new Error(`Job not found: ${jobId}`);

  await queue.updateStatus(jobId, { status: "QUEUED", note: "scheduler retry" });
  return tickScheduler(options);
}

export async function cancelSchedulerJob(jobId: string, reason = "cancelled by operator") {
  const queue = createSchedulerQueue();
  return queue.cancelJob(jobId, reason);
}

export async function pauseSchedulerJob(jobId: string) {
  return cancelSchedulerJob(jobId, "paused");
}
