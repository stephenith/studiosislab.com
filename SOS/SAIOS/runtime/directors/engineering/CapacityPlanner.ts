import type { Priority } from "../../shared/types.js";
import type { WorkloadSnapshot } from "./WorkloadAnalyzer.js";

export type CapacityEstimate = {
  required_workers: number;
  available_workers: number;
  deficit: number;
  surplus: number;
  priority_weighted_load: number;
  recommended_worker_type: string;
  estimated_clear_time_minutes: number;
};

function priorityWeight(priority: Priority): number {
  switch (priority) {
    case "P0":
      return 4;
    case "P1":
      return 3;
    case "P2":
      return 2;
    case "P3":
      return 1;
    default:
      return 1;
  }
}

function topCapabilityDemand(demand: Record<string, number>): string {
  let best = "resume-worker";
  let bestScore = -1;
  for (const [cap, score] of Object.entries(demand)) {
    if (score > bestScore) {
      bestScore = score;
      best = cap.endsWith("-worker") ? cap : `${cap}-worker`;
    }
  }
  return best;
}

/**
 * Estimates required workforce from queue size, priority, capability demand, and throughput.
 */
export class CapacityPlanner {
  estimate(snapshot: WorkloadSnapshot): CapacityEstimate {
    const priorityWeightedLoad = Object.entries(snapshot.priority_breakdown).reduce(
      (sum, [priority, count]) => sum + count * priorityWeight(priority as Priority),
      0,
    );

    const queueLoad = snapshot.queue_depth + snapshot.planning_jobs;
    const effectiveLoad = Math.max(queueLoad, Math.ceil(priorityWeightedLoad / 2));

    const throughput = Math.max(snapshot.throughput_jobs_per_minute, 0.1);
    const throughputWorkers = Math.ceil(effectiveLoad / Math.max(throughput * 5, 1));

    const idleAndBusy = snapshot.idle_workers + snapshot.busy_workers;
    const requiredByQueue = Math.max(0, effectiveLoad - snapshot.idle_workers);
    const requiredByRatio = Math.ceil(effectiveLoad / Math.max(idleAndBusy || 1, 1));
    const requiredWorkers = Math.max(
      snapshot.busy_workers + requiredByQueue,
      throughputWorkers,
      requiredByRatio,
      snapshot.busy_workers,
    );

    const availableWorkers = snapshot.idle_workers + snapshot.paused_workers;
    const deficit = Math.max(0, requiredWorkers - availableWorkers - snapshot.busy_workers);
    const surplus = Math.max(0, snapshot.idle_workers - requiredWorkers);

    const avgMinutesPerJob =
      snapshot.average_execution_ms > 0 ? snapshot.average_execution_ms / 60_000 : 0.5;
    const parallelCapacity = Math.max(snapshot.idle_workers + snapshot.busy_workers, 1);
    const estimatedClearTimeMinutes =
      Math.round(((queueLoad / parallelCapacity) * avgMinutesPerJob) * 100) / 100;

    return {
      required_workers: requiredWorkers,
      available_workers: availableWorkers,
      deficit,
      surplus,
      priority_weighted_load: priorityWeightedLoad,
      recommended_worker_type: topCapabilityDemand(snapshot.capability_demand),
      estimated_clear_time_minutes: estimatedClearTimeMinutes,
    };
  }
}
