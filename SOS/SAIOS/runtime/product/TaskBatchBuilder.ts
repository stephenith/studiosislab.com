import type { EngineeringJobSpec, ProductFeature, TaskBatch } from "./types.js";

export type TaskBatchBuilderOptions = {
  batch_size?: number;
};

/**
 * Create balanced execution batches from engineering job specifications.
 */
export class TaskBatchBuilder {
  private readonly batchSize: number;

  constructor(options: TaskBatchBuilderOptions = {}) {
    this.batchSize = options.batch_size ?? 10;
  }

  buildBatches(features: ProductFeature[], jobs: EngineeringJobSpec[]): TaskBatch[] {
    const batches: TaskBatch[] = [];
    let batchCounter = 0;

    for (const feature of features) {
      const featureJobs = jobs.filter((j) => j.feature_id === feature.id);
      for (let offset = 0; offset < featureJobs.length; offset += this.batchSize) {
        const slice = featureJobs.slice(offset, offset + this.batchSize);
        if (slice.length === 0) continue;
        batchCounter += 1;
        const start = slice[0]!.index;
        const end = slice[slice.length - 1]!.index;
        batches.push({
          id: `BATCH-${String(batchCounter).padStart(3, "0")}`,
          name: `${feature.name} ${start}–${end}`,
          feature_id: feature.id,
          job_ids: slice.map((j) => j.id),
          worker_types: [...new Set(slice.map((j) => j.worker_type))],
          parallel_safe: feature.parallel_safe,
          batch_index: batchCounter,
        });
      }
    }

    return batches;
  }
}
