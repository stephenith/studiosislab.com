/**
 * Factory controller — delegates to Scheduler without duplicating logic.
 */
import {
  startScheduler,
  stopScheduler,
  interruptScheduler,
  resumeScheduler,
  tickScheduler,
  getActiveSchedulerState,
} from "../scheduler/SchedulerDirector.js";
import { recoverScheduler, cancelSchedulerJob } from "../scheduler/Recovery.js";
import { loadConfig, saveConfig } from "../scheduler/SchedulerConfig.js";
import type { FactoryStatus } from "./types.js";

export type FactoryControlAction =
  | "start"
  | "stop"
  | "pause"
  | "resume"
  | "emergency_stop"
  | "restart_scheduler"
  | "restart_queue"
  | "restart_production";

export async function executeFactoryControl(action: FactoryControlAction): Promise<{
  success: boolean;
  factory_status: FactoryStatus;
  message: string;
}> {
  switch (action) {
    case "start":
      await startScheduler({ persist: true });
      return { success: true, factory_status: "running", message: "Factory started" };
    case "stop":
      stopScheduler();
      return { success: true, factory_status: "stopped", message: "Factory stopped" };
    case "pause":
      interruptScheduler();
      return { success: true, factory_status: "paused", message: "Factory paused" };
    case "resume":
      await resumeScheduler({ persist: true });
      return { success: true, factory_status: "running", message: "Factory resumed" };
    case "emergency_stop": {
      stopScheduler();
      interruptScheduler();
      const jobs = await import("../scheduler/QueueIntegration.js").then((m) =>
        m.createSchedulerQueue(),
      );
      const queued = await jobs.listQueuedJobs();
      for (const job of queued) {
        await cancelSchedulerJob(job.id, "emergency stop");
      }
      return { success: true, factory_status: "emergency_stop", message: "Emergency stop executed" };
    }
    case "restart_scheduler":
      await recoverScheduler({ persist: true });
      return { success: true, factory_status: "running", message: "Scheduler restarted" };
    case "restart_queue":
      await tickScheduler({ persist: true });
      return { success: true, factory_status: "running", message: "Queue cycle triggered" };
    case "restart_production":
      await tickScheduler({ persist: true });
      return { success: true, factory_status: "running", message: "Production cycle triggered" };
    default:
      return { success: false, factory_status: "stopped", message: "Unknown action" };
  }
}

export function resolveFactoryStatus(): FactoryStatus {
  const state = getActiveSchedulerState();
  if (!state) return "stopped";
  if (state.status === "interrupted") return "paused";
  if (state.status === "stopped") return "stopped";
  return "running";
}

export function getSchedulerStatus(): string {
  const state = getActiveSchedulerState();
  return state?.status ?? "stopped";
}

export function getProductionStatus(): string {
  const state = getActiveSchedulerState();
  if (!state) return "idle";
  if (state.active_run_ids.length > 0) return "producing";
  return "idle";
}

export function updateProductionGoals(goals: {
  daily_target?: number;
  hourly_target?: number;
  concurrent_jobs?: number;
  max_retries?: number;
}): void {
  const config = loadConfig();
  if (goals.daily_target !== undefined) config.workload.max_resumes_per_day = goals.daily_target;
  if (goals.hourly_target !== undefined) config.workload.max_resumes_per_hour = goals.hourly_target;
  if (goals.concurrent_jobs !== undefined) config.workload.max_concurrent_runs = goals.concurrent_jobs;
  if (goals.max_retries !== undefined) config.workload.max_retry_count = goals.max_retries;
  saveConfig(config);
}
