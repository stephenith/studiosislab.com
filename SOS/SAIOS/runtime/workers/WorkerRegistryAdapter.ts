import type { JobId, WorkerId } from "../shared/types.js";
import type { RegistryManager } from "../registry/RegistryManager.js";
import type { SaiosWorker } from "../registry/types.js";
import type { FactoryWorker, SerializedWorker } from "./WorkerDefinition.js";
import {
  assertFactoryTransition,
  factoryStatusToRegistry,
  registryStatusToFactory,
  type FactoryWorkerStatus,
} from "./WorkerLifecycle.js";

export class WorkerRegistryAdapter {
  private readonly registry: RegistryManager;

  constructor(registry: RegistryManager) {
    this.registry = registry;
  }

  fromRegistry(worker: SaiosWorker): FactoryWorker {
    const priority =
      (worker.metadata?.priority as FactoryWorker["priority"] | undefined) ?? "P2";
    return {
      worker_id: worker.id,
      worker_type: worker.type,
      display_name: worker.name,
      status: registryStatusToFactory(worker.status),
      capabilities: [...worker.capabilities],
      priority,
      parent_director:
        typeof worker.metadata?.parent_director === "string"
          ? worker.metadata.parent_director
          : null,
      created_at: worker.created_at,
      updated_at: worker.updated_at,
      heartbeat: worker.last_heartbeat,
      current_job: worker.current_job,
      metadata: { ...worker.metadata },
    };
  }

  toRegisterInput(worker: FactoryWorker) {
    return {
      id: worker.worker_id,
      name: worker.display_name,
      type: worker.worker_type,
      version: "1.0.0",
      capabilities: [...worker.capabilities],
      host: "worker-factory",
      runtime: "saios-worker-factory-v1",
      status: factoryStatusToRegistry(worker.status),
      metadata: {
        ...worker.metadata,
        priority: worker.priority,
        parent_director: worker.parent_director,
        factory_status: worker.status,
      },
    };
  }

  async register(worker: FactoryWorker): Promise<FactoryWorker> {
    const saved = await this.registry.registerWorker(this.toRegisterInput(worker));
    return this.fromRegistry(saved);
  }

  async reload(workerId: WorkerId): Promise<FactoryWorker | null> {
    const worker = await this.registry.getWorker(workerId);
    return worker ? this.fromRegistry(worker) : null;
  }

  async listWorkers(filter?: {
    status?: FactoryWorkerStatus;
    worker_type?: string;
  }): Promise<FactoryWorker[]> {
    const registryWorkers = await this.registry.listWorkers({
      status: filter?.status ? factoryStatusToRegistry(filter.status) : undefined,
      type: filter?.worker_type,
    });
    return registryWorkers.map((w) => this.fromRegistry(w));
  }

  async applyStatus(worker: FactoryWorker, to: FactoryWorkerStatus, note?: string): Promise<FactoryWorker> {
    assertFactoryTransition(worker.status, to);
    worker.status = to;
    worker.updated_at = new Date().toISOString();

    const registryStatus = factoryStatusToRegistry(to);
    const existing = await this.registry.getWorker(worker.worker_id);
    if (!existing) {
      throw new Error(`WorkerRegistryAdapter: worker not found ${worker.worker_id}`);
    }

    if (existing.status !== registryStatus) {
      if (to === "READY" && existing.status === "REGISTERED") {
        await this.registry.heartbeat(worker.worker_id);
      } else if (to === "PAUSED") {
        await this.registry.pauseWorker(worker.worker_id, note);
      } else if (to === "READY" && existing.status === "PAUSED") {
        await this.registry.resumeWorker(worker.worker_id, note);
      } else if (to === "RETIRED") {
        if (existing.current_job) {
          throw new Error(`WorkerRegistryAdapter: cannot retire worker with active job`);
        }
        await this.registry.retireWorker(worker.worker_id, note);
      } else if (to === "FAILED") {
        await this.registry.pauseWorker(worker.worker_id, note ?? "failed");
      }
    }

    const reloaded = await this.reload(worker.worker_id);
    return reloaded ?? worker;
  }

  async heartbeat(workerId: WorkerId, metadata?: Record<string, unknown>): Promise<FactoryWorker> {
    const saved = await this.registry.heartbeat(workerId, metadata);
    const factory = this.fromRegistry(saved);
    if (factory.status === "CREATED") {
      factory.status = "READY";
    }
    return factory;
  }

  async assignJob(workerId: WorkerId, jobId: JobId): Promise<FactoryWorker> {
    const saved = await this.registry.assignJob(workerId, jobId);
    const factory = this.fromRegistry(saved);
    factory.status = "BUSY";
    return factory;
  }

  async releaseJob(workerId: WorkerId, note?: string): Promise<FactoryWorker> {
    const saved = await this.registry.releaseJob(workerId, note);
    const factory = this.fromRegistry(saved);
    factory.status = "READY";
    return factory;
  }
}

export function serializeWorker(worker: FactoryWorker): SerializedWorker {
  return JSON.stringify(worker);
}

export function deserializeWorker(serialized: SerializedWorker): FactoryWorker {
  const parsed = JSON.parse(serialized) as FactoryWorker;
  if (!parsed.worker_id || !parsed.worker_type) {
    throw new Error("WorkerRegistryAdapter: invalid serialized worker");
  }
  return parsed;
}
