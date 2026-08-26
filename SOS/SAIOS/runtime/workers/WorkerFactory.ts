import type { JobId, WorkerId } from "../shared/types.js";
import type { RegistryManager } from "../registry/RegistryManager.js";
import type { CreateWorkerInput, FactoryWorker, SerializedWorker } from "./WorkerDefinition.js";
import { buildWorkerTemplate, cloneTemplateFromWorker, materializeWorker } from "./WorkerTemplate.js";
import {
  WorkerRegistryAdapter,
  deserializeWorker,
  serializeWorker,
} from "./WorkerRegistryAdapter.js";
import type { FactoryWorkerStatus } from "./WorkerLifecycle.js";
import { assertFactoryTransition } from "./WorkerLifecycle.js";

export type WorkerFactoryOptions = {
  registry: RegistryManager;
};

/**
 * Generic Worker Factory — creates standardized workers for any future definition.
 * Communicates with persistence only through WorkerRegistryAdapter → RegistryManager.
 */
export class WorkerFactory {
  private readonly adapter: WorkerRegistryAdapter;

  constructor(options: WorkerFactoryOptions) {
    this.adapter = new WorkerRegistryAdapter(options.registry);
  }

  async createWorker(input: CreateWorkerInput): Promise<FactoryWorker> {
    const template = buildWorkerTemplate(input);
    const worker = materializeWorker(template, { worker_id: input.worker_id, status: "CREATED" });
    const registered = await this.adapter.register(worker);
    return this.heartbeat(registered.worker_id);
  }

  async cloneWorker(workerId: WorkerId): Promise<FactoryWorker> {
    const source = await this.adapter.reload(workerId);
    if (!source) {
      throw new Error(`WorkerFactory: cannot clone unknown worker ${workerId}`);
    }
    const template = cloneTemplateFromWorker(source);
    const worker = materializeWorker(template, { status: "CREATED" });
    const registered = await this.adapter.register(worker);
    return this.heartbeat(registered.worker_id);
  }

  async retireWorker(workerId: WorkerId, reason = "retired"): Promise<FactoryWorker> {
    const worker = await this.adapter.reload(workerId);
    if (!worker) {
      throw new Error(`WorkerFactory: worker not found ${workerId}`);
    }
    assertFactoryTransition(worker.status, "RETIRED");
    return this.adapter.applyStatus(worker, "RETIRED", reason);
  }

  async pauseWorker(workerId: WorkerId, reason = "paused"): Promise<FactoryWorker> {
    const worker = await this.adapter.reload(workerId);
    if (!worker) {
      throw new Error(`WorkerFactory: worker not found ${workerId}`);
    }
    assertFactoryTransition(worker.status, "PAUSED");
    return this.adapter.applyStatus(worker, "PAUSED", reason);
  }

  async resumeWorker(workerId: WorkerId, note = "resumed"): Promise<FactoryWorker> {
    const worker = await this.adapter.reload(workerId);
    if (!worker) {
      throw new Error(`WorkerFactory: worker not found ${workerId}`);
    }
    assertFactoryTransition(worker.status, "READY");
    const resumed = await this.adapter.applyStatus(worker, "READY", note);
    return this.heartbeat(resumed.worker_id, { resumed: true });
  }

  async heartbeat(
    workerId: WorkerId,
    metadata?: Record<string, unknown>,
  ): Promise<FactoryWorker> {
    return this.adapter.heartbeat(workerId, metadata);
  }

  async setStatus(
    workerId: WorkerId,
    status: FactoryWorkerStatus,
    note?: string,
  ): Promise<FactoryWorker> {
    const worker = await this.adapter.reload(workerId);
    if (!worker) {
      throw new Error(`WorkerFactory: worker not found ${workerId}`);
    }
    return this.adapter.applyStatus(worker, status, note);
  }

  async assignJob(workerId: WorkerId, jobId: JobId): Promise<FactoryWorker> {
    return this.adapter.assignJob(workerId, jobId);
  }

  async releaseJob(workerId: WorkerId, note?: string): Promise<FactoryWorker> {
    return this.adapter.releaseJob(workerId, note);
  }

  serialize(worker: FactoryWorker): SerializedWorker {
    return serializeWorker(worker);
  }

  deserialize(serialized: SerializedWorker): FactoryWorker {
    return deserializeWorker(serialized);
  }

  async getWorker(workerId: WorkerId): Promise<FactoryWorker | null> {
    return this.adapter.reload(workerId);
  }

  async listWorkers(filter?: {
    status?: FactoryWorkerStatus;
    worker_type?: string;
  }): Promise<FactoryWorker[]> {
    return this.adapter.listWorkers(filter);
  }
}
